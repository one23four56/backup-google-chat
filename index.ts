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
  tag?: {
    color: string,
    text: string,
    bg_color: string,
  },
  image?: string
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
const sendMessage = (message: Message, chat: string = "chat"): void => {
  io.to(chat).emit("incoming-message", message);
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
const sendMessageFromAuthdata = (authdata: AuthData2, message: string, archive: boolean, image: string, pm: string = "chat"): Message => {
  const msg: Message = {
    text: message,
    author: {
      name: authdata.name,
      img: users.images[authdata.name],
    },
    time: new Date(new Date().toUTCString()),
    archive: archive,
    image: image
  }
  if (pm!=="chat") {
    msg["tag"] = {
      text: 'PRIVATE',
      color: 'white',
      bg_color: 'black'
    }
  }
  sendMessage(msg, pm);
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
      sentBy: messageSender,
      tag: {
        text: 'BOT',
        bg_color: "#C1C1C1",
        color: 'white'
      },
      image: data.image
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
        const msg = sendMessageFromAuthdata(authdata, data.text, data.archive, data.image, data.pm);
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
            tag: {
              text: 'BOT',
              color: 'white',
              bg_color: '#06bb14'
            }
          } 
          socket.emit('incoming-message', msg)
      } else {
        if (auto_mod_spammsg_sent===false) {
          warnings++
          if (warnings>3) {
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
              archive: data.archive,
              tag: {
                text: 'BOT',
                color: 'white',
                bg_color: '#06bb14'
              }
            } 
            sendMessage(msg)
            if (data.archive===true) messages.push(msg)
            sessions[data.cookie].disconnect("You have been kicked for spamming. Please do not spam in the future.")
          } else {
            auto_mod_spammsg_sent = true;
            const msg: Message = {
              text: `${authdata.name} please stop spamming (${warnings}/3)`,
              author: {
                name: 'Auto Moderator',
                img: 'https://jason-mayer.com/hosted/mod.png'
              },
              time: new Date(new Date().toUTCString()),
              archive: data.archive,
              tag: {
                text: 'BOT',
                color: 'white',
                bg_color: '#06bb14'
              }
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
  socket.on("disconnecting", (_) => {
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
  socket.on("start-pm-conversation", (id, target, respond)=>{
    auth(id,
      (authdata)=>{
        let target_socket: Socket;
        for (let session of Object.keys(sessions)) {
          if (sessions[session]?.name === target && target !== authdata.name) {
            target_socket = sessions[session].socket
          }
        }
        if (!target_socket) {respond({
          sent: false,
          reason: "Target was not found."
        });return}
        target_socket.emit("pm-request", authdata.name, res=>{
          if (!res) {respond({
            sent: true, 
            accepted: false
          });return}
          respond({
            sent:true,
            accepted:true
          })
          let pm_id: string = uuidv4()
          socket.join(pm_id)
          target_socket.join(pm_id)
          for (let session of Object.keys(sessions)) {
            if (sessions[session].name === target || sessions[session].name === authdata.name) {
              sessions[session].pm_id = pm_id
            }
          }
          io.to(pm_id).emit("pm-started", {
            id: pm_id, 
            members: [
              target,
              authdata.name
            ]
          })
          sendMessage({
            text: `Hello ${authdata.name} and ${target}, and welcome to pm#${pm_id}! Private messages function like normal messages, except that only you two will be able to see them. They are never saved to the archive and have the 'PRIVATE' tag. To send a private message open the webhook menu and select 'pm#${pm_id}'. To end the conversation, click the delete icon next to 'pm#${pm_id}' in the webhook menu. You can only be in one PM conversation at once. If the other person disconnects, the conversation will continue but they will not be able to rejoin it. This is a known bug and it is being fixed, so please do not report it.`,
            author: {
              name: 'PMBot',
              img: 'https://www.riccardos.net/assets/images/incognito.png'
            },
            time: new Date(new Date().toUTCString()),
            tag: {
              text: 'PRIVATE',
              bg_color: 'black',
              color: 'white'
            }
          }, pm_id)
        })
      },
      ()=>console.log("PM Conversation Request Blocked"))
  })
  socket.on("end-pm-conversation", (session_id, id)=>{
    auth(session_id, 
      (authdata)=>{
        io.to(id).emit("pm-ended", {
          id: id, 
          by: authdata.name
        })
        sendMessage({
          text: `pm#${id} has been ended by ${authdata.name}.`,
          author: {
            name: 'PMBot',
            img: 'https://www.riccardos.net/assets/images/incognito.png'
          },
          time: new Date(new Date().toUTCString()),
          tag: {
            text: 'PRIVATE',
            bg_color: 'black',
            color: 'white'
          }
        }, id)
        for (let session of Object.keys(sessions)) {
          if (sessions[session].pm_id === id) {
            delete sessions[session].pm_id
            sessions[session].socket.leave(id)
          }
        }
      },
      ()=>console.log("End PM Request Blocked"))
  })
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
