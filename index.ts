import express = require("express");
const app = express();
import http = require("http");
const server = http.createServer(app);
import { Server, Socket } from "socket.io";
const io = new Server(server);
import path = require("path");
import * as cookie from "cookie";
import fs = require("fs");
let users: Users = JSON.parse(fs.readFileSync("users.json", "utf-8"));
let webhooks = JSON.parse(fs.readFileSync("webhooks.json", "utf8"));
import nodemailer = require("nodemailer");
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config()
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS,
  },
});
import crypto = require("crypto");
import AuthData2 from "./lib/authdata";
import { autoMod, autoModResult } from "./automod";
import Users from "./lib/users";
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
export interface Message {
  text: string;
  author: {
    name: string;
    img: string;
  };
  time: Date;
  archive?: boolean;
  isWebhook?: boolean;
  sentBy?: string;
  tag?: {
    color: string,
    text: string,
    bg_color: string,
  },
  image?: string,
  id?: number,
  channel?: {
    to: string, 
    origin: string
  },
  mute?: boolean,
}
let messages: Message[] = JSON.parse(fs.readFileSync('messages.json', 'utf-8')).messages;
const updatearchive = () => {
  fs.writeFile('messages.json', JSON.stringify({
    messages: messages
  }), ()=>{
    io.to("chat").emit('archive-updated')
  })
}
messages.push = function() {
  Array.prototype.push.apply(this, arguments)
  updatearchive()
  return messages.length
}
/**
 *  
 * @param cookiestring The user to authorizes' cookie
 * @param success A function that will be called on success
 * @param failure A function that will be called on failure
 */
const auth_cookiestring = (
  cookiestring: string,
  failure: () => any,
  success: (authdata?: AuthData2) => any, 
  ) => {
  try {
    let auths = JSON.parse(fs.readFileSync("auths.json", "utf-8"))
    let cookies = cookie.parse(cookiestring)
    if (cookies.name && cookies.email && cookies.mpid ) {
      if (
        auths[cookies.email]?.name === cookies.name &&
        auths[cookies.email]?.mpid === cookies.mpid
        ) {
          success({
            name: cookies.name,
            email: cookies.email,
            mpid: cookies.mpid
          })
        } else throw "failure"
    } else throw "failure"
  } catch {
    failure()
  }
}
const auth = (
  session_id: string, 
  success: (authdata?: AuthData2) => void,
  failure: () => void,
  ) => {
    try {
      if (sessions[session_id]) {
        success({
          name: sessions[session_id].name, 
          email: sessions[session_id].email, 
          mpid: sessions[session_id].name
        })
      } else throw "failure"
    } catch {
      failure()
    }
}
/**
 *  Sends a message 
 * @param message The message to send.
 * @param channel The channel to send the message on. Optional.
 * @param socket The socket to emit from. If not specified, it will broadcast to all.
 * @returns The message that was just sent.
 */
const sendMessage = (message: Message, channel: string = "chat", socket?): Message => {
  if (socket) socket.to(channel).emit("incoming-message", message);
  else io.to(channel).emit("incoming-message", message);
  return message
}
const sendConnectionMessage = (name: string, connection: boolean) => {
  io.to("chat").emit("connection-update", {
    connection: connection, 
    name: name
  })
}


const removeDuplicates = (filter_array: string[]) => filter_array.filter((value, index, array)=>index===array.findIndex(item=>item===value)) 

function sendWebhookMessage(data) {
  let webhook;
    let messageSender;
    outerLoop: for(let i = 0; i < webhooks.length; i++) {
      for(let key of Object.keys(webhooks[i].ids)) {
        if (webhooks[i].ids[key] == data.id) {
          webhook = webhooks[i];
          messageSender = key;
          break outerLoop;
        }
      }
    }
    if (!webhook) return;

    const msg: Message = {
      text: data.text,
      author: {
        name: webhook.name,
        img: webhook.image,
      },
      time: new Date(new Date().toUTCString()),
      archive: data.archive,
      isWebhook: true,
      sentBy: messageSender,
      tag: {
        text: 'BOT',
        bg_color: "#C1C1C1",
        color: 'white'
      },
      image: data.image
    }


    if (webhook.lastmessage) {
      if ((webhook.lastmessage.text!==data.text)&&((Date.parse(new Date().toUTCString())-Date.parse(webhook.lastmessage.time))>500)) {
        sendMessage(msg);
        if (msg.archive) messages.push(msg);
        webhook.lastmessage = msg
        console.log(`Webhook Message from ${webhook.name} (${messageSender}): ${data.text} (${data.archive})`)
      }
    } else {
      sendMessage(msg);
      if (msg.archive) messages.push(msg);
      webhook.lastmessage = msg
      console.log(`Webhook Message from ${webhook.name} (${messageSender}): ${data.text} (${data.archive})`)
    }
}

function sendOnLoadData(userName) {
  let userImage = users.images[userName];
    
  let webhooksData = [];
  for (let i = 0; i < webhooks.length; i++) {
    let data = {
      name: webhooks[i].name,
      image: webhooks[i].image,
      id: webhooks[i].ids[userName]
    }
    webhooksData.push(data);
  }

  io.to("chat").emit('onload-data', {
    image: userImage,
    name: userName,
    webhooks: webhooksData,
    userName
  });
}

app.get("/", (req, res) => {
  try {
    auth_cookiestring(req.headers.cookie, 
    ()=>res.sendFile(path.join(__dirname, "logon/index.html")),
    ()=>res.sendFile(path.join(__dirname, "talk/index.html")),)
  } catch {
    res.sendFile(path.join(__dirname, "logon/index.html"));
  }
});

app.get("/archive", (req, res) => {
  try {
    auth_cookiestring(req.headers.cookie,
      ()=>res.status(401).send("Not Authorized"),
      ()=>res.sendFile(path.join(__dirname, "archive/index.html")))
  } catch {
    res.status(401).send("Not Authorized")
  }
})

/**
 * Requests to any path on this list will be let through the firewall
 * Paths on the list below can be accessed by anyone on the internet without authorization
 * Every path on the list below MUST have a justification next to it
 */
const auth_ignore_list = [
  "/logon/style.css", //The logon page would not work without this
  "/logon/logon.js", //The logon page would not work without this
  "/archive.json" //Archive has its own auth system, which works better when accessed programmatically 
]

app.use((req, res, next) => {
  if (!auth_ignore_list.includes(req.originalUrl.toString())) {
    auth_cookiestring(req.headers.cookie,
      () => res.redirect("/"),
      () => next()
    )
  } else next();
})

{
  //When you are too pro for app.use(express.static()) 😎
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
  app.get('/archive.json', (req, res)=>{
    try {
      auth_cookiestring(req.headers.cookie,
        ()=>res.status(401).send("Not Authorized"),
        ()=>{
          let archive: Message[] = JSON.parse(fs.readFileSync('messages.json', "utf-8")).messages
          if (req.query.images==='none') for (let message of archive) if (message.image) delete message.image
          if (req.query.reverse==='true') archive = archive.reverse()
          if (req.query.start&&req.query.count) archive = archive.filter((_, index)=>!(index<Number(req.query.start)||index>=(Number(req.query.count)+Number(req.query.start))))
          res.send(JSON.stringify(archive))
        })
    } catch {
      res.status(401).send("Not Authorized")
    }
  })
  app.get("/public/:name", (req, res) => {
    res.sendFile(req.params.name, {
      root: path.join(__dirname, 'public'),
      dotfiles: 'deny'
    }, err=>{
      if (err) res.status(404).send(`The requested file was not found on the server.`)
    });
  })
}
let sessions = {}
let onlinelist: string[] = []
io.on("connection", (socket) => {
  let id: string; 
  let socketname: string;
  socket.on("email-sign-in", (msg, callback) => {
    if (users.emails.includes(msg)) {
      const confcode = crypto.randomBytes(8).toString("hex").substr(0, 6);
      transporter.sendMail({
        from: "Chat Email",
        to: msg,
        subject: "Verification Code",
        text: `Your six-digit verification code is: ${confcode}`,
      }, (err) => {
        if (err) callback("send_err")
        else {
          callback("sent")
          socket.once("confirm-code", (code, respond) => {
            if (code === confcode) {
              let auths = JSON.parse(fs.readFileSync("auths.json", "utf-8"))
              let mpid = crypto.randomBytes(4 ** 4).toString("base64");
              auths[msg] = {
                name: users.names[msg],
                mpid: mpid
              }
              fs.writeFileSync("auths.json", JSON.stringify(auths))
              respond({
                status: "auth_done",
                data: {
                  name: users.names[msg],
                  email: msg,
                  mpid: mpid
                }
              })
            } else respond({
              status: "auth_failed"
            })
          });
        }
      });
    } else {
      callback("bad_email")
    }
  });
  socket.on("message", (data, respond) => {
    auth(data.cookie, (authdata) => {
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
        case autoModResult.same:
          socket.emit("auto-mod-update", autoModRes.toString())
          break
        case autoModResult.spam:
          socket.emit("auto-mod-update", autoModRes.toString())
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
      }
    }, () => {
      console.log("Request Blocked");
    });
  });
  socket.on("send-webhook-message", data => {
    auth(data.cookie, ()=>{
      sendWebhookMessage(data.data)
    }, ()=>{
      console.log(`Webhook Request Blocked`)
    })
  });
  socket.on("connected-to-chat", (cookiestring, respond) => {
    auth_cookiestring(cookiestring,
      () => {
        console.log("Connection Request Blocked")
        respond({
          created: false,
          reason: `A session could not be created because authorization failed. \nTry reloading your page.`
        })
      }, 
      (authdata) => {
      for (let session of Object.keys(sessions)) {
        if (sessions[session]?.email === authdata.email) {
          respond({
            created: false,
            reason: `A session could not be created because another session is already open on this account. Please use that one instead. If you cannot access that session for whatever reason, click the 'Log Out' button to disconnect it. `
          })
          return 
        }
      }
      let session_id = crypto.randomBytes(3 ** 4).toString("base64")
      sessions[session_id] = {
        name: authdata.name,
        email: authdata.email, 
        mpid: authdata.mpid,
        socket: socket,
        disconnect: (reason)=>{
          socket.emit('forced_disconnect', reason)
          delete sessions[session_id]
          socket.disconnect(true)
        }
      }
      id = session_id;
      console.log(`${authdata.name} created a new session`)
      respond({
        created: true, 
        id: session_id
      })
      socket.join('chat')
      socket.join(authdata.name)
      socketname = authdata.name;
      onlinelist.push(socketname) 
      sendConnectionMessage(authdata.name, true)
      io.to("chat").emit('online-check', removeDuplicates(onlinelist).map(value=>{
        return {
          img: users.images[value],
          name: value
        }
      }))
      let userName = cookie.parse(cookiestring).name;
      let userImage = users.images[userName];
    
      let webhooksData = [];
      for (let i = 0; i < webhooks.length; i++) {
        let data = {
          name: webhooks[i].name,
          image: webhooks[i].image,
          id: webhooks[i].ids[userName]
        }
        webhooksData.push(data);
      }
  
      io.to("chat").emit('onload-data', {
        image: userImage,
        name: userName,
        webhooks: webhooksData,
        userName: cookie.parse(cookiestring).name
      });
  
    });
  });
  socket.on("disconnect", (_) => {
    try {
      if (socketname && id) {
        for (let item of onlinelist) {
          if (item === socketname) {
            let index = onlinelist.indexOf(item)
            onlinelist.splice(index, 1)
            break
          }
        }
        sendConnectionMessage(socketname, false)
        console.log(`${sessions[id].name} ended a session`)
        delete sessions[id]
        io.to("chat").emit('online-check', removeDuplicates(onlinelist).map(value=>{
          return {
            img: users.images[value],
            name: value
          }
        }))
      }
    } catch {console.log("Error on Disconnect")}
  });
  socket.on("delete-webhook", data => {
    auth(data.cookieString, (authdata)=>{
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
    }, ()=>{
      console.log("Webhook Request Blocked")
    });

    for(let userName of onlinelist) {
      sendOnLoadData(userName);
    }
  });
  socket.on("edit-webhook", data => {
    auth(data.cookieString, (authdata)=>{
      let webhookData = data.webhookData;
      for(let i in webhooks) {
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

      for(let userName of onlinelist) {
        sendOnLoadData(userName);
      }
    }, ()=>{
      console.log("Webhook Request Blocked")
    })
  });
  socket.on("add-webhook", data => {
    auth(data.cookieString, (authdata)=>{
      let webhook = {
        name: data.name,
        image: data.image,
        ids: {}
      };
  
      for(let user of Object.keys(users.images)) { /* Get the names of all the users */
        webhook.ids[user] = uuidv4();
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

      for(let userName of onlinelist) {
        sendOnLoadData(userName);
      }
    }, ()=>{
      console.log("Webhook Request Blocked")
    })
  });
  socket.on("logout", cookiestring=>{
    auth_cookiestring(cookiestring, 
      ()=>console.log("Log Out Request Blocked"),
      (authdata)=>{
        let auths = JSON.parse(fs.readFileSync("auths.json", "utf-8"))
        delete auths[authdata.email]
        fs.writeFileSync("auths.json", JSON.stringify(auths))
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
        updatearchive()
      },
      ()=>console.log("Delete Message Request Blocked"))
  });
  socket.on("edit-message", (data, id) => {
    auth(id, 
      (authdata)=>{
        if (messages[data.messageID]?.author.name!==authdata.name) return;
        messages[data.messageID].text = data.text;
        messages[data.messageID].tag = {
          text: 'EDITED',
          color: 'white',
          bg_color: 'blue'
        }
        io.emit("message-edited", messages[data.messageID]);
        updatearchive()
      },
      ()=>console.log("Edit Message Request Blocked"))
  });
  socket.on('change-profile-pic', data => {
    auth_cookiestring(data.cookieString, () => console.log("Change Profile Picture Request Blocked"), authData => {
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
