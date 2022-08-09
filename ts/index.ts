import * as express from 'express'
import * as path from 'path';
import * as http from 'http';
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import { Server } from "socket.io";
//--------------------------------------
import { ClientToServerEvents, ServerToClientEvents} from './lib/socket' 
export const app = express();
export const server = http.createServer(app);
export const io = new Server<ClientToServerEvents, ServerToClientEvents>(server);
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
//@ts-ignore
app.use(cookieParser())
//--------------------------------------
import { searchMessages, sendConnectionMessage } from './modules/functions';
import AutoMod from "./modules/autoMod";
import authUser from './modules/userAuth';
import { http as httpHandler, socket as socketHandler } from './handlers/index'
import SessionManager, { Session } from './modules/session'
import Webhook from './modules/webhooks';
import * as json from './modules/json'
import { Statuses } from './lib/users';
import Bots, { BotUtilities } from './modules/bots';
import { Poll } from './lib/msg';
import Polly from './modules/bots/polly';
import Room, { createRoom, getRoomsByUserId } from './modules/rooms';
//--------------------------------------

// export const room = createRoom({
//   name: 'MessageTestRoom1',
//   emoji: 'er',
//   owner: 'er',
//   options: {
//     webhooksAllowed: true
//   }
// })

// room.addUser("fd9c0445-c09c-41ca-ab6d-878ed71f4ada")

// 0bacf191930537f5d95f1c7e988bcec2

{

app.get("/login", (req, res) => (!authUser.bool(req.headers.cookie)) ? res.sendFile(path.join(__dirname, "../pages", "login", "email.html")) : res.redirect("/"))
app.get("/login/style.css", (req, res) => res.sendFile(path.join(__dirname, "../pages/login", "loginStyle.css")))
// app.get("/login/2fa", twoFactorGetHandler)
// app.get("/login/2fa/:code", twoFactorPostHandler)
app.post("/login/reset", httpHandler.login.resetConfirmHandler)
app.post("/login/email", httpHandler.login.checkEmailHandler)
app.post("/login/login", httpHandler.login.loginHandler)
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


app.get('/stats', httpHandler.stats.generateStats);

app.get("/updates/:name", httpHandler.update.updateName)
app.get("/updates", httpHandler.update.updates)
app.get("/notices", httpHandler.notices.notices)
app.get("/notices/:name", httpHandler.notices.noticeName)

app.get("/archive", (_, res) => res.sendFile(path.join(__dirname, "../pages/archive/index.html")))
app.get('/archive.json', httpHandler.archive.getJson)
app.get('/archive/view', httpHandler.archive.view)
app.get('/archive/stats', httpHandler.archive.stats)


app.post('/search', (req, res) => {
  let searchString = req.query.q || "";
  let results = searchMessages(searchString);
  res.json(results);
});

app.post('/logout', httpHandler.account.logout)
app.post('/updateProfilePicture', httpHandler.account.updateProfilePicture);
app.post('/changePassword', httpHandler.account.changePassword)
app.get('/bots', httpHandler.account.bots)
app.get('/me', httpHandler.account.me)
app.get('/data', httpHandler.account.data)

}

export let sessions = new SessionManager();
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

  socket.join('chat');
  socket.join(userData.name)

  getRoomsByUserId(userData.id).forEach(room => {
    room.addSession(session)
    socket.join(room.data.id)
  })

  sendConnectionMessage(userData.name, true)
  io.to("chat").emit('load data updated')

  socket.once("ready for initial data", respond => {
    if (respond && typeof respond === "function")
      respond({
        me: userData,
        rooms: getRoomsByUserId(userData.id).map(room => room.data)
      })
  })

  socket.once("disconnecting", reason => { 
    sessions.deregister(session.sessionId);
    console.log(`${userData.name} (${session.sessionId.substring(0, 10)}...) disconnecting due to ${reason}`)
    sendConnectionMessage(userData.name, false)
    io.to("chat").emit('load data updated')
  })

  // socketHandler.registerWebhookHandler(socket, userData);

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

  // socket.on("status-set", ({status, char}) => {
  //   if (!status || !char) return;
  //   if (isMuted(userData.name)) return;
  //   if (autoModText(status, 50) !== autoModResult.pass || autoModText(char, 6) !== autoModResult.pass) return;

  //   let statuses: Statuses = json.read("statuses.json")

  //   statuses[userData.id] = {
  //     status: status,
  //     char: char
  //   }

  //   json.write("statuses.json", statuses)

  //   io.to("chat").emit('load data updated')

  //   // sendInfoMessage(`${userData.name} has updated their status to "${char}: ${status}"`)

  // })

  // socket.on("status-reset", () => {
  //   if (isMuted(userData.name)) return;
  //   let statuses: Statuses = json.read("statuses.json")

  //   delete statuses[userData.id]

  //   json.write("statuses.json", statuses)

  //   io.to("chat").emit('load data updated')

  //   // sendInfoMessage(`${userData.name} has reset their status`)

  // })


  // let pollStarted = false;
  // socket.on("start delete webhook poll", id => {

  //   if (!id) return;

  //   if (pollStarted) return;
  //   const webhook = Webhook.get(id);
  //   if (!webhook) return;
  //   if (webhook.checkIfHasAccess(userData.name)) return;
  //   pollStarted = true;

  //   const polly = Bots.bots.find(bot => bot.name === "Polly") as Polly;

  //   const poll: Poll = {
  //     type: 'poll',
  //     finished: false,
  //     question: `Delete webhook '${webhook.name}'?`,
  //     options: [
  //       {
  //         option: 'Yes',
  //         votes: 0,
  //         voters: []
  //       },
  //       {
  //         option: 'No',
  //         votes: 1,
  //         voters: ["System"]
  //       }
  //     ]
  //   }

  //   const msg = BotUtilities.genBotMessage(polly.name, polly.image, {
  //     text: `${userData.name} has started a poll to delete webhook '${webhook.name}'`,
  //     poll: poll
  //   })

  //   polly.runTrigger(poll, msg.id).then(winner => {
  //     if (winner === 'Yes') {
  //       const remove = webhook.remove(`${userData.name}'s delete webhook poll`)
  //       sendMessage(remove);
  //       room.archive.addMessage(remove);
  //       io.emit("load data updated")
  //       pollStarted = false;
  //     }
  //   })

  // })

  socket.on("send ping", id => {
    if (!id) return;
    const pingSession = sessions.getByUserID(id)
    if (!pingSession) return;
    const pingSent = pingSession.ping(userData)
    if (pingSent) 
      socket.emit("alert", "Ping Sent", `Ping sent to ${pingSession.userData.name}`)
    else 
      socket.emit("alert", "Ping Not Sent", `${pingSession.userData.name} has not yet responded to an active ping, or has been pinged within the last 2 minutes`)
  })

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
