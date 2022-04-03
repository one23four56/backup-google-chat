/**
 * @module functions
 */
import * as fs from 'fs';
import * as cookie from 'cookie';
import Message from "../lib/msg";
import { io, sessions } from "..";
import { AuthData2, UserData } from '../lib/authdata';
import { autoMod, autoModResult, mute } from './autoMod';
import { Users } from './users';
import Webhook, { ProtoWebhook } from './webhooks';
import { Archive } from './archive';
//--------------------------------------

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

    if (!message.id) message.id = Archive.getArchive().length;
    if (!message.archive) message.archive = true;

    if (socket) socket.to(channel).emit("incoming-message", message);
    else io.to(channel).emit("incoming-message", message);
    return message
}

/**
 * Sends a connect/disconnect message for a given user
 * @param name The name of the user who connected
 * @param connection True to send a connect message, false to send a disconnect message
 */
export const sendConnectionMessage = (name: string, connection: boolean) => {
    io.to("chat").emit("connection-update", {
        connection: connection,
        name: name
    })
}

/**
 * Removes duplicates from an array
 * @param filter_array The array to filter
 * @returns The filtered array
 */
export const removeDuplicates = (filter_array: string[]) => filter_array.filter((value, index, array) => index === array.findIndex(item => item === value))

/**
 * Sends a webhook message
 * @param data The data for the message to send
 */
export function sendWebhookMessage(data) {
    let webhook: ProtoWebhook;
    let messageSender;
    outerLoop: for (let checkWebhook of Webhook.getWebhooks()) {
        for (let key in checkWebhook.ids) {
            if (checkWebhook.ids[key] == data.id) {
                webhook = checkWebhook;
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
        id: Archive.getArchive().length,
    }
    const result = autoMod(msg, webhook.private)
    if (result === autoModResult.pass) {
        sendMessage(msg);
        if (msg.archive) Archive.addMessage(msg);
        console.log(`Webhook Message from ${webhook.name} (${messageSender}): ${data.text} (${data.archive})`)
    } else if (result === autoModResult.kick) {
        for (let deleteWebhook of Webhook.getWebhooks()) {
            if (deleteWebhook.id === webhook.id) {
                new Webhook(deleteWebhook.name, deleteWebhook.image, deleteWebhook.private, deleteWebhook.owner, deleteWebhook.ids, deleteWebhook.id)
                .remove("")
            }
        }

        mute(messageSender, 120000)

        const msg: Message = {
            text:
                `Webhook ${webhook.name} has been disabled due to spam. ${messageSender} has also been muted for 2 minutes.`,
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
        Archive.addMessage(msg);
        sendOnLoadData();
    }
}

/**
 * Sends individualized onload data to all users
 */
export function sendOnLoadData() {
    for (const session of sessions.sessions) {
        session.socket.emit('onload-data', {
            image: session.userData.img,
            name: session.userData.name,
            webhooks: Webhook.getWebhooksData(session.userData.name),
        });
    }
}

/**
 * Searches the archive
 * @param searchString The string to search for
 * @returns An array of messages that match the string
 */
export function searchMessages(searchString) {
    let archive = Archive.getArchive();
    for (let [index, result] of archive.entries())
        result.index = index

    let results = archive.filter(message => message.text.toLowerCase().includes(searchString.toLowerCase()));

    return results;
};

/**
 * Escapes a string (removes HTML tags, i.e \<b\> becomes \&lt;b\&gt;)
 * @param string String to escape
 * @returns Escaped string
 */
export function escape(string: String) {
    return string
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/`/g, "&#x60;")
        .replace(/\//g, "&#x2F;");
}

/**
 * Generates a message with given text and sends it as the Info bot
 * @param {string} text The text to have the Info bot say
 * @returns {Message} The message that was just sent
 */
export function sendInfoMessage(text: string) {
    const message: Message = {
        text: text,
        author: {
            name: "Info",
            img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png"
        },
        time: new Date(new Date().toUTCString()),
        tag: {
            text: 'BOT',
            color: 'white',
            bg_color: 'black'
        },
        id: Archive.getArchive().length,
    }

    sendMessage(message, 'chat');
    Archive.addMessage(message);

    return message;
}