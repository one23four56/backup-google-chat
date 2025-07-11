/**
 * @"module" functions
 * 3.26.2023: 
 *  why the fuck does this file still exist
 *  literally everything here is commented out or deprecated except for the escape function lmao 
 *  i was only reminded of this file's existence because it caused a ts error
 *  TODO: remove this (i'll get around to it later i promise)
 * 8.9.2024:
 *  more than a year later i still haven't gotten around to it
 *  only coming back here because while updating the bots module,
 *  this file threw an error because its UNUSED bots import no longer worked lol
 *  i swear im gonna remove this sometime soon (hopefully)
 *  TODO(again): remove this (do it this time)
 */
import * as fs from 'fs';
import * as cookie from 'cookie';
import Message from "../lib/msg";
import { io , sessions } from "..";
import { AuthData2 } from '../lib/authdata';
import Webhook, { ProtoWebhook } from './webhooks';
import Bots from './bots';
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

// /**
//  * Sends a connect/disconnect message for a given user
//  * @param name The name of the user who connected
//  * @param connection True to send a connect message, false to send a disconnect message
//  */
// export const sendConnectionMessage = (name: string, connection: boolean) => {
//     io.to("chat").emit("connection-update", {
//         connection: connection,
//         name: name
//     })
// }

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
// export function sendWebhookMessage(data: ClientToServerMessageData) {

    // return;
    // if (
    //     typeof data.id === 'undefined' ||
    //     typeof data.text === 'undefined' ||
    //     typeof data.archive === 'undefined'
    // ) return;

    // let webhook: ProtoWebhook;
    // let messageSender;
    // outerLoop: for (let checkWebhook of Webhook.getWebhooks()) {
    //     for (let key in checkWebhook.ids) {
    //         if (checkWebhook.ids[key] == data.id) {
    //             webhook = checkWebhook;
    //             messageSender = key;
    //             break outerLoop;
    //         }
    //     }
    // }
    // if (!webhook) return;

    // let replyTo: Message | undefined = undefined;
    // if (data.replyTo && room.archive.data.getDataReference()[data.replyTo]) {
    //     replyTo = JSON.parse(JSON.stringify(room.archive.data.getDataReference()[data.replyTo]))
    //     // only deep copy the message to save time
    //     replyTo.replyTo = undefined;
    //     // avoid a nasty reply chain that takes up a lot of space
    // }

    // const msg: Message = {
    //     text: data.text,
    //     author: {
    //         name: messageSender,
    //         image: webhook.image,
    //         id: 'bot',
    //         webhookData: {
    //             name: webhook.name,
    //             image: webhook.image
    //         }
    //     },
    //     time: new Date(new Date().toUTCString()),
    //     tag: {
    //         text: 'BOT',
    //         bgColor: "#C1C1C1",
    //         color: 'white'
    //     },
    //     // image: data.image? data.image: undefined,
    //     id: room.archive.data.getDataReference().length,
    //     replyTo: replyTo
    // }
    // const result = autoMod(msg, webhook.private)
    // if (result === autoModResult.pass) {
    //     sendMessage(msg);
    //     if (msg.archive) Archive.addMessage(msg);
    //     Bots.runBotsOnMessage(msg);
    //     console.log(`Webhook Message from ${webhook.name} (${messageSender}): ${data.text} (${data.archive})`)
    // } else if (result === autoModResult.kick) {
    //     for (let deleteWebhook of Webhook.getWebhooks()) {
    //         if (deleteWebhook.id === webhook.id) {
    //             new Webhook(deleteWebhook.name, deleteWebhook.image, deleteWebhook.private, deleteWebhook.owner, deleteWebhook.ids, deleteWebhook.id)
    //             .remove("")
    //         }
    //     }

    //     mute(messageSender, 120000)

    //     const msg: Message = {
    //         text:
    //             `Webhook ${webhook.name} has been disabled due to spam. ${messageSender} has also been muted for 2 minutes.`,
    //         author: {
    //             name: "Auto Moderator",
    //             img:
    //                 "https://jason-mayer.com/hosted/mod.png",
    //         },
    //         time: new Date(new Date().toUTCString()),
    //         tag: {
    //             text: 'BOT',
    //             color: 'white',
    //             bg_color: 'black'
    //         }
    //     }
    //     sendMessage(msg);
    //     Archive.addMessage(msg);
    //     io.emit("load data updated")
    // }
// }

/**
 * Searches the archive
 * @param searchString The string to search for
 * @returns An array of messages that match the string
 */
export function searchMessages(searchString) {
    // let archive = room.archive.data.getDataCopy();

    // let results = archive.filter(message => message.text.toLowerCase().includes(searchString.toLowerCase()));

    // return results;
};

/**
 * Escapes a string (removes HTML tags, i.e \<b\> becomes \&lt;b\&gt;)
 * @param string String to escape
 * @returns Escaped string
 */
export function escape(string: string) {
    return new String(string)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/`/g, "&#x60;")
        .replace(/\//g, "&#x2F;");
}