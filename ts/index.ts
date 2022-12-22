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
import { ClientToServerEvents, ServerToClientEvents} from './lib/socket' 
export const app = express();
export const server = http.createServer(app);
export const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  maxHttpBufferSize: 5e6, // 5 mb (5 * 10^6 bytes)
  path: '/socket'
});
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
//@ts-ignore
app.use(cookieParser())
//--------------------------------------
import authUser from './modules/userAuth';
import { http as httpHandler, socket as socketHandler } from './handlers/index'
import SessionManager, { emitToRoomsWith, Session } from './modules/session'
import Bots from './modules/bots';
import * as BotObjects from './modules/bots/botsIndex'
import { getRoomsByUserId } from './modules/rooms';
import { getDMsByUserId } from './modules/dms';
import { getInvitesTo } from './modules/invites';
import { OnlineStatus } from './lib/authdata';
//--------------------------------------
export const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS,
    },
});
//--------------------------------------


{


app.get("/login", (req, res) => (!authUser.bool(req.headers.cookie)) ? res.redirect("/login/email/") : res.redirect("/"))

app.get("/login/email/", (req, res) => res.sendFile(path.join(__dirname, "../pages", "login", "email.html")))
app.post("/login/email/", httpHandler.login.checkEmailHandler)

app.post("/login/password/", httpHandler.login.loginHandler)
app.get("/login/password/", (_req, res) => res.sendFile(path.join(__dirname, "../pages/login", "password.html")))

app.get("/login/style.css", (req, res) => res.sendFile(path.join(__dirname, "../pages/login", "style.css")))
app.get("/login/animate.js", (_req, res) => res.sendFile(path.join(__dirname, "../pages/login", "animate.js")))
// // app.get("/login/2fa", twoFactorGetHandler)
// // app.get("/login/2fa/:code", twoFactorPostHandler)
app.get("/login/reset/", httpHandler.login.resetHandler);
app.post("/login/reset", httpHandler.login.resetConfirmHandler);

app.post("/login/set/", httpHandler.login.setPassword);

app.post("/login/create", httpHandler.login.createAccountHandler)

app.use((req, res, next) => {
  try {
    if (authUser.full(req.headers.cookie)) next();
    // else if (authUser.bool(req.headers.cookie) && !authUser.deviceId(req.headers.cookie)) res.redirect("/login/2fa")
    else res.redirect("/login")
  } catch {
    res.redirect("/login")
  }
})

app.get("/", (req, res) => res.redirect("/chat"))

app.use("/chat", express.static('pages/chat'));

app.use('/search', express.static('pages/search'));
app.use('/doc', express.static('pages/doc'));
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

app.get("/media/:room/:id/:type", httpHandler.mediashare.getMedia)


// disabled for now
// app.post('/search', (req, res) => {
//   let searchString = req.query.q || "";
//   let results = searchMessages(searchString);
//   res.json(results);
// });

app.post('/logout', httpHandler.account.logout)
app.post('/updateProfilePicture', httpHandler.account.updateProfilePicture);
app.post('/changePassword', httpHandler.account.changePassword)
app.get('/:room/bots', httpHandler.account.bots)
app.get('/me', httpHandler.account.me)
app.get('/data', httpHandler.account.data)

}

export const sessions = new SessionManager();
server.removeAllListeners("upgrade")
server.on("upgrade", (req: http.IncomingMessage, socket, head) => {
  const userData = authUser.full(req.headers.cookie)
  if (typeof userData !== "boolean") { // If it is not this explicit typescript gets mad
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
  const userData = authUser.full(socket.request.headers.cookie);
  if (typeof userData === "boolean") { 
    socket.disconnect(); 
    console.log("Request to establish polling connection denied due to authentication failure")
    return 
  }

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
    { event: "online state change", args: [userData.id, OnlineStatus.online]},
    { event: "connection-update", args: [{ connection: true, name: userData.name}]},
  )

  socket.once("ready for initial data", respond => {
    if (respond && typeof respond === "function")
      respond({
        me: userData,
        rooms: getRoomsByUserId(userData.id).map(room => room.data),
        dms: getDMsByUserId(userData.id).map(dm => dm.getDataFor(userData.id)),
        invites: getInvitesTo(userData.id)
      })
  })

  socket.once("disconnecting", reason => { 
    session.managers.forEach(manager => manager.deregister(session.sessionId))
    
    emitToRoomsWith(
      { userId: userData.id, manager: sessions },
      { event: "online state change", args: [userData.id, OnlineStatus.offline]},
      { event: "connection-update", args: [{ connection: false, name: userData.name }]}
    )

    getRoomsByUserId(userData.id).forEach(room => room.broadcastOnlineListToRoom())

    console.log(`${userData.name} (${session.sessionId.substring(0, 10)}...) disconnecting due to ${reason}`)

  })

  socket.on("get room messages", socketHandler.generateGetMessagesHandler(session))
  socket.on("message", socketHandler.generateMessageHandler(session))
  socket.on("edit-message", socketHandler.generateEditHandler(session));
  socket.on("delete-message", socketHandler.generateDeleteHandler(session));
  socket.on("typing start", socketHandler.generateStartTypingHandler(session))
  socket.on("typing stop", socketHandler.generateStopTypingHandler(session))
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
  socket.on("mediashare upload", socketHandler.generateMediaShareHandler.upload(session))
  socket.on("status-set", socketHandler.generateSetStatusHandler(session))
  socket.on("status-reset", socketHandler.generateResetStatusHandler(session))
  socket.on("get last read message for", socketHandler.generateGetLastReadMessageForHandler(session))
  socket.on("read message", socketHandler.generateReadHandler(session))
  socket.on("renounce ownership", socketHandler.generateRenounceOwnershipHandler(session))
  socket.on("claim ownership", socketHandler.generateClaimOwnershipHandler(session))
  socket.on("set schedule", socketHandler.generateSetScheduleHandler(session))
  socket.on("set online state", socketHandler.generateSetOnlineStateHandler(session))

  // disabled for now
  // socket.on("send ping", id => {
  //   if (!id) return;
  //   const pingSession = sessions.getByUserID(id)
  //   if (!pingSession) return;
  //   const pingSent = pingSession.ping(userData)
  //   if (pingSent) 
  //     socket.emit("alert", "Ping Sent", `Ping sent to ${pingSession.userData.name}`)
  //   else 
  //     socket.emit("alert", "Ping Not Sent", `${pingSession.userData.name} has not yet responded to an active ping, or has been pinged within the last 2 minutes`)
  // })

  socket.on("shorten url", (url, respond) => {
    if (!url || !respond) return; 

    fetch('https://api.tinyurl.com/create?api_token=goZd1WAbLICLWSfgt3Kp1pxL8miGASbzijyoRrYYTOBoe6Y7ANLrETbYBL2T', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        "url": url,
      })
    }).then(res => {
      if (!res.ok) return;
      res.json().then(data => respond(data.data.tiny_url))
    })
  })

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


server.listen(1234);

// fs.watch('users.json', _=>{
//   try {
//     users = JSON.parse(fs.readFileSync("users.json", "utf-8"));
//     console.log("Changed Users")
//   } catch {}
// })
