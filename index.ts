import * as express from 'express'
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as uuid from 'uuid'
import * as bodyParser from 'body-parser';
import * as cookieParser from 'cookie-parser';
import * as MarkdownIt from 'markdown-it';
import { Server, Socket } from "socket.io";
//--------------------------------------
export const app = express();
export const server = http.createServer(app);
export const io = new Server(server);
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
//@ts-ignore
app.use(cookieParser())
const markdown = MarkdownIt()
//--------------------------------------
//--------------------------------------
import { sendMessage, sendOnLoadData, sendWebhookMessage, searchMessages, sendConnectionMessage, escape, sendInfoMessage } from './modules/functions';
import { autoMod, autoModResult, autoModText, mute } from "./modules/autoMod";
import Message from './lib/msg'
import authUser, { resetUserAuth } from './modules/userAuth';
import { loginHandler, createAccountHandler, checkEmailHandler, resetConfirmHandler } from "./handlers/login";
import SessionManager, { Session } from './modules/session'
import { Users } from './modules/users';
import Webhook from './modules/webhooks';
import { Archive } from './modules/archive';
import * as json from './modules/json'
import { Statuses } from './lib/users';
//--------------------------------------

{

app.get("/login", (req, res) => (!authUser.bool(req.headers.cookie)) ? res.sendFile(path.join(__dirname, "pages", "login", "email.html")) : res.redirect("/"))
app.get("/login/style.css", (req, res) => res.sendFile(path.join(__dirname, "pages/login", "loginStyle.css")))
// app.get("/login/2fa", twoFactorGetHandler)
// app.get("/login/2fa/:code", twoFactorPostHandler)
app.post("/login/reset", resetConfirmHandler)
app.post("/login/email", checkEmailHandler)
app.post("/login/login", loginHandler)
app.post("/login/create", createAccountHandler)

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

app.get("/archive", (_, res) => res.sendFile(path.join(__dirname, "pages/archive/index.html")))

app.use('/search', express.static('pages/search'));
app.use('/doc', express.static('pages/doc'));
app.use('/sounds', express.static('sounds'));
app.use('/public', express.static('public'));
app.use('/account', express.static('pages/account'));

app.get('/archive.json', (req, res) => {
  let archive: Message[] = Archive.getArchive();
  if (req.query.images === 'none') for (let message of archive) if (message.image) delete message.image
  if (req.query.reverse === 'true') archive = archive.reverse()
  if (req.query.start && req.query.count) archive = archive.filter((_, index) => !(index < Number(req.query.start) || index >= (Number(req.query.count) + Number(req.query.start))))
  res.send(JSON.stringify(archive))
})

app.get("/updates/:name", (req, res) => {
  if (req.query.parse === 'true') {
    if (fs.existsSync(path.join(__dirname, 'updates', req.params.name))) {
      res.send("<style>p, h1, h2, h3, li {font-family:sans-serif}</style>" + markdown.render(fs.readFileSync(path.join(__dirname, 'updates', req.params.name), 'utf-8')))
    } else res.status(404).send(`The requested file was not found on the server.`)
  } else {
    res.sendFile(req.params.name, {
      root: path.join(__dirname, 'updates'),
      dotfiles: 'deny'
    }, err => {
      if (err) res.status(404).send(`The requested file was not found on the server.`)
    });
  }
})

app.get("/updates", (req, res) => {
  let response = `<head><title>Backup Google Chat Update Logs</title>`
  response += `<style>li {font-family:monospace} h1 {font-family:sans-serif}</style></head><h1>Backup Google Chat Update Logs</h1><ul>`
  const updates = JSON.parse(fs.readFileSync('updates.json', "utf-8"))
  for (const update of updates.reverse())
    response += `<li><a target="_blank" href="${update.logLink}">${update.doc ? 'DOCUMENT' : `v${update.mainVersion}.${update.subVersion}.${update.patch}`}</a>: ${update.updateName} ${update.patch === 0 ? '' : `Patch ${update.patch}`}</li><br>`
  response += `</ul>`
  res.send(response)
})

app.get('/archive/view', (req, res) => {
  let archive: Message[] = Archive.getArchive();

  for (const [index, message] of archive.entries()) 
    message.index = index;
  
  if (req.query.noImages === 'on') for (let message of archive) if (message.image) delete message.image
  if (req.query.reverse === 'on') archive = archive.reverse()
  if (req.query.start && req.query.count) archive = archive.filter((_, index) => !(index < Number(req.query.start) || index >= (Number(req.query.count) + Number(req.query.start))))
  if (req.query.reverse === 'on') archive = archive.reverse() // intentional

  let result: string = fs.readFileSync('pages/archive/view.html', 'utf-8');
  for (const [index, message] of archive.entries()) 
    result += `<p ${
      Number(req.query.focus) === message.index && req.query.focus ? `style="background-color: yellow" ` : ''
    }title="${
      message.id
    }">[${
      index + ' / ' + message.index
    }] <i>${
      new Date(message.time).toLocaleString()
    }</i> <b>${
      escape(message.author.name)
    }${
      message.isWebhook ? ` (${message.sentBy})` : ''
    }${
      message.tag ? ` [${message.tag.text}]` : ''
    }:</b> ${
      escape(message.text)
    }${
      message.image ? ` (<a href="${message.image}" target="_blank">View Attached Image</a>)` : ''
    }</p>`

  result += `<hr><p>Backup Google Chat Archive Viewer v2</p><p>Generated at ${new Date().toUTCString()}</p><br><p>Settings used:</p>`

  result += `<p>Start: ${req.query.start} / Count: ${req.query.count}</p>`;
  result += `<p>Focus: ${req.query.focus || 'Off'}</p>`;
  result += `<p>Hide Images: ${req.query.noImages === 'on' ? 'On' : 'Off'}</p>`;
  result += `<p>Reverse Mode: ${req.query.reverse === 'on' ? 'On' : 'Off'}</p>`;

  result += `<br><p>Total Messages Displayed: ${archive.length}</p>`;

  result += `<br><p><a href="../archive">Back</a></p><br>`;

  result += `</div></body></html>`;


  res.send(result)
})

app.get('/archive/stats', (req, res) => {
  const size: number = fs.statSync('messages.json').size;
  const data = authUser.bool(req.headers.cookie);

  if (typeof data !== 'object') {
    res.status(401).send('You are not authorized');
    return;
 } // should never happen, just here to please typescript

 const myMessages = Archive.getArchive().filter(message => message.author.name === data.name || message.sentBy === data.name).length;

 res.json({
    size: size,
    myMessages: myMessages,
    totalMessages: Archive.getArchive().length
 })

})

app.get('/me', (req, res) => {
  const data = authUser.bool(req.headers.cookie);
  if (typeof data !== 'boolean')
    res.json(data)
  else 
    res.status(401).send('You are not authorized') // should never happen
})

app.post('/search', (req, res) => {
  let searchString = req.query.q || "";
  let results = searchMessages(searchString);
  res.json(results);
});

app.post('/logout', (req, res) => {
  res.clearCookie('pass')
  res.clearCookie('email')
  res.send("Logged out")
})

  app.post('/updateProfilePicture', (req, res) => {
    const data = authUser.full(req.headers.cookie)
    if (typeof data !== 'object') {
      res.status(401).send('You are not authorized');
      return;
    }

    Users.updateUser(data.id, {
      name: data.name,
      id: data.id,
      email: data.email,
      img: req.body.link
    })

    res.redirect('/account')
  });

  app.post('/changePassword', (req, res) => {
    const data = authUser.full(req.headers.cookie)

    if (typeof data !== 'object') {
      res.status(401).send('You are not authorized');
      return;
    }

    const passwordCorrect = authUser.bool(data.email, req.body.password);

    if (typeof passwordCorrect !== 'object') {
      res.status(401).send('Incorrect password');
      return;
    }

    resetUserAuth(data.email);

    res.redirect('/');

  })

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
      let autoModRes = autoMod(msg)
      switch (autoModRes) {
        case autoModResult.pass:
          respond(sendMessage(msg, data.recipient, socket))
          if (data.archive===true) Archive.addMessage(msg)
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
    const webhook = Webhook.get(id);
    if (!webhook) return;
    if (!webhook.checkIfHasAccess(userData.name)) return;
    const msg = webhook.remove(userData.name)
    sendMessage(msg);
    Archive.addMessage(msg);
    sendOnLoadData();
  });

  socket.on("edit-webhook", data => {
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
    if (autoModText(data.name, 50) !== autoModResult.pass) return;
    const webhook = new Webhook(data.name, data.image, data.private, userData.name)
    const msg = webhook.generateCreatedMessage(userData.name);
    sendMessage(msg);
    Archive.addMessage(msg);
    sendOnLoadData();
  });

  socket.on("delete-message", (messageID, id) => {
        if (Archive.getArchive()[messageID]?.author.name!==userData.name) return
        Archive.deleteMessage(messageID)
        io.emit("message-deleted", messageID);
  });

  socket.on("edit-message", (data, id) => {
        if (Archive.getArchive()[data.messageID]?.author.name!==userData.name) return;
        if (autoModText(data.text) !== autoModResult.pass) return;
        Archive.updateMessage(data.messageID, data.text)
        io.emit("message-edited", Archive.getArchive()[data.messageID]);
  });

  socket.on("status-set", (data: { status: string, char: string }) => {
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
    let statuses: Statuses = json.read("statuses.json")

    delete statuses[userData.id]

    json.write("statuses.json", statuses)

    io.to("chat").emit('online-check', sessions.getOnlineList())

    sendInfoMessage(`${userData.name} has reset their status`)

  })

  socket.on("typing start", channel => {
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

    let yes = 0, no = 0; // votes
    let pollEnded = false;

    const autoEnd = setTimeout(() => { // auto end after 15s to prevent a filibuster
      if (yes > no && sessions.getOnlineList().length > 1 && yes > 1) {
        const msg = webhook.remove(`Delete private webhook poll, started by ${userData.name} (${yes} yes / ${no} no)`);
        sendMessage(msg);
        Archive.addMessage(msg);
        sendOnLoadData();
        pollEnded = true;
        io.emit('alert', 'Poll Ended', `Delete webhook poll, started by ${userData.name}, has ended with ${yes} yes and ${no} no. Webhook ${webhook.name} has been deleted.`)
      } else {
        io.emit('alert', 'Poll Ended', `Delete webhook poll, started by ${userData.name}, has ended with ${yes} yes and ${no} no. Webhook ${webhook.name} has not been deleted.`)
      }
    }, 15000);

    io.fetchSockets().then(sockets => {
      for (const voteSocket of sockets) {
        voteSocket.emit("delete webhook poll", userData.name, id, response => {

          if (pollEnded) return;

          if (response) {
            yes++;
          } else {
            no++;
          }

          if (yes > no && yes + no >= sessions.getOnlineList().length && sessions.getOnlineList().length > 1) {
            const msg = webhook.remove(`Delete private webhook poll, started by ${userData.name} (${yes} yes / ${no} no)`);
            sendMessage(msg);
            Archive.addMessage(msg);
            sendOnLoadData();
            clearTimeout(autoEnd);
            pollEnded = true;
            io.emit('alert', 'Poll Ended', `Delete webhook poll, started by ${userData.name}, has ended with ${yes} yes and ${no} no. Webhook ${webhook.name} has been deleted.`)
          } else if (no >= yes && no + yes >= sessions.getOnlineList().length && sessions.getOnlineList().length > 1) {
            io.emit('alert', 'Poll Ended', `Delete webhook poll, started by ${userData.name}, has ended with ${yes} yes and ${no} no. Webhook ${webhook.name} has not been deleted.`)
          }
        })
      }
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
