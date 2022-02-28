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
import { auth, removeDuplicates, sendMessage, sendOnLoadData, sendWebhookMessage, updateArchive, searchMessages } from './functions';
import { autoMod, autoModResult, autoModText } from "./automod";
import Users from "./lib/users";
import Message from './lib/msg'
import { runSignIn } from './handlers/signin'
import { authUser } from './auth';
import { runConnection } from './handlers/connection';
//--------------------------------------

messages.push = function () {
  Array.prototype.push.apply(this, arguments)
  updateArchive()
  return messages.length
}

app.get("/", (req, res) => {
  try {
    if (authUser.fromCookie.bool(req.headers.cookie) && authUser.deviceId(req.headers.cookie)) res.sendFile(path.join(__dirname, "talk/index.html"));
    else if (authUser.fromCookie.bool(req.headers.cookie) && !authUser.deviceId(req.headers.cookie)) res.redirect("/2fa");
    else res.sendFile(path.join(__dirname, "logon/index.html"));
  } catch {
    res.sendFile(path.join(__dirname, "logon/index.html"));
  }
});

/**
 * Requests to any path on this list will be let through the firewall
 * Paths on the list below can be accessed by anyone on the internet without authorization
 * Every path on the list below MUST have a justification next to it
 */
const auth_ignore_list = [
  "/logon/style.css", //The logon page would not work without this
  "/logon/logon.js", //The logon page would not work without this
  "/2fa", //It has its own auth system
]
/**
 * Requests to any path on this list will be served with a 401 response if not authorized
 * Normally they would be redirected to the login page
 * Paths on the list below do not need justification
 */
const auth_401_list = [
  "/archive.json"
]

app.use((req, res, next) => {
  const reject = () => auth_401_list.includes(req.originalUrl.toString()) ? res.status(401).send("Not Authorized") : res.redirect("/")
  try {
    if (!auth_ignore_list.includes(req.originalUrl.toString())) {
      if (authUser.fromCookie.bool(req.headers.cookie) && authUser.deviceId(req.headers.cookie)) next();
      if (authUser.fromCookie.bool(req.headers.cookie) && !authUser.deviceId(req.headers.cookie)) res.redirect("/2fa")
    } else next();
  } catch {
    reject()
  }
})

{
  //When you are too pro for app.use(express.static()) 😎
  app.get("/archive", (_, res) => {
    res.sendFile(path.join(__dirname, "archive/index.html"))
  })
  app.use(express.static("search"));
  app.get("/search", (_, res) => {
    res.sendFile(path.join(__dirname, "search/search.html"))
  });
  app.get("/logon/logon.js", (_, res) => {
    res.sendFile(path.join(__dirname, "logon/logon.js"));
  });
  app.get("/logon/style.css", (_, res) => {
    res.sendFile(path.join(__dirname, "logon/style.css"));
  });
  app.get("/talk/script.js", (_, res) => {
    res.sendFile(path.join(__dirname, "talk/script.js"));
  });
  app.get("/talk/style.css", (_, res) => {
    res.sendFile(path.join(__dirname, "talk/style.css"));
  });
  app.get("/archive/archive.js", (_, res) => {
    res.sendFile(path.join(__dirname, "archive/archive.js"));
  });
  app.get("/sounds/:name", (req, res) => {
    res.sendFile(req.params.name, {
      root: path.join(__dirname, 'sounds'),
      dotfiles: 'deny'
    }, err => {
      if (err) res.status(404).send(`The requested file was not found on the server.`)
    });
  });
  app.get('/archive.json', (req, res) => {
    let archive: Message[] = JSON.parse(fs.readFileSync('messages.json', "utf-8")).messages
    if (req.query.images === 'none') for (let message of archive) if (message.image) delete message.image
    if (req.query.reverse === 'true') archive = archive.reverse()
    if (req.query.start && req.query.count) archive = archive.filter((_, index) => !(index < Number(req.query.start) || index >= (Number(req.query.count) + Number(req.query.start))))
    res.send(JSON.stringify(archive))
  })
  app.get("/public/:name", (req, res) => {
    res.sendFile(req.params.name, {
      root: path.join(__dirname, 'public'),
      dotfiles: 'deny'
    }, err=>{
      if (err) res.status(404).send(`The requested file was not found on the server.`)
    });
  })
  app.get("/updates/:name", (req, res)=> {
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
  app.get("/updates", (req, res)=>{
    let response = `<head><title>Backup Google Chat Update Logs</title>`
    response += `<style>li {font-family:monospace} h1 {font-family:sans-serif}</style></head><h1>Backup Google Chat Update Logs</h1><ul>`
    const updates = JSON.parse(fs.readFileSync('updates.json', "utf-8"))
    for (const update of updates.reverse()) {
      response += `<li><a target="_blank" href="${update.logLink}">${update.releaseDate}.${update.patch}${update.patchReleaseDate ? `/${update.patchReleaseDate}${update.stabilityChar}` : update.stabilityChar}</a>: ${update.updateName} v${update.patch} ${update.stability}</li><br>`
    }
    response += `</ul>`
    res.send(response)
  })
}
app.get('/searchmessages', (req, res) => {
  let searchString = req.query.query || "";
  let results = searchMessages(searchString);
  res.json(results);
});
app.get('/archiveuptoindex', (req, res) => {
  let archive: Message[] = JSON.parse(fs.readFileSync('messages.json', "utf-8")).messages;
  let messageIndex = Number(req.query.index || 0);
  if (Number.isNaN(messageIndex)) res.status(400).send();
  let messages = archive.slice(Math.max(0, messageIndex - 20));
  for (let message of messages) {
    message.index = archive.indexOf(message);
  }
  res.json(messages);
});
interface Sessions {
  [key: string]: {
    name: string;
    email: string;
    socket: Socket; //if this line is giving you an error, press ctrl+shift+p and run 'Typescript: Restart TS server'
    disconnect: (reason:string)=>any;
  }
}
export let sessions: Sessions = {}
export let onlinelist: string[] = []
io.on("connection", (socket) => {
  socket.on("sign-in", (msg, callback)=> runSignIn(msg, callback, socket));
  socket.on("connected-to-chat", (cookiestring, respond) => runConnection(cookiestring, respond, socket));
  socket.on("message", (data, respond) => {
    auth(data?.cookie, (authdata) => {
      if (data.recipient!=="chat") data.archive = false
      const msg: Message = {
        text: data.text,
        author: {
          name: authdata.name,
          img: users.images[authdata.name]
        },
        time: new Date(new Date().toUTCString()),
        archive: data.archive,
        image: data.image,
        id: messages.length,
        channel: {
          to: data.recipient,
          origin: authdata.name
        }
      }
      let autoModRes = autoMod(msg)
      switch (autoModRes) {
        case autoModResult.pass:
          respond(sendMessage(msg, data.recipient, socket))
          if (data.archive===true) messages.push(msg)
          if (data.recipient === 'chat') console.log(`Message from ${authdata.name}: ${data.text} (${data.archive})`);
          break
        case autoModResult.kick: 
          socket.emit("auto-mod-update", autoModRes.toString())
          let auths = JSON.parse(fs.readFileSync("auths.json", "utf-8"))
          delete auths[authdata.email]
          fs.writeFileSync("auths.json", JSON.stringify(auths))
          console.log(`${authdata.name} has been kicked for spamming`)
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
    }, () => {
      console.log("Request Blocked");
    });
  });
  socket.on("send-webhook-message", data => {
    auth(data?.cookie, ()=>{
      sendWebhookMessage(data.data)
    }, ()=>{
      console.log(`Webhook Request Blocked`)
    })
  });
  socket.on("delete-webhook", data => {
    auth(data?.cookieString, (authdata)=>{
      for(let i in webhooks) {
        if (webhooks[i].name === data.webhookName) {
          webhooks.splice(i, 1);
          break;
        }
      }
      fs.writeFileSync("webhooks.json", JSON.stringify(webhooks, null, 2), 'utf8');
  
      const msg: Message = {
        text:
          `${authdata.name} deleted the webhook ${data.webhookName}. `,
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
    }, ()=>{
      console.log("Webhook Request Blocked")
    });
  });
  socket.on("edit-webhook", data => {
    auth(data?.cookieString, (authdata)=>{
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

        let userName = authdata.name;
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
    }, ()=>{
      console.log("Webhook Request Blocked")
    })
  });
  socket.on("add-webhook", data => {
    auth(data?.cookieString, (authdata)=>{
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

        let userName = authdata.name;

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
    }, ()=>{
      console.log("Webhook Request Blocked")
    })
  });
  socket.on("logout", cookiestring=>{
    authUser.fromCookie.callback(cookiestring, 
      ()=>console.log("Log Out Request Blocked"),
      (authdata)=>{
        console.log(`${authdata.name} has logged out.`)
        for (let session of Object.keys(sessions)) {
          if (sessions[session]?.email === authdata.email) {
            sessions[session].disconnect(`You are now logged out. To sign back in, reload your page.`)
          }
        }
      })
  })
  socket.on("delete-message", (messageID, id) => {
    auth(id, 
      (authdata)=>{
        if (messages[messageID]?.author.name!==authdata.name) return
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
      },
      ()=>console.log("Delete Message Request Blocked"))
  });
  socket.on("edit-message", (data, id) => {
    auth(id, 
      (authdata)=>{
        if (messages[data.messageID]?.author.name!==authdata.name) return;
        if (autoModText(data.text) !== autoModResult.pass)
        messages[data.messageID].text = data.text;
        messages[data.messageID].tag = {
          text: 'EDITED',
          color: 'white',
          bg_color: 'blue'
        }
        io.emit("message-edited", messages[data.messageID]);
        updateArchive()
      },
      ()=>console.log("Edit Message Request Blocked"))
  });
  socket.on('change-profile-pic', data => {
    authUser.fromCookie.callback(data.cookieString, () => console.log("Change Profile Picture Request Blocked"), authData => {
      users.images[authData.name] = data.img;
      fs.writeFileSync('users.json', JSON.stringify(users, null, 2), 'utf8');
      io.emit("profile-pic-edited", data);
    });
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

fs.watch('users.json', _=>{
  try {
    users = JSON.parse(fs.readFileSync("users.json", "utf-8"));
    console.log("Changed Users")
  } catch {}
})
