import * as express from 'express'
import * as path from 'path';
import * as http from 'http';
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import * as dotenv from 'dotenv';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import { Server } from "socket.io";
//--------------------------------------
const PROD = typeof process.env.PORT !== "undefined";
if (PROD) process.env.NODE_ENV = "production";
dotenv.config();
import { ClientToServerEvents, InitialData, ServerToClientEvents } from './lib/socket'
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
import SessionManager, { emitToRoomsWith, Session } from './modules/session';
export const sessions = new SessionManager();
import { tokens } from './modules/userAuth';
import { http as httpHandler, socket as socketHandler } from './handlers/index'
import { getRoomsByUserId } from './modules/rooms';
import { getDMsByUserId } from './modules/dms';
import { getInvitesTo } from './modules/invites';
import { OnlineStatus, UserData } from './lib/authdata';
import { Users, blockList } from './modules/users';
import setTimings from './modules/timing';
import * as Update from './update.json';
import { Data } from './modules/data';
import { UserBots } from './modules/userBots';
import type { SendMailOptions } from 'nodemailer';
//--------------------------------------
export const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS,
    },
});
export const sendEmail = (options: SendMailOptions) => new Promise<void>((res, rej) => {
    try {
        transporter.sendMail(options, (error) => {
            if (error) return rej(error);
            res();
        });
    } catch (err) {
        rej(err);
    }
})
//--------------------------------------

declare global {
    namespace Express {
        interface Request {
            userData: UserData;
            bot?: string;
        }
    }
}

setTimings();

{
    const login = express.Router();
    app.use("/login", login);

    login.get("/style.css", (req, res) => res.sendFile(path.join(__dirname, "../pages/login", "style.css")))
    login.get("/animate.js", (_req, res) => res.sendFile(path.join(__dirname, "../pages/login", "script.js")))

    login.use((req, res, next) => {
        if (tokens.verify(req.cookies.token, req.ip))
            return res.redirect("/chat");

        next();
    });

    login.get("/", (req, res) => (!tokens.verify(req.cookies.token, req.ip)) ? res.redirect("/login/email/") : res.redirect("/"))

    login.get("/email", httpHandler.login.getEmailHandler);
    login.post("/email", httpHandler.login.checkEmailHandler)

    login.post("/password", httpHandler.login.loginHandler)

    login.get("/reset/:code", httpHandler.login.resetHandler);
    login.post("/reset", httpHandler.login.resetConfirmHandler);
    login.post("/create", httpHandler.login.createHandler);

    login.post("/set", httpHandler.login.setPassword);
}

{
    const api = express.Router();
    app.use("/bots/api/", api);

    api.use((req, res, next) => {
        const token = req.headers["auth"];
        const type = req.headers["x-bot-type"];

        if (typeof token !== "string")
            return res.status(401).type("text/plain").send("Missing bot token");

        if (type !== "beta" && type !== "prod")
            return res.status(400).type("text/plain").send("Invalid bot type");

        const botId = UserBots.parseToken(token);
        if (typeof botId !== "string")
            return res.status(401).type("text/plain").send("Invalid bot token");

        if (typeof UserBots.get(botId) !== "object")
            return res.sendStatus(400);

        req.bot = `bot-usr-${botId}${type === "beta" ? "-beta" : ""}`;

        next();
    });

    api.get("/rooms", httpHandler.userBotsAPI.getRooms);
    api.get("/:room/archive", httpHandler.userBotsAPI.getArchive);
    api.get("/:room/messages", httpHandler.userBotsAPI.getMessages);
    api.post("/send", httpHandler.userBotsAPI.sendMessage);
}

{
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

    app.get("/", (req, res) => res.redirect("/chat/"));

    const chat = fs.readFileSync("pages/chat/index.html", "utf-8");

    app.get("/chat/index.html", (req, res) => res.redirect("/chat/"))
    app.get("/chat/", (req, res) => {
        res.type("text/html").send(chat.replace(
            "\"--initial--\"", JSON.stringify({
                me: req.userData,
                rooms: getRoomsByUserId(req.userData.id).map(room => room.data),
                dms: getDMsByUserId(req.userData.id).map(dm => dm.getDataFor(req.userData.id)),
                invites: getInvitesTo(req.userData.id),
                blocklist: blockList(req.userData.id).list
            } as InitialData)
        ))
    });
    app.use("/chat/", express.static('pages/chat'));

    app.use('/sounds', express.static('sounds'));
    app.use('/public', express.static('public'));
    app.use('/account', express.static('pages/account'));
    app.use('/updates', express.static('pages/updates'));


    app.use('/:room/stats', express.static('pages/stats'));
    app.get('/:room/stats.json', httpHandler.stats.getStats);

    app.get("/:room/archive", httpHandler.archive.getLoader)
    app.get('/:room/archive.json', httpHandler.archive.getJson)
    app.get('/:room/archive/view', httpHandler.archive.view)

    app.get("/media/static/:file", httpHandler.mediashare.viewStaticFile)
    app.get("/media/:share/:id", httpHandler.mediashare.getMedia)
    app.post("/media/:share/upload", httpHandler.mediashare.startUpload)
    app.put("/media/upload/:key", httpHandler.mediashare.uploadMedia)
    app.get("/media/:share", httpHandler.mediashare.viewShare)

    app.get('/me/settings', httpHandler.settings.getSettings)

    app.get('/api/thumbnail', httpHandler.api.getThumbnail)

    app.use('/bots', express.static('pages/bots'));
    app.post('/bots/create', httpHandler.userBots.create);
    app.get('/bots/all', httpHandler.userBots.getAll);
    app.get('/bots/template', (req, res) => res.redirect("https://script.google.com/d/1uzwz3YyGOSPh3iiXjsI1YSZ8F3gv7mj8wnQA818s4hMPWBXkdV4tJkEu/edit?usp=sharing"));
    app.get('/bots/:id', httpHandler.userBots.get);
    app.post('/bots/:id/name', httpHandler.userBots.setName);
    app.post('/bots/:id/image', httpHandler.userBots.setImage);
    app.post('/bots/:id/description', httpHandler.userBots.setDescription);
    app.post('/bots/:id/token', httpHandler.userBots.getToken);
    app.post('/bots/:id/enable', httpHandler.userBots.enable);
    app.post('/bots/:id/server', httpHandler.userBots.setCommandServer);
    app.post('/bots/:id/commands', httpHandler.userBots.setCommands);
    app.post('/bots/:id/event', httpHandler.userBots.setEvent);
    app.post('/bots/:id/publish', httpHandler.userBots.publishBot);
    app.post('/bots/:id/disable', httpHandler.userBots.disableBot);
    app.delete('/bots/:id', httpHandler.userBots.deleteBot);

}

let global_socket_inbound = 0;
let global_socket_outbound = 0;

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
});

io.on("connection", (socket) => {
    const userId = tokens.verify.fromRequest(socket.request);
    if (!userId) {
        socket.disconnect();
        console.log("Request to establish polling connection denied due to authentication failure")
        return;
    }

    let inbound = 0, outbound = 0;

    socket.onAny(() => {
        inbound++;
        global_socket_inbound++;
    });

    socket.onAnyOutgoing(() => {
        outbound++;
        global_socket_outbound++;
    })

    const userData = Users.get(userId);

    for (const checkSession of sessions.sessions)
        if (checkSession.userData.id === userData.id)
            checkSession.disconnect("You have logged in from another location.")

    const session = new Session(userData, socket);
    sessions.register(session);

    console.log(`sessions: ${userData.name} [${session.sessionId.substring(0, 10)}] registered session (${new Date(session.startTime).toISOString()})`);

    const rooms = getRoomsByUserId(userData.id), dms = getDMsByUserId(userData.id);

    rooms.forEach(room => {
        room.addSession(session)
        socket.join(room.data.id)
    })

    dms.forEach(dm => {
        dm.addSession(session)
        socket.join(dm.data.id)
    })

    emitToRoomsWith(
        { userId: userData.id, manager: sessions },
        { event: "online state change", args: [userData.id, OnlineStatus.online] },
        { event: "connection-update", args: [{ connection: true, name: userData.name }] },
    );

    socket.once("disconnecting", reason => {
        session.managers.forEach(manager => manager.deregister(session.sessionId))

        Users.updateUser(userData.id, { ...Users.get(userData.id), lastOnline: Date.now() })

        emitToRoomsWith(
            { userId: userData.id, manager: sessions },
            { event: "online state change", args: [userData.id, OnlineStatus.offline] },
            { event: "connection-update", args: [{ connection: false, name: userData.name }] }
        )

        getRoomsByUserId(userData.id).forEach(room => {
            room.removeTyping(userData.name)
            room.broadcastOnlineListToRoom()
        })

        console.log(`sessions: ${userData.name} [${session.sessionId.substring(0, 10)}] disconnecting due to ${reason} (${new Date().toISOString()})`)

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
    socket.on("get notifications", socketHandler.getNotificationsHandler(session))
    socket.on("dismiss notification", socketHandler.dismissNotificationHandler(session));
    socket.on("mute or kick", socketHandler.muteKickHandler(session));

    socket.on("debug", respond => respond({
        serverStart: process.uptime(),
        clientStart: session.startTime,
        timezone: new Date().getTimezoneOffset(),
        node: process.version,
        //@ts-ignore
        version: Update.version.number + "-" + (PROD ? "prod" : "dev") + (Update.version.hotfix ? `.${Update.version.hotfix}` : ""),
        socket: [inbound, outbound],
        global: [global_socket_inbound, global_socket_outbound],
        data: Data.count,
        badReads: Data.badReads,
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
    }))

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
