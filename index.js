"use strict";
exports.__esModule = true;
var express = require("express");
var app = express();
var http = require("http");
var server = http.createServer(app);
var socket_io_1 = require("socket.io");
var io = new socket_io_1.Server(server);
var path = require("path");
var cookie = require("cookie");
var fs = require("fs");
var users = JSON.parse(fs.readFileSync("users.json", "utf-8"));
var nodemailer = require("nodemailer");
require('dotenv').config();
var transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "chat.email.wfb@gmail.com",
        pass: process.env.EMAIL_PASS
    }
});
var crypto = require("crypto");
var node_fetch_1 = require("node-fetch");
var security_whurl = "https://chat.googleapis.com/v1/spaces/AAAAb3i9pAw/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=CuQAMuqFaOJtNNz2u-cWF_nWQQYThHDXp4KZlmxXmkg%3D";
var messages = JSON.parse(fs.readFileSync('messages.json', 'utf-8')).messages;
/**
 *
 * @param cookiestring The user to authorize's cookie
 * @param sucess A function that will be called on sucess
 * @param failure A function that will be called on failure
 */
var auth = function (cookiestring, sucess, failure) {
    try {
        var cookies = cookie.parse(cookiestring);
        if (cookies.name && cookies.authname && cookies.cdid) {
            var authdata = JSON.parse(fs.readFileSync("auths/" + cookies.authname + ".json", "utf-8"));
            if (authdata.name === cookies.name &&
                authdata.authname === cookies.authname && authdata.cdid === cookies.cdid) {
                sucess(authdata);
            }
            else
                failure();
        }
        else
            failure();
    }
    catch (_a) {
        failure();
    }
};
/**
 *
 * @param message The message to send
 */
var sendMessage = function (message) {
    io.emit("incoming-message", message);
};
/**
 *
 * @param authdata Authdata to generate the message from
 * @param message The text to send in the message
 */
var sendMessageFromAuthdata = function (authdata, message, archive) {
    var msg = {
        text: message,
        author: {
            name: authdata.name,
            img: users.images[authdata.name]
        },
        time: new Date(new Date().toUTCString()),
        archive: archive
    };
    sendMessage(msg);
    return msg;
};
var removeDuplicates = function (filter_array) { return filter_array.filter(function (value, index, array) { return index === array.findIndex(function (item) { return item === value; }); }); };
app.get("/", function (req, res) {
    try {
        var cookies = cookie.parse(req.headers.cookie);
        if (cookies.name && cookies.cdid && cookies.authname) {
            var authdata = JSON.parse(fs.readFileSync("auths/" + cookies.authname + ".json", "utf-8"));
            if (authdata.name === cookies.name && authdata.cdid === cookies.cdid) {
                res.sendFile(path.join(__dirname, "talk/index.html"));
            }
            else
                res.sendFile(path.join(__dirname, "logon/index.html"));
        }
        else {
            res.sendFile(path.join(__dirname, "logon/index.html"));
        }
    }
    catch (_a) {
        res.sendFile(path.join(__dirname, "logon/index.html"));
    }
});
{
    //When you are too pro for app.use(express.static()) 😎
    app.get("/logon/logon.js", function (_, res) {
        res.sendFile(path.join(__dirname, "logon/logon.js"));
    });
    app.get("/logon/style.css", function (_, res) {
        res.sendFile(path.join(__dirname, "logon/style.css"));
    });
    app.get("/talk/script.js", function (_, res) {
        res.sendFile(path.join(__dirname, "talk/script.js"));
    });
    app.get("/talk/style.css", function (_, res) {
        res.sendFile(path.join(__dirname, "talk/style.css"));
    });
    app.get("/sounds/msg.mp3", function (_, res) {
        res.sendFile(path.join(__dirname, "sounds/msg.mp3"));
    });
    app.get("/sounds/msg.wav", function (_, res) {
        res.sendFile(path.join(__dirname, "sounds/msg.wav"));
    });
    app.get("/sounds/msg.ogg", function (_, res) {
        res.sendFile(path.join(__dirname, "sounds/msg.ogg"));
    });
    app.get("/images/favicon.png", function (_, res) {
        res.sendFile(path.join(__dirname, "images/favicon.png"));
    });
    app.get('/archive.json', function (req, res) {
        //Add security to this later
        res.sendFile(path.join(__dirname, 'messages.json'));
    });
}
var onlinelist = [];
io.on("connection", function (socket) {
    var socketname;
    var messages_count = 0;
    var auto_mod_spammsg_sent = false;
    var max_msg = 5;
    var warnings = 0;
    var lastmessage = "";
    var messages_count_reset = setInterval(function () {
        messages_count = 0;
        auto_mod_spammsg_sent = false;
    }, 5000);
    var max_msg_reset = null;
    socket.on("email-sign-in", function (msg) {
        if (users.emails.includes(msg)) {
            var confcode_1 = crypto.randomBytes(8).toString("hex").substr(0, 6);
            transporter.sendMail({
                from: "Chat Email",
                to: msg,
                subject: "Verification Code",
                text: "Your six-digit verification code is: " + confcode_1
            }, function (err) {
                if (err)
                    socket.emit("unknown-err");
                else {
                    socket.emit("email-sent");
                    socket.once("confirm-code", function (code) {
                        if (code === confcode_1) {
                            var userdata = {
                                name: users.names[msg],
                                authname: users.authnames[users.names[msg]],
                                cdid: crypto.randomBytes(Math.pow(3, 4)).toString("base64")
                            };
                            fs.writeFileSync("auths/" + users.authnames[users.names[msg]] + ".json", JSON.stringify(userdata));
                            socket.emit("auth-done", userdata);
                        }
                        else
                            socket.emit("auth-failed");
                    });
                }
            });
        }
        else {
            socket.emit("bademail");
        }
    });
    socket.on("message", function (data) {
        auth(data.cookie, function (authdata) {
            if (messages_count < max_msg && data.text !== lastmessage) {
                var msg = sendMessageFromAuthdata(authdata, data.text, data.archive);
                lastmessage = data.text;
                if (data.archive === true)
                    messages.push(msg);
                console.log("Message from " + authdata.name + ": " + data.text + " (" + data.archive + ", " + messages_count + ")");
                messages_count++;
            }
            else if (data.text === lastmessage) {
                var msg = {
                    text: "Sorry, but to prevent spam you cannot send the same message twice. (Only you can see this message)",
                    author: {
                        name: 'Auto Moderator',
                        img: 'https://jason-mayer.com/hosted/mod.png'
                    },
                    time: new Date(new Date().toUTCString()),
                    archive: false
                };
                socket.emit('incoming-message', msg);
            }
            else {
                if (auto_mod_spammsg_sent === false) {
                    warnings++;
                    if (warnings > 3) {
                        fs.unlinkSync("auths/" + authdata.authname + ".json");
                        var msg = {
                            text: authdata.name + " has been kicked for spamming",
                            author: {
                                name: 'Auto Moderator',
                                img: 'https://jason-mayer.com/hosted/mod.png'
                            },
                            time: new Date(new Date().toUTCString()),
                            archive: data.archive
                        };
                        sendMessage(msg);
                        if (data.archive === true)
                            messages.push(msg);
                    }
                    else {
                        auto_mod_spammsg_sent = true;
                        var msg = {
                            text: authdata.name + " please stop spamming (" + warnings + "/3)",
                            author: {
                                name: 'Auto Moderator',
                                img: 'https://jason-mayer.com/hosted/mod.png'
                            },
                            time: new Date(new Date().toUTCString()),
                            archive: data.archive
                        };
                        sendMessage(msg);
                        if (data.archive === true)
                            messages.push(msg);
                        max_msg = 3;
                        clearInterval(max_msg_reset);
                        max_msg_reset = setTimeout(function () {
                            max_msg = 5;
                        }, 10000);
                    }
                }
            }
        }, function () {
            console.log("Request Blocked");
        });
    });
    socket.on("connected-to-chat", function (cookiestring) {
        auth(cookiestring, function (authdata) {
            socketname = authdata.name;
            onlinelist.push(socketname);
            var msg = {
                text: authdata.name + " connected \n Currently Online: " + removeDuplicates(onlinelist).join(', '),
                author: {
                    name: "Info",
                    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png"
                },
                time: new Date(new Date().toUTCString())
            };
            sendMessage(msg);
            messages.push(msg);
            io.emit('online-check', removeDuplicates(onlinelist).map(function (value) {
                return {
                    img: users.images[value],
                    name: value
                };
            }));
        }, function () {
            console.log("Request Blocked");
        });
    });
    socket.on("disconnect", function (_) {
        if (socketname) {
            for (var _i = 0, onlinelist_1 = onlinelist; _i < onlinelist_1.length; _i++) {
                var item = onlinelist_1[_i];
                if (item === socketname) {
                    var index = onlinelist.indexOf(item);
                    onlinelist.splice(index, 1);
                    break;
                }
            }
            var msg = {
                text: socketname + " disconnected \n Currently Online: " + removeDuplicates(onlinelist).join(', '),
                author: {
                    name: "Info",
                    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png"
                },
                time: new Date(new Date().toUTCString())
            };
            sendMessage(msg);
            messages.push(msg);
            clearInterval(messages_count_reset);
            io.emit('online-check', removeDuplicates(onlinelist).map(function (value) {
                return {
                    img: users.images[value],
                    name: value
                };
            }));
        }
    });
    socket.on("page-locked", function (cookiestring) {
        auth(cookiestring, function (authdata) {
            var msg = {
                text: authdata.name + " has locked their chat. If someone starts talking as " + authdata.name + ", it is probably not them. ",
                author: {
                    name: "Info",
                    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png"
                },
                time: new Date(new Date().toUTCString())
            };
            sendMessage(msg);
            messages.push(msg);
        }, function () {
            console.log("Unauthed lock message blocked");
        });
    });
    socket.on("page-unlocked", function (cookiestring) {
        auth(cookiestring, function (authdata) {
            var msg = {
                text: authdata.name + " has unlocked their chat. If someone starts talking as " + authdata.name + ", it is probably them. ",
                author: {
                    name: "Info",
                    img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png"
                },
                time: new Date(new Date().toUTCString())
            };
            sendMessage(msg);
            messages.push(msg);
        }, function () {
            console.log("Unauthed unlock message blocked");
        });
    });
    socket.on('tamper-lock-broken', function (cookiestring) {
        auth(cookiestring, function (authdata) {
            console.log(1);
            sendMessage({
                text: "Tamper Lock broken! Someone is likely trying to get into " + authdata.name + "'s account!",
                author: {
                    name: 'Info',
                    img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png'
                },
                time: new Date(new Date().toUTCString())
            });
            node_fetch_1["default"](security_whurl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    'cards': [
                        {
                            'header': {
                                'title': "Suspicious activity detected on " + authdata.name + "'s computer.",
                                'imageUrl': 'http://cdn.onlinewebfonts.com/svg/img_157736.png'
                            }
                        }
                    ]
                })
            });
        }, function () {
            console.log('Tamper lock auth failed');
        });
    });
});
setInterval(function () {
    fs.writeFile('messages.json', JSON.stringify({
        messages: messages
    }), function () {
        io.emit('archive-updated');
    });
}, 15000);
server.listen(1234);
fs.watch('users.json', function (_) {
    try {
        users = JSON.parse(fs.readFileSync("users.json", "utf-8"));
        console.log("Changed Users");
    }
    catch (_a) { }
});
