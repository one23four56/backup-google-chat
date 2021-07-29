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
import AuthData from "./lib/authdata";
import Users from "./lib/users";
import fetch from 'node-fetch';
const security_whurl: string = "https://chat.googleapis.com/v1/spaces/AAAAb3i9pAw/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=CuQAMuqFaOJtNNz2u-cWF_nWQQYThHDXp4KZlmxXmkg%3D"
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
 * @param cookiestring The user to authorize's cookie
 * @param sucess A function that will be called on sucess
 * @param failure A function that will be called on failure
 */
const auth = (
  cookiestring: string | null,
  sucess: (authdata: AuthData) => void,
  failure: () => void,
): void => {
  try {
    const cookies = cookie.parse(cookiestring);
    if (cookies.name && cookies.authname && cookies.cdid) {
      const authdata: AuthData = JSON.parse(
        fs.readFileSync(`auths/${cookies.authname}.json`, "utf-8"),
      );
      if (
        authdata.name === cookies.name &&
        authdata.authname === cookies.authname && authdata.cdid === cookies.cdid
      ) {
        sucess(authdata);
      } else failure();
    } else failure();
  } catch {
    failure();
  }
};
/**
 * 
 * @param message The message to send
 */
const sendMessage = (message: Message): void => {
  io.emit("incoming-message", message);
};
const sendConnectionMessage = (name: string, connection: boolean) => {
  io.emit("connection-update", {
    connection: connection, 
    name: name
  })
}
/**
 * 
 * @param authdata Authdata to generate the message from 
 * @param message The text to send in the message
 */
const sendMessageFromAuthdata = (authdata: AuthData, message: string, archive: boolean): Message => {
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

  io.emit('onload-data', {
    image: userImage,
    name: userName,
    webhooks: webhooksData,
    userName
  });
}

app.get("/", (req, res) => {
  try {
    const cookies = cookie.parse(req.headers.cookie);
    if (cookies.name && cookies.cdid && cookies.authname) {
      const authdata = JSON.parse(
        fs.readFileSync(`auths/${cookies.authname}.json`, "utf-8"),
      );
      if (authdata.name === cookies.name && authdata.cdid === cookies.cdid) {
        res.sendFile(path.join(__dirname, "talk/index.html"));
      } else res.sendFile(path.join(__dirname, "logon/index.html"));
    } else {
      res.sendFile(path.join(__dirname, "logon/index.html"));
    }
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
let onlinelist: string[] = []
io.on("connection", (socket) => {
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
  socket.on("email-sign-in", (msg) => {
    if (users.emails.includes(msg)) {
      const confcode = crypto.randomBytes(8).toString("hex").substr(0, 6);
      transporter.sendMail({
        from: "Chat Email",
        to: msg,
        subject: "Verification Code",
        text: `Your six-digit verification code is: ${confcode}`,
      }, (err) => {
        if (err) socket.emit("unknown-err");
        else {
          socket.emit("email-sent");
          socket.once("confirm-code", (code) => {
            if (code === confcode) {
              const userdata: AuthData = {
                name: users.names[msg],
                authname: users.authnames[users.names[msg]],
                cdid: crypto.randomBytes(3 ** 4).toString("base64"),
              };
              fs.writeFileSync(
                `auths/${users.authnames[users.names[msg]]}.json`,
                JSON.stringify(userdata),
              );
              socket.emit("auth-done", userdata);
            } else socket.emit("auth-failed");
          });
        }
      });
    } else {
      socket.emit("bademail");
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
            fs.unlinkSync(`auths/${authdata.authname}.json`)
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
  socket.on("connected-to-chat", (cookiestring) => {
    auth(cookiestring, (authdata) => {
      socketname = authdata.name;
      onlinelist.push(socketname) 
      sendConnectionMessage(authdata.name, true)
      io.emit('online-check', removeDuplicates(onlinelist).map(value=>{
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
  
      io.emit('onload-data', {
        image: userImage,
        name: userName,
        webhooks: webhooksData,
        userName: cookie.parse(cookiestring).name
      });
  
    }, () => {
      console.log("Request Blocked");
    });
  });
  socket.on("disconnect", (_) => {
    if (socketname) {
      for (let item of onlinelist) {
        if (item === socketname) {
          let index = onlinelist.indexOf(item)
          onlinelist.splice(index, 1)
          break
        }
      }
      sendConnectionMessage(socketname, false)
      clearInterval(messages_count_reset)
      io.emit('online-check', removeDuplicates(onlinelist).map(value=>{
        return {
          img: users.images[value],
          name: value
        }
      }))
    }
  });
  socket.on("page-locked", (cookiestring) => {
    auth(cookiestring, (authdata) => {
      const msg: Message = {
        text:
          `${authdata.name} has locked their chat. If someone starts talking as ${authdata.name}, it is probably not them. `,
        author: {
          name: "Info",
          img:
            "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png",
        },
        time: new Date(new Date().toUTCString())
      }
      sendMessage(msg);
      messages.push(msg)
    }, () => {
      console.log("Unauthed lock message blocked");
    });
  });
  socket.on("page-unlocked", (cookiestring) => {
    auth(cookiestring, (authdata) => {
      const msg: Message = {
        text:
          `${authdata.name} has unlocked their chat. If someone starts talking as ${authdata.name}, it is probably them. `,
        author: {
          name: "Info",
          img:
            "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png",
        },
        time: new Date(new Date().toUTCString())
      }
      sendMessage(msg);
      messages.push(msg)
    }, () => {
      console.log("Unauthed unlock message blocked");
    });
  });
  socket.on('tamper-lock-broken', (cookiestring)=>{
    auth(cookiestring, authdata=>{
      console.log(1)
      sendMessage({
        text: `Tamper Lock broken! Someone is likely trying to get into ${authdata.name}'s account!`,
        author: {
          name: 'Info',
          img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png'
        },
        time: new Date(new Date().toUTCString())
      })
      fetch(security_whurl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          'cards': [
            {
              'header': {
                'title': `Suspicious activity detected on ${authdata.name}'s computer.`,
                'imageUrl': 'http://cdn.onlinewebfonts.com/svg/img_157736.png'
              }
            }
          ]
        })
      })
    }, ()=>{
      console.log('Tamper lock auth failed')
    })
  })

  socket.on("delete-webhook", data => {
    auth(data.cookieString, ()=>{
      for(let i in webhooks) {
        if (webhooks[i].name === data.webhookName) {
          webhooks.splice(i, 1);
          break;
        }
      }
      fs.writeFileSync("webhooks.json", JSON.stringify(webhooks, null, 2), 'utf8');
  
      const msg: Message = {
        text:
          `${cookie.parse(data.cookieString).name} deleted the webhook ${data.webhookName}. `,
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
    auth(data.cookieString, ()=>{
      let webhookData = data.webhookData;
      for(let i in webhooks) {
        if (webhooks[i].name === webhookData.oldName) {
          webhooks[i].name = webhookData.newName;
          webhooks[i].image = webhookData.newImage;
          break;
        }
      }
      fs.writeFileSync("webhooks.json", JSON.stringify(webhooks, null, 2), 'utf8');
  
      let userName = cookie.parse(data.cookieString).name;
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
    auth(data.cookieString, ()=>{
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
    
      let cookies = cookie.parse(data.cookieString);
      let userName = cookies.name;
  
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
    io.emit('archive-updated')
  })
}, 15000)

server.listen(1234);

fs.watch('users.json', _=>{
  try {
    users = JSON.parse(fs.readFileSync("users.json", "utf-8"));
    console.log("Changed Users")
  } catch {}
})
