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
export let users: Users = JSON.parse(fs.readFileSync("users.json", "utf-8"));
export let webhooks = JSON.parse(fs.readFileSync("webhooks.json", "utf8"));
export let messages: Message[] = JSON.parse(fs.readFileSync('messages.json', 'utf-8')).messages;
//--------------------------------------
import { removeDuplicates, sendMessage, sendOnLoadData, sendWebhookMessage, updateArchive, searchMessages } from './functions';
import { autoMod, autoModResult, autoModText } from "./automod";
import Users from "./lib/users";
import Message from './lib/msg'
import authUser from './modules/userAuth';
import { loginHandler, createAccountHandler, checkEmailHandler, resetConfirmHandler } from "./handlers/login";
import SessionManager, { Session } from './modules/session'
//--------------------------------------
messages.push = function () {
  Array.prototype.push.apply(this, arguments)
  updateArchive()
  return messages.length
}

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

app.use("/chat", express.static('chat'));

app.get("/archive", (_, res) => res.sendFile(path.join(__dirname, "archive/index.html")))

app.use('/search', express.static('search'));
app.use('/sounds', express.static('sounds'))
app.use('/public', express.static('public'))

app.get('/archive.json', (req, res) => {
  let archive: Message[] = JSON.parse(fs.readFileSync('messages.json', "utf-8")).messages
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
  for (const update of updates.reverse()) {
    response += `<li><a target="_blank" href="${update.logLink}">${update.releaseDate}.${update.patch}${update.patchReleaseDate ? `/${update.patchReleaseDate}${update.stabilityChar}` : update.stabilityChar}</a>: ${update.updateName} v${update.patch} ${update.stability}</li><br>`
  }
  response += `</ul>`
  res.send(response)
})

app.get('/archive/view', (req, res) => {
  let archive: Message[] = JSON.parse(fs.readFileSync('messages.json', "utf-8")).messages

  for (const [index, message] of archive.entries()) 
    message.index = index;
  
  if (req.query.noImages === 'on') for (let message of archive) if (message.image) delete message.image
  if (req.query.reverse === 'on') archive = archive.reverse()
  if (req.query.start && req.query.count) archive = archive.filter((_, index) => !(index < Number(req.query.start) || index >= (Number(req.query.count) + Number(req.query.start))))
  if (req.query.reverse === 'on') archive = archive.reverse() // intentional

  let result: string = fs.readFileSync('archive/view.html', 'utf-8');
  for (const [index, message] of archive.entries()) 
    result += `<p ${
      Number(req.query.focus) === message.index ? `style="background-color: yellow" ` : ''
    }title="${
      message.id
    }">[${
      index + ' / ' + message.index
    }] <i>${
      new Date(message.time).toLocaleString()
    }</i> <b>${
      message.author.name
    }${
      message.isWebhook ? ` (${message.sentBy})` : ''
    }${
      message.tag ? ` [${message.tag.text}]` : ''
    }:</b> ${
      message.text
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

app.post('/search', (req, res) => {
  let searchString = req.query.q || "";
  let results = searchMessages(searchString);
  res.json(results);
});

}

let sessions = new SessionManager();
server.removeAllListeners("upgrade")
server.on("upgrade", (req, socket, head) => {
  const userData = authUser.full(req.headers.cookie)
  if (typeof userData !== "boolean") { // If it is not this explicit typescript gets mad
    io.engine.handleUpgrade(req, socket, head);
    console.log(`${userData.name} has established a websocket connection`)
  } else {
    socket.destroy();
    console.log("Request to upgrade to websocket connection denied due to authentication failure")
  }
})

// interface Sessions {
//   [key: string]: {
//     name: string;
//     email: string;
//     socket: Socket; //if this line is giving you an error, press ctrl+shift+p and run 'Typescript: Restart TS server'
//     disconnect: (reason:string)=>any;
//   }
// }

// export let sessions: Sessions = {}
export let onlinelist: string[] = []

io.on("connection", (socket) => {
  const userData = authUser.full(socket.request.headers.cookie);
  if (typeof userData === "boolean") { socket.disconnect(); return }

  const session = new Session(userData);
  sessions.register(session);
  session.bindSocket(socket);


  socket.once("disconnecting", reason => { sessions.deregister(session.sessionId); console.log(`${userData.name} disconnecting due to ${reason}`) })

  socket.on("message", (data, respond) => {
      if (data.recipient!=="chat") data.archive = false
      const msg: Message = {
        text: data.text,
        author: {
          name: userData.name,
          img: users.images[userData.name]
        },
        time: new Date(new Date().toUTCString()),
        archive: data.archive,
        image: data.image,
        id: messages.length,
        channel: {
          to: data.recipient,
          origin: userData.name
        }
      }
      let autoModRes = autoMod(msg)
      switch (autoModRes) {
        case autoModResult.pass:
          respond(sendMessage(msg, data.recipient, socket))
          if (data.archive===true) messages.push(msg)
          if (data.recipient === 'chat') console.log(`Message from ${userData.name}: ${data.text} (${data.archive})`);
          break
        case autoModResult.kick: 
          socket.emit("auto-mod-update", autoModRes.toString())
          let auths = JSON.parse(fs.readFileSync("auths.json", "utf-8"))
          delete auths[userData.email]
          fs.writeFileSync("auths.json", JSON.stringify(auths))
          console.log(`${userData.name} has been kicked for spamming`)
          io.to("chat").emit('online-check', removeDuplicates(onlinelist).map(value=>{
          return {
            img: users.images[value],
            name: value
          }
          }))
          sessions[data.cookie].disconnect("You have been kicked for spamming. Please do not spam in the future.")
          break
        default: 
          socket.emit("auto-mod-update", autoModRes.toString())
          break
      }
  });

  socket.on("send-webhook-message", data => sendWebhookMessage(data.data));

  socket.on("delete-webhook", data => {
      for(let i in webhooks) {
        if (webhooks[i].name === data.webhookName) {
          webhooks.splice(i, 1);
          break;
        }
      }
      fs.writeFileSync("webhooks.json", JSON.stringify(webhooks, null, 2), 'utf8');
  
      const msg: Message = {
        text:
          `${userData.name} deleted the webhook ${data.webhookName}. `,
        author: {
          name: "Info",
          img:
            "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png",
        },
        time: new Date(new Date().toUTCString()),
        tag: {
          text: 'BOT',
          color: 'white',
          bg_color: 'black'
        }
      }
      sendMessage(msg);
      messages.push(msg);
      for (let userName of onlinelist) {
        sendOnLoadData(userName);
      }
  });

  socket.on("edit-webhook", data => {
      if (autoModText(data.webhookData.newName, 25) === autoModResult.pass) {
        let webhookData = data.webhookData;
        for (let i in webhooks) {
          if (webhooks[i].name === webhookData.oldName) {
            webhooks[i].name = webhookData.newName;
            webhooks[i].image = webhookData.newImage;
            break;
          }
        }
        fs.writeFileSync("webhooks.json", JSON.stringify(webhooks, null, 2), 'utf8');

        let userName = userData.name;
        const msg: Message = {
          text:
            `${userName} edited the webhook ${webhookData.oldName}. `,
          author: {
            name: "Info",
            img:
              "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png",
          },
          time: new Date(new Date().toUTCString()),
          tag: {
            text: 'BOT',
            color: 'white',
            bg_color: 'black'
          }
        }
        sendMessage(msg);
        messages.push(msg);

        for (let userName of onlinelist) {
          sendOnLoadData(userName);
        }
      }
  });

  socket.on("add-webhook", data => {
      if (autoModText(data.name, 50) === autoModResult.pass) {
        let webhook = {
          name: data.name,
          image: data.image,
          ids: {}
        };

        for (let user of Object.keys(users.images)) { /* Get the names of all the users */
          webhook.ids[user] = uuid.v4()
        }

        webhooks.push(webhook);
        fs.writeFileSync("webhooks.json", JSON.stringify(webhooks, null, 2), 'utf8');

        let userName = userData.name;

        const msg: Message = {
          text:
            `${userName} created webhook ${data.name}. `,
          author: {
            name: "Info",
            img:
              "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png",
          },
          time: new Date(new Date().toUTCString()),
          tag: {
            text: 'BOT',
            color: 'white',
            bg_color: 'black'
          }
        }
        sendMessage(msg);
        messages.push(msg);

        for (let userName of onlinelist) {
          sendOnLoadData(userName);
        }
      }
  });

  socket.on("logout", cookiestring=>{
    authUser.callback(cookiestring, 
      (authdata) => {
        console.log(`${authdata.name} has logged out.`)
        for (let session of Object.keys(sessions)) {
          if (sessions[session]?.email === authdata.email) {
            sessions[session].disconnect(`You are now logged out. To sign back in, reload your page.`)
          }
        }
      },
      ()=>console.log("Log Out Request Blocked"))
  })

  socket.on("delete-message", (messageID, id) => {
        if (messages[messageID]?.author.name!==userData.name) return
        messages[messageID] = {
          text: `Message deleted by author`,
          author: {
            name: 'Deleted',
            img: `Deleted`
          },
          time: messages[messageID].time,
          id: messageID,
          tag: {
            text: 'DELETED',
            color: 'white',
            bg_color: 'red'
          }
        }
        io.emit("message-deleted", messageID);
        updateArchive()
  });

  socket.on("edit-message", (data, id) => {
        if (messages[data.messageID]?.author.name!==userData.name) return;
        if (autoModText(data.text) !== autoModResult.pass)
        messages[data.messageID].text = data.text;
        messages[data.messageID].tag = {
          text: 'EDITED',
          color: 'white',
          bg_color: 'blue'
        }
        io.emit("message-edited", messages[data.messageID]);
        updateArchive()
  });

  socket.on('change-profile-pic', data => {
    authUser.callback(data.cookieString, authData => {
      users.images[authData.name] = data.img;
      fs.writeFileSync('users.json', JSON.stringify(users, null, 2), 'utf8');
      io.emit("profile-pic-edited", data);
    },
    () => console.log("Change Profile Picture Request Blocked"));
  });
});

app.post('/webhookmessage/:id', (req, res) => {
  if (!req.body.message) res.status(400).send();

  let webhook;
  outerLoop: for(let i = 0; i < webhooks.length; i++) {
    for(let key of Object.keys(webhooks[i].ids)) {
      if (webhooks[i].ids[key] == req.params.id) {
        webhook = webhooks[i];
        break outerLoop;
      }
    }
  }
  if (!webhook) res.status(401).send();

  sendWebhookMessage({
    id: req.params.id,
    text: req.body.message,
    archive: req.body.archive !== undefined ? req.body.archive : true,
    image: req.body.image
  });

  res.status(200).send();
});


server.listen(1234);

// fs.watch('users.json', _=>{
//   try {
//     users = JSON.parse(fs.readFileSync("users.json", "utf-8"));
//     console.log("Changed Users")
//   } catch {}
// })
