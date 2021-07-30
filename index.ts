import express = require("express");
const app = express();
import http = require("http");
const server = http.createServer(app);
import { Server } from "socket.io";
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
import Users from "./lib/users";
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
interface Message {
  text: string;
  author: {
    name: string;
    img: string;
  };
  time: Date;
  archive?: boolean;
  isWebhook?: boolean;
  sentBy?: string;
}
let messages: Message[] = JSON.parse(fs.readFileSync('messages.json', 'utf-8')).messages;
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
 * 
 * @param message The message to send
 */
const sendMessage = (message: Message): void => {
  io.to("chat").emit("incoming-message", message);
};
const sendConnectionMessage = (name: string, connection: boolean) => {
  io.to("chat").emit("connection-update", {
    connection: connection, 
    name: name
  })
}
/**
 * 
 * @param authdata Authdata to generate the message from 
 * @param message The text to send in the message
 */
const sendMessageFromAuthdata = (authdata: AuthData2, message: string, archive: boolean): Message => {
  const msg: Message = {
    text: message,
    author: {
      name: authdata.name,
      img: users.images[authdata.name],
    },
    time: new Date(new Date().toUTCString()),
    archive: archive
  }
  sendMessage(msg);
  return msg;
};
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
      sentBy: messageSender
    }

    if (msg.archive) messages.push(msg);

    if (webhook.lastmessage) {
      if ((webhook.lastmessage.text!==data.text)&&((Date.parse(new Date().toUTCString())-Date.parse(webhook.lastmessage.time))>1000)) {
        sendMessage(msg);
        webhook.lastmessage = msg
        console.log(`Webhook Message from ${webhook.name} (${messageSender}): ${data.text} (${data.archive})`)
      }
    } else {
      sendMessage(msg);
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
    (authdata)=>res.sendFile(path.join(__dirname, "talk/index.html")),)
  } catch {
    res.sendFile(path.join(__dirname, "logon/index.html"));
  }
});

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
  app.get("/sounds/msg.mp3", (_, res) => {
    res.sendFile(path.join(__dirname, "sounds/msg.mp3"));
  });
  app.get("/sounds/msg.wav", (_, res) => {
    res.sendFile(path.join(__dirname, "sounds/msg.wav"));
  });
  app.get("/sounds/msg.ogg", (_, res) => {
    res.sendFile(path.join(__dirname, "sounds/msg.ogg"));
  });
  app.get("/images/favicon.png", (_, res) => {
    res.sendFile(path.join(__dirname, "images/favicon.png"));
  });
  app.get('/archive.json', (req, res)=>{
    //Add security to this later
    res.sendFile(path.join(__dirname, 'messages.json'))
  })
}
let sessions = {}
let onlinelist: string[] = []
io.on("connection", (socket) => {
  let id: string; 
  let socketname: string;
  let messages_count: number = 0;
  let auto_mod_spammsg_sent: boolean = false;
  let max_msg: number = 5;
  let warnings: number = 0;
  let lastmessage: string = "";
  let messages_count_reset = setInterval(()=>{
    messages_count = 0;
    auto_mod_spammsg_sent = false;
  }, 5000)
  let max_msg_reset: NodeJS.Timeout | null = null;
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
  socket.on("message", (data) => {
    auth(data.cookie, (authdata) => {
      if (messages_count<max_msg&&data.text!==lastmessage) {
        const msg = sendMessageFromAuthdata(authdata, data.text, data.archive);
        lastmessage = data.text
        if (data.archive===true) messages.push(msg)
        console.log(`Message from ${authdata.name}: ${data.text} (${data.archive}, ${messages_count})`);
        messages_count++
      } else if (data.text===lastmessage) {
          const msg: Message = {
            text: `Sorry, but to prevent spam you cannot send the same message twice. (Only you can see this message)`,
            author: {
              name: 'Auto Moderator',
              img: 'https://jason-mayer.com/hosted/mod.png'
            },
            time: new Date(new Date().toUTCString()),
            archive: false, 
          } 
          socket.emit('incoming-message', msg)
      } else {
        if (auto_mod_spammsg_sent===false) {
          warnings++
          if (warnings>3) {
            delete sessions[data.cookie]
            let auths = JSON.parse(fs.readFileSync("auths.json", "utf-8"))
            delete auths[authdata.email]
            fs.writeFileSync("auths.json", JSON.stringify(auths))
            console.log(`${authdata.name} has been kicked for spamming`)
            const msg: Message = {
              text: `${authdata.name} has been kicked for spamming`,
              author: {
                name: 'Auto Moderator',
                img: 'https://jason-mayer.com/hosted/mod.png'
              },
              time: new Date(new Date().toUTCString()),
              archive: data.archive
            } 
            sendMessage(msg)
            if (data.archive===true) messages.push(msg)
            socket.disconnect()
          } else {
            auto_mod_spammsg_sent = true;
            const msg: Message = {
              text: `${authdata.name} please stop spamming (${warnings}/3)`,
              author: {
                name: 'Auto Moderator',
                img: 'https://jason-mayer.com/hosted/mod.png'
              },
              time: new Date(new Date().toUTCString()),
              archive: data.archive
            } 
            sendMessage(msg)
            if (data.archive===true) messages.push(msg)
            max_msg = 3
            clearInterval(max_msg_reset)
            max_msg_reset = setTimeout(()=>{
              max_msg = 5
            }, 10000)
          }
        }
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
          reason: `A session could not be created because authorization failed. This may occur due to another session already being open.`
        })
      }, 
      (authdata) => {
      for (let session in Object.keys(sessions)) {
        if (sessions[session].email === authdata.email) {
          return 
        }
      }
      let session_id = crypto.randomBytes(3 ** 4).toString("base64")
      sessions[session_id] = {
        name: authdata.name,
        email: authdata.email, 
        mpid: authdata.mpid,
        socket: socket
      }
      id = session_id;
      console.log(`${authdata.name} created a new session`)
      respond({
        created: true, 
        id: session_id
      })
      socket.join('chat')
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
    if (socketname && id) {
      for (let item of onlinelist) {
        if (item === socketname) {
          let index = onlinelist.indexOf(item)
          onlinelist.splice(index, 1)
          break
        }
      }
      sendConnectionMessage(socketname, false)
      clearInterval(messages_count_reset)
      console.log(`${sessions[id].name} ended a session`)
      delete sessions[id]
      io.to("chat").emit('online-check', removeDuplicates(onlinelist).map(value=>{
        return {
          img: users.images[value],
          name: value
        }
      }))
    }
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
        time: new Date(new Date().toUTCString())
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
        time: new Date(new Date().toUTCString())
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
  
      for(let user of Object.keys(users.authnames)) {
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
        time: new Date(new Date().toUTCString())
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
    archive: req.body.archive !== undefined ? req.body.archive : true
  });

  res.status(200).send();
});

setInterval(()=>{
  fs.writeFile('messages.json', JSON.stringify({
    messages: messages
  }), ()=>{
    io.to("chat").emit('archive-updated')
  })
}, 15000)

server.listen(1234);

fs.watch('users.json', _=>{
  try {
    users = JSON.parse(fs.readFileSync("users.json", "utf-8"));
    console.log("Changed Users")
  } catch {}
})
