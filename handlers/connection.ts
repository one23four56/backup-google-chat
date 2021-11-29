import * as crypto from 'crypto';
import * as cookie from 'cookie';
import { io, onlinelist, sessions, users, webhooks } from "..";
import { authUser } from "../auth";
import { removeDuplicates, sendConnectionMessage } from '../functions';
//--------------------------------------


export const runConnection = (cookiestring, respond, socket) => {
    authUser.fromCookie.callback(cookiestring,
        () => {
            console.log("Connection Request Blocked")
            respond({
                created: false,
                reason: `A session could not be created because authorization failed. \nTry reloading your page.`
            })
        },
        (authdata) => {
            let socketname; 
            let id;
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
                socket: socket,
                disconnect: (reason) => {
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
            io.to("chat").emit('online-check', removeDuplicates(onlinelist).map(value => {
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
                        io.to("chat").emit('online-check', removeDuplicates(onlinelist).map(value => {
                            return {
                                img: users.images[value],
                                name: value
                            }
                        }))
                    }
                } catch { console.log("Error on Disconnect") }
            });

        });
}