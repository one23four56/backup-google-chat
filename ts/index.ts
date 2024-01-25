import * as express from 'express'
import * as path from 'path';
import * as http from 'http';
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import * as nodemailer from 'nodemailer';
import { Server } from "socket.io";
//--------------------------------------
dotenv.config();
import { ClientToServerEvents, ServerToClientEvents } from './lib/socket'
export const app = express();
export const server = http.createServer(app);
export const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    maxHttpBufferSize: 2e6, // 2 mb (2 * 10^6 bytes)
    path: '/socket'
});
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.raw({
    limit: 2e7
}))
//@ts-ignore
app.use(cookieParser())
app.set("trust proxy", true);
//--------------------------------------
import { tokens } from './modules/userAuth';
import { http as httpHandler, socket as socketHandler } from './handlers/index'
import SessionManager, { emitToRoomsWith, Session } from './modules/session'
import Bots from './modules/bots';
import * as BotObjects from './modules/bots/botsIndex'
import { getRoomsByUserId } from './modules/rooms';
import { getDMsByUserId } from './modules/dms';
import { getInvitesTo } from './modules/invites';
import { OnlineStatus, UserData } from './lib/authdata';
import { Users, blockList } from './modules/users';
//--------------------------------------
export const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS,
    },
});
//--------------------------------------

declare global {
    namespace Express {
        interface Request {
            userData: UserData;
        }
    }
}

{


    app.get("/login", (req, res) => (!tokens.verify(req.cookies.token, req.ip)) ? res.redirect("/login/email/") : res.redirect("/"))

    app.get("/login/email/", (req, res) => res.sendFile(path.join(__dirname, "../pages", "login", "email.html")))
    app.post("/login/email/", httpHandler.login.checkEmailHandler)

    app.post("/login/password/", httpHandler.login.loginHandler)

    app.get("/login/style.css", (req, res) => res.sendFile(path.join(__dirname, "../pages/login", "style.css")))
    app.get("/login/animate.js", (_req, res) => res.sendFile(path.join(__dirname, "../pages/login", "animate.js")))


    app.get("/login/reset/:code", httpHandler.login.resetHandler);
    app.post("/login/reset", httpHandler.login.resetConfirmHandler);

    app.post("/login/set/", httpHandler.login.setPassword);

    app.use((req, res, next) => {
        try {
            const userId = tokens.verify(req.cookies.token, req.ip);
            if (!userId) 
                return res.redirect("/login");

            req.userData = Users.get(userId);

            next();
        } catch {
            res.redirect("/login")
        }
    })

    app.get("/logout", httpHandler.login.getLogout);
    app.post("/logout", httpHandler.login.postLogout);

    app.get("/logout/secure", httpHandler.login.getSecureLogout);
    app.post("/logout/secure", httpHandler.login.postSecureLogout);

    app.get("/login/password/change", httpHandler.login.getChangePassword);
    app.post("/login/password/change", httpHandler.login.postChangePassword);

    app.get("/security", (_r, res) => res.sendFile(path.join(__dirname, "../", "pages", "login", "account.html")))

    app.get("/", (req, res) => res.redirect("/chat"))

    app.use("/chat", express.static('pages/chat'));

    app.use('/sounds', express.static('sounds'));
    app.use('/public', express.static('public'));
    app.use('/account', express.static('pages/account'));


    app.use('/:room/stats', express.static('pages/stats'));
    app.get('/:room/stats.json', httpHandler.stats.getStats);

    app.get("/updates/:name", httpHandler.update.updateName)
    app.get("/updates", httpHandler.update.updates)
    app.get("/notices", httpHandler.notices.notices)
    app.get("/notices/:name", httpHandler.notices.noticeName)

    app.get("/:room/archive", httpHandler.archive.getLoader)
    app.get('/:room/archive.json', httpHandler.archive.getJson)
    app.get('/:room/archive/view', httpHandler.archive.view)
    app.get('/:room/archive/stats', httpHandler.archive.stats)

    app.get("/media/:share/:id/:type", httpHandler.mediashare.getMedia)
    app.post("/media/:share/upload", httpHandler.mediashare.uploadMedia)

    app.get('/me/settings', httpHandler.settings.getSettings)

    app.get('/api/thumbnail', httpHandler.api.getThumbnail)

}

export const sessions = new SessionManager();
server.removeAllListeners("upgrade")
server.on("upgrade", (req: http.IncomingMessage, socket, head) => {
    const userData = tokens.verify.fromRequest(req);
    if (userData) {
        // @ts-ignore
        io.engine.handleUpgrade(req, socket, head);
        // console.log(`${userData.name} has established a websocket connection`) 
    } else {
        socket.destroy();
        console.log("Request to upgrade to websocket connection denied due to authentication failure")
    }
})

export const allBots = new Bots();
for (const name in BotObjects)
    allBots.register(new BotObjects[name]())


io.on("connection", (socket) => {
    const userId = tokens.verify.fromRequest(socket.request);
    if (!userId) {
        socket.disconnect();
        console.log("Request to establish polling connection denied due to authentication failure")
        return;
    }

    const userData = Users.get(userId);

    for (const checkSession of sessions.sessions)
        if (checkSession.userData.id === userData.id)
            checkSession.disconnect("You have logged in from another location.")

    const session = new Session(userData);
    sessions.register(session);
    session.bindSocket(socket);

    console.log(`${userData.name} (${session.sessionId.substring(0, 10)}...) registered session`);

    getRoomsByUserId(userData.id).forEach(room => {
        room.addSession(session)
        socket.join(room.data.id)
    })

    getDMsByUserId(userData.id).forEach(dm => {
        dm.addSession(session)
        socket.join(dm.data.id)
    })

    emitToRoomsWith(
        { userId: userData.id, manager: sessions },
        { event: "online state change", args: [userData.id, OnlineStatus.online] },
        { event: "connection-update", args: [{ connection: true, name: userData.name }] },
    )

    socket.once("ready for initial data", respond => {
        if (respond && typeof respond === "function")
            respond({
                me: userData,
                rooms: getRoomsByUserId(userData.id).map(room => room.data),
                dms: getDMsByUserId(userData.id).map(dm => dm.getDataFor(userData.id)),
                invites: getInvitesTo(userData.id),
                blocklist: blockList(userData.id).list
            })
    })

    socket.once("disconnecting", reason => {
        session.managers.forEach(manager => manager.deregister(session.sessionId))

        emitToRoomsWith(
            { userId: userData.id, manager: sessions },
            { event: "online state change", args: [userData.id, OnlineStatus.offline] },
            { event: "connection-update", args: [{ connection: false, name: userData.name }] }
        )

        getRoomsByUserId(userData.id).forEach(room => {
            room.removeTyping(userData.name)
            room.broadcastOnlineListToRoom()
        })

        Users.updateUser(userData.id, {...Users.get(userData.id), lastOnline: Date.now()})

        console.log(`${userData.name} (${session.sessionId.substring(0, 10)}...) disconnecting due to ${reason}`)

    })

    socket.on("get room messages", socketHandler.generateGetMessagesHandler(session))
    socket.on("message", socketHandler.generateMessageHandler(session))
    socket.on("edit-message", socketHandler.generateEditHandler(session));
    socket.on("delete-message", socketHandler.generateDeleteHandler(session));
    socket.on("typing", socketHandler.generateTypingHandler(session))
    socket.on("react", socketHandler.generateReactionHandler(session))
    socket.on("get webhooks", socketHandler.generateGetWebhooksHandler(session))
    socket.on("add-webhook", socketHandler.generateAddWebhookHandler(session))
    socket.on("edit-webhook", socketHandler.generateEditWebhookHandler(session))
    socket.on("delete-webhook", socketHandler.generateDeleteWebhookHandler(session))
    socket.on("vote in poll", socketHandler.generateVoteInPollHandler(session))
    socket.on("get member data", socketHandler.generateGetMembersHandler(session))
    socket.on("query users by name", socketHandler.generateQueryUsersByNameHandler(session))
    socket.on("invite user", socketHandler.generateInviteUserHandler(session))
    socket.on("remove user", socketHandler.generateRemoveUserHandler(session))
    socket.on("get online list", socketHandler.generateGetOnlineListHandler(session))
    socket.on("get bot data", socketHandler.generateGetBotDataHandler(session))
    socket.on("modify rules", socketHandler.generateModifyRulesHandler(session))
    socket.on("modify description", socketHandler.generateModifyDescriptionHandler(session))
    socket.on("create room", socketHandler.generateCreateRoomHandler(session))
    socket.on("modify options", socketHandler.generateModifyOptionsHandler(session))
    socket.on("modify name or emoji", socketHandler.generateModifyNameOrEmojiHandler(session))
    socket.on("query bots by name", socketHandler.generateQueryBotsHandler(session))
    socket.on("modify bots", socketHandler.generateModifyBotsHandler(session))
    socket.on("invite action", socketHandler.generateInviteActionHandler(session))
    socket.on("start dm", socketHandler.generateStartDMHandler(session))
    socket.on("leave room", socketHandler.generateLeaveRoomHandler(session))
    socket.on("delete room", socketHandler.generateDeleteRoomHandler(session))
    socket.on("status-set", socketHandler.generateSetStatusHandler(session))
    socket.on("status-reset", socketHandler.generateResetStatusHandler(session))
    socket.on("get unread data", socketHandler.generateGetUnreadDataHandler(session))
    socket.on("read message", socketHandler.generateReadHandler(session))
    socket.on("renounce ownership", socketHandler.generateRenounceOwnershipHandler(session))
    socket.on("claim ownership", socketHandler.generateClaimOwnershipHandler(session))
    socket.on("set schedule", socketHandler.generateSetScheduleHandler(session))
    socket.on("set online state", socketHandler.generateSetOnlineStateHandler(session))
    socket.on("update setting", socketHandler.genUpdateSettingHandler(session))
    socket.on("get active polls", socketHandler.getActivePollsHandler(session))
    socket.on("block", socketHandler.generateBlockHandler(session))

});


//* Disabled temporarily *//

// app.post('/webhookmessage/:id', (req, res) => {
//   if (!req.body.message) res.status(400).send();

//   let webhook;
//   outerLoop: for(let i = 0; i < webhooks.length; i++) {
//     for(let key of Object.keys(webhooks[i].ids)) {
//       if (webhooks[i].ids[key] == req.params.id) {
//         webhook = webhooks[i];
//         break outerLoop;
//       }
//     }
//   }
//   if (!webhook) res.status(401).send();

//   sendWebhookMessage({
//     id: req.params.id,
//     text: req.body.message,
//     archive: req.body.archive !== undefined ? req.body.archive : true,
//     image: req.body.image
//   });

//   res.status(200).send();
// });


server.listen(process.env.PORT ?? 1234);

// fs.watch('users.json', _=>{
//   try {
//     users = JSON.parse(fs.readFileSync("users.json", "utf-8"));
//     console.log("Changed Users")
//   } catch {}
// })
