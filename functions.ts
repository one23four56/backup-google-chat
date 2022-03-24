import * as fs from 'fs';
import * as cookie from 'cookie';
import Message from "./lib/msg";
import { webhooks, messages, io, sessions } from ".";
import { AuthData2, UserData } from './lib/authdata';
import { autoMod, autoModResult } from './automod';
import { Users } from './modules/users';
//--------------------------------------


export const updateArchive = () => {
    fs.writeFile('messages.json', JSON.stringify({
        messages: messages
    }), () => { })
}

/**
 * @deprecated Use authUser in modules/userAuth instead
 * @param cookiestring The user to authorizes' cookie
 * @param success A function that will be called on success
 * @param failure A function that will be called on failure
 */
export const auth_cookiestring = (
    cookiestring: string,
    failure: () => any,
    success: (authdata?: AuthData2) => any,
) => {
    try {
        let auths = JSON.parse(fs.readFileSync("auths.json", "utf-8"))
        let cookies = cookie.parse(cookiestring)
        if (cookies.name && cookies.email && cookies.mpid) {
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

/**
 * Broken old authentication function
 * @deprecated DO NOT USE, no longer works
 * @param session_id session id to check
 * @param success called on success
 * @param failure called on failure
 */
export const auth = (
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
export const sendMessage = (message: Message, channel: string = "chat", socket?): Message => {
    if (socket) socket.to(channel).emit("incoming-message", message);
    else io.to(channel).emit("incoming-message", message);
    return message
}

export const sendConnectionMessage = (name: string, connection: boolean) => {
    io.to("chat").emit("connection-update", {
        connection: connection,
        name: name
    })
}

export const removeDuplicates = (filter_array: string[]) => filter_array.filter((value, index, array) => index === array.findIndex(item => item === value))

export function sendWebhookMessage(data) {
    let webhook;
    let messageSender;
    outerLoop: for (let i = 0; i < webhooks.length; i++) {
        for (let key of Object.keys(webhooks[i].ids)) {
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
        image: data.image,
        id: messages.length,
    }
    const result = autoMod(msg)
    if (result === autoModResult.pass) {
        sendMessage(msg);
        if (msg.archive) messages.push(msg);
        console.log(`Webhook Message from ${webhook.name} (${messageSender}): ${data.text} (${data.archive})`)
    } else if (result === autoModResult.kick) {
        for (let i in webhooks) {
            if (webhooks[i].name === webhook.name) {
                webhooks.splice(i, 1);
                break;
            }
        }
        fs.writeFileSync("webhooks.json", JSON.stringify(webhooks, null, 2), 'utf8');

        const msg: Message = {
            text:
                `Webhook ${webhook.name} has been disabled due to spam.`,
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
        sendMessage(msg);
        messages.push(msg);
        sendOnLoadData();
    }
}

export function sendOnLoadData() {
    for (const session of sessions.sessions) {
        let webhooksData = [];
        for (let i = 0; i < webhooks.length; i++) {
            let data = {
                name: webhooks[i].name,
                image: webhooks[i].image,
                id: webhooks[i].ids[session.userData.name]
            }
            webhooksData.push(data);
        }

        session.socket.emit('onload-data', {
            image: session.userData.img,
            name: session.userData.name,
            webhooks: webhooksData
        });
    }
}

export function searchMessages(searchString) {
    let results = messages.filter(message => message.text.toLowerCase().includes(searchString.toLowerCase()));
    for (let result of results) {
        result.index = messages.indexOf(result);
    }
    return results;
};