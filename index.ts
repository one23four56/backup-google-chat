import * as express from 'express'
import * as path from 'path';
import * as http from 'http';
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import { Server } from "socket.io";
//--------------------------------------
export const app = express();
export const server = http.createServer(app);
export const io = new Server(server);
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
//@ts-ignore
app.use(cookieParser())
//--------------------------------------
import { sendMessage, sendOnLoadData, sendWebhookMessage, searchMessages, sendConnectionMessage, escape, sendInfoMessage, runPoll } from './modules/functions';
import { autoMod, autoModResult, autoModText, isMuted, mute } from "./modules/autoMod";
import Message from './lib/msg'
import authUser from './modules/userAuth';
import * as handlers from "./handlers/index";
import SessionManager, { Session } from './modules/session'
import Webhook from './modules/webhooks';
import { Archive } from './modules/archive';
import * as json from './modules/json'
import { Statuses } from './lib/users';
import Bots from './modules/bots';
//--------------------------------------

{

app.get("/login", (req, res) => (!authUser.bool(req.headers.cookie)) ? res.sendFile(path.join(__dirname, "pages", "login", "email.html")) : res.redirect("/"))
app.get("/login/style.css", (req, res) => res.sendFile(path.join(__dirname, "pages/login", "loginStyle.css")))
// app.get("/login/2fa", twoFactorGetHandler)
// app.get("/login/2fa/:code", twoFactorPostHandler)
app.post("/login/reset", handlers.login.resetConfirmHandler)
app.post("/login/email", handlers.login.checkEmailHandler)
app.post("/login/login", handlers.login.loginHandler)
app.post("/login/create", handlers.login.createAccountHandler)

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


app.get("/updates/:name", handlers.update.updateName)
app.get("/updates", handlers.update.updates)

app.get("/archive", (_, res) => res.sendFile(path.join(__dirname, "pages/archive/index.html")))
app.get('/archive.json', handlers.archive.getJson)
app.get('/archive/view', handlers.archive.view)
app.get('/archive/stats', handlers.archive.stats)


app.post('/search', (req, res) => {
  let searchString = req.query.q || "";
  let results = searchMessages(searchString);
  res.json(results);
});

app.post('/logout', handlers.account.logout)
app.post('/updateProfilePicture', handlers.account.updateProfilePicture);
app.post('/changePassword', handlers.account.changePassword)
app.get('/bots', handlers.account.bots)
app.get('/me', handlers.account.me)

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

  sendConnectionMessage(userData.name, true)
  io.to("chat").emit('online-check', sessions.getOnlineList())

  socket.emit('onload-data', {
    image: userData.img,
    name: userData.name, 
    webhooks: Webhook.getWebhooksData(userData.name),
  })

  socket.once("disconnecting", reason => { 
    sessions.deregister(session.sessionId);
    console.log(`${userData.name} (${session.sessionId.substring(0, 10)}...) disconnecting due to ${reason}`)
    sendConnectionMessage(userData.name, false)
    io.to("chat").emit('online-check', sessions.getOnlineList())
  })

  socket.on("message", (data, respond) => {
      if (data.recipient!=="chat") data.archive = false
      const msg: Message = {
        text: data.text,
        author: {
          name: userData.name,
          img: userData.img
        },
        time: new Date(new Date().toUTCString()),
        archive: data.archive,
        image: data.image,
        id: Archive.getArchive().length,
        channel: {
          to: data.recipient,
          origin: userData.name
        }
      }
      let autoModRes = autoMod(msg, userData.hooligan ? true: false) // cant just use hooligan because it can be undefined
      switch (autoModRes) {
        case autoModResult.pass:
          respond(sendMessage(msg, data.recipient, socket))
          if (data.archive===true) Archive.addMessage(msg)
          if (data.recipient === 'chat') Bots.runBotsOnMessage(msg);
          if (data.recipient === 'chat') console.log(`Message from ${userData.name}: ${data.text} (${data.archive})`);
          break
        case autoModResult.kick: 
          socket.emit("auto-mod-update", autoModRes.toString())
          mute(userData.name, 120000)
          const autoModMsg: Message = {
            text:
              `${userData.name} has been muted for 2 minutes due to spam.`,
            author: {
              name: "Auto Moderator",
              img:
                "https://jason-mayer.com/hosted/mod.png",
            },
            time: new Date(new Date().toUTCString()),
            tag: {
              text: 'BOT',
              color: 'white',
              bg_color: 'black'
            }
          }
          sendMessage(autoModMsg);
          Archive.addMessage(autoModMsg);
          break
        default: 
          socket.emit("auto-mod-update", autoModRes.toString())
          break
      }
  });

  socket.on("send-webhook-message", data => sendWebhookMessage(data.data));

  socket.on("delete-webhook", id => {
    if (isMuted(userData.name)) return;
    const webhook = Webhook.get(id);
    if (!webhook) return;
    if (!webhook.checkIfHasAccess(userData.name)) return;
    const msg = webhook.remove(userData.name)
    sendMessage(msg);
    Archive.addMessage(msg);
    sendOnLoadData();
  });

  socket.on("edit-webhook", data => {
    if (isMuted(userData.name)) return;
    if (autoModText(data.webhookData.newName, 50) !== autoModResult.pass) return;
    const webhook = Webhook.get(data.id);
    if (!webhook) return;
    if (!webhook.checkIfHasAccess(userData.name)) return;
    const msg = webhook.update(data.webhookData.newName, data.webhookData.newImage, userData.name);
    sendMessage(msg);
    Archive.addMessage(msg);
    sendOnLoadData();
  });

  socket.on("add-webhook", data => {
    if (isMuted(userData.name)) return;
    if (autoModText(data.name, 50) !== autoModResult.pass) return;
    const webhook = new Webhook(data.name, data.image, data.private, userData.name)
    const msg = webhook.generateCreatedMessage(userData.name);
    sendMessage(msg);
    Archive.addMessage(msg);
    sendOnLoadData();
  });

  socket.on("delete-message", (messageID, id) => {
    if (!Archive.getArchive()[messageID].isWebhook && Archive.getArchive()[messageID]?.author.name !== userData.name) return
    if (Archive.getArchive()[messageID].isWebhook && Archive.getArchive()[messageID].sentBy !== userData.name) return;
    Archive.deleteMessage(messageID)
    io.emit("message-deleted", messageID);
  });

  socket.on("edit-message", (data, id) => {
    if (isMuted(userData.name)) return;
    if (!Archive.getArchive()[data.messageID].isWebhook && Archive.getArchive()[data.messageID]?.author.name !== userData.name) return
        if (Archive.getArchive()[data.messageID].isWebhook && Archive.getArchive()[data.messageID].sentBy !== userData.name) return;
        if (autoModText(data.text) !== autoModResult.pass) return;
        Archive.updateMessage(data.messageID, data.text)
        io.emit("message-edited", Archive.getArchive()[data.messageID]);
  });

  socket.on("status-set", (data: { status: string, char: string }) => {
    if (isMuted(userData.name)) return;
    if (autoModText(data.status, 50) !== autoModResult.pass || autoModText(data.char, 3) !== autoModResult.pass) return;

    let statuses: Statuses = json.read("statuses.json")

    statuses[userData.id] = {
      status: data.status,
      char: data.char
    }

    json.write("statuses.json", statuses)

    io.to("chat").emit('online-check', sessions.getOnlineList())

    sendInfoMessage(`${userData.name} has updated their status to "${data.char}: ${data.status}"`)

  })

  socket.on("status-reset", _ => {
    if (isMuted(userData.name)) return;
    let statuses: Statuses = json.read("statuses.json")

    delete statuses[userData.id]

    json.write("statuses.json", statuses)

    io.to("chat").emit('online-check', sessions.getOnlineList())

    sendInfoMessage(`${userData.name} has reset their status`)

  })

  socket.on("typing start", channel => {
    if (isMuted(userData.name)) return;
    if (channel === "chat") 
      io.to(channel).emit("typing", userData.name, channel)
    else {
      socket.emit("typing", userData.name, channel)
      socket.to(channel).emit("typing", userData.name, userData.name)
    }
  })

  socket.on("typing stop", channel => {
    if (channel === "chat")
      io.to(channel).emit("end typing", userData.name, channel)
    else {
      socket.emit("end typing", userData.name, channel)
      socket.to(channel).emit("end typing", userData.name, userData.name)
    }
  })

  socket.on("react", (id, emoji) => {

    if (autoModText(emoji, 4) !== autoModResult.pass) return;

    if (Archive.addReaction(id, emoji, userData))
      io.emit("reaction", id, Archive.getArchive()[id])
  })

  socket.on("start delete webhook poll", id => {

    const webhook = Webhook.get(id);
    if (!webhook) return;
    if (webhook.checkIfHasAccess(userData.name)) return;

    runPoll(userData, sessions, 
      {
        startMessage: `${userData.name} has started a poll to delete the webhook "${webhook.name}"`,
        prompt: `Do you want to delete webhook ${webhook.name}?`,
        yesText: `Delete webhook poll, started by ${userData.name}, has ended with %yes% yes and %no% no. Webhook ${webhook.name} has been deleted.`,
        noText: `Delete webhook poll, started by ${userData.name}, has ended with %yes% yes and %no% no. Webhook ${webhook.name} has not been deleted.`,
        yesMessage: webhook.remove(`Delete private webhook poll, started by ${userData.name}`),
        yesAction: () => {
          sendOnLoadData();
        }
      })

  })

  socket.on("start mute user poll", name => {
    runPoll(userData, sessions, {
      startMessage: `${userData.name} has started a poll to mute ${name}`,
      prompt: `Do you want to mute ${name}?`,
      yesText: `Mute user poll, started by ${userData.name}, has ended with %yes% yes and %no% no. ${name} has been muted.`,
      noText: `Mute user poll, started by ${userData.name}, has ended with %yes% yes and %no% no. ${name} has not been muted.`,
      yesMessage: {
        text:
          `${name} has been muted for 2 minutes by popular demand.`,
        author: {
          name: "Auto Moderator",
          img:
            "https://jason-mayer.com/hosted/mod.png",
        },
        time: new Date(new Date().toUTCString()),
        tag: {
          text: 'BOT',
          color: 'white',
          bg_color: 'black'
        }
      },
      yesAction: () => mute(name, 120000),
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
