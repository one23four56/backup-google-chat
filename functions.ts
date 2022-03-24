import * as fs from 'fs';
import * as cookie from 'cookie';
import Message from "./lib/msg";
import { webhooks, messages, io, users, onlinelist } from ".";
import { AuthData2 } from './lib/authdata';
import { autoMod, autoModResult } from './automod';
//--------------------------------------


export const updateArchive = () => {
    fs.writeFile('messages.json', JSON.stringify({
        messages: messages
    }), () => { })
}

/**
 * @deprecated Use authUser in auth.ts instead
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
        //@ts-expect-error
        if (sessions[session_id]) {
            success({//@ts-expect-error
                name: sessions[session_id].name,//@ts-expect-error
                email: sessions[session_id].email,//@ts-expect-error
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
        for (let userName of onlinelist) {
            sendOnLoadData(userName);
        }
    }
}

export function sendOnLoadData(userName) {
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

export function searchMessages(searchString) {
    let results = messages.filter(message => message.text.toLowerCase().includes(searchString.toLowerCase()));
    for (let result of results) {
        result.index = messages.indexOf(result);
    }
    return results;
};