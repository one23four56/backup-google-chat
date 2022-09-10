import Message from "../../lib/msg"
import AutoMod, { autoModResult } from "../../modules/autoMod"
import Bots from "../../modules/bots"
import { ClientToServerEvents } from "../../lib/socket"
import { Session } from "../../modules/session"
import { checkRoom } from "../../modules/rooms"
import { io } from "../.."

export function generateMessageHandler(session: Session) {
    const handler: ClientToServerEvents["message"] = (roomId, data, respond) => {

        // block malformed requests

        if (
            typeof roomId !== "string" ||
            typeof respond !== "function" ||
            typeof data !== "object" ||
            typeof data.archive !== "boolean" ||
            typeof data.text !== "string"
            )
            return;

        // get room

        const room = checkRoom(roomId, session.userData.id)
        if (!room) return;


        const socket = session.socket;
        const userData = session.userData;


        // validate

        if (
            typeof data.text === "undefined"
            || typeof data.archive === "undefined"
            ) {
                respond(false);
                return;
            }

        // if (data.recipient !== "chat") data.archive = false

        // set reply

        let replyTo: Message = undefined;
        if (typeof data.replyTo === "number" && room.archive.data.getDataReference()[data.replyTo]) {
            replyTo = JSON.parse(JSON.stringify(room.archive.data.getDataReference()[data.replyTo]))
            // only deep copy the message to save time
            replyTo.replyTo = undefined;
            // avoid a nasty reply chain that takes up a lot of space
        }

        // create message

        const msg: Message = {
            text: data.text,
            author: {
                name: userData.name,
                image: userData.img,
                id: userData.id,
            },
            time: new Date(new Date().toUTCString()),
            // image: data.image ? data.image : undefined,
            id: room.archive.length,
            replyTo: replyTo,
        }

        // check for webhook

        if (
            typeof data.webhook === 'object' &&
            typeof data.webhook.image === 'string' &&
            typeof data.webhook.name === 'string' &&
            typeof data.webhook.id === 'string'
        ) {
            // check webhook

            const webhook = room.webhooks.get(data.webhook.id)

            if (!webhook) return;
            if (!webhook.checkIfHasAccess(userData.id)) return;
            if (room.data.options.webhooksAllowed === false) return;

            // add webhook

            msg.author.webhookData = {
                name: webhook.name,
                image: webhook.image
            }

            msg.tags = [{
                text: 'WEBHOOK',
                bgColor: "#8A8A8A",
                color: 'white'
            }]
        }

        // check for media 

        if (typeof data.media === "string" && room.share.doesItemExist(data.media)) {
            
            msg.media = {
                type: "media",
                location: data.media
            }

        }

        // preform auto-moderator check

        const autoModRes = room.autoMod.check(msg)
        switch (autoModRes) {
            
            case autoModResult.pass:
                respond(true)
                room.message(msg, data.archive)
                room.bots.runBotsOnMessage(msg);
                break

            
            case autoModResult.kick:
                respond(false)
                socket.emit("auto-mod-update", autoModRes.toString())
                room.autoMod.mute(userData, 120000)
                const autoModMsg: Message = {
                    text:
                        `${userData.name} has been muted for 2 minutes due to spam.`,
                    author: {
                        name: "Auto Moderator",
                        image:
                            "../public/mod.png",
                        id: 'bot'
                    },
                    time: new Date(new Date().toUTCString()),
                    tags: [{
                        text: 'BOT',
                        color: 'white',
                        bgColor: 'black'
                    }],
                    id: room.archive.data.getDataReference().length
                }
                room.message(autoModMsg)
                break

            
            default:
                respond(false)
                socket.emit("auto-mod-update", autoModRes.toString())
                break
        }
    }

    return handler;
}

export function generateDeleteHandler(session: Session) {
    const deleteMessage: ClientToServerEvents["delete-message"] = (roomId, messageId) => {

        // block malformed requests

        if (typeof roomId !== "string" || typeof messageId !== "number") 
            return;

        // get room

        const room = checkRoom(roomId, session.userData.id)
        if (!room) return;

        const userData = session.userData

        // get message

        const message = room.archive.data.getDataReference()[messageId];
        if (!message) return;

        // check permission

        if (message.author.id !== userData.id) return
        if (!room.data.members.includes(userData.id)) return;

        // edit message

        room.delete(messageId)
    }

    return deleteMessage;
}

export function generateEditHandler(session: Session) {
    const editMessage: ClientToServerEvents["edit-message"] = (roomId, { messageID, text }) => {
        
        // block malformed requests

        if (
            typeof roomId !== "string" ||
            typeof messageID !== "number" ||
            typeof text !== "string"
        ) return;

        // get room

        const room = checkRoom(roomId, session.userData.id)
        if (!room) return;

        const userData = session.userData

        // get message

        const message = room.archive.getMessage(messageID);
        if (!message) return;

        // validate

        if (room.autoMod.isMuted(userData.name)) return;
        if (message.author.id !== userData.id) return
        if (AutoMod.autoModText(text) !== autoModResult.pass) return;

        // do edit

        room.edit(messageID, text)
        
    }

    return editMessage
}

export function generateStartTypingHandler(session: Session) {
    const typingHandler: ClientToServerEvents["typing start"] = (roomId) => {

        const userData = session.userData

        // block malformed requests

        if (!roomId || typeof roomId !== "string") return;

        // get room

        const room = checkRoom(roomId, userData.id)
        if (!room) return;

        // check permissions

        if (room.autoMod.isMuted(userData.id)) return;

        // broadcast event 

        io.to(room.data.id).emit("typing", room.data.id, userData.name)

    }

    return typingHandler;
}

export function generateStopTypingHandler(session: Session) {
    const typingHandler: ClientToServerEvents["typing stop"] = (roomId) => {

        const userData = session.userData

        // block malformed requests

        if (!roomId || typeof roomId !== "string") return;

        // get room

        const room = checkRoom(roomId, userData.id)
        if (!room) return;

        // broadcast event 

        io.to(room.data.id).emit("end typing", room.data.id, userData.name)

    }

    return typingHandler;
}

export function generateReactionHandler(session: Session) {
    const reactionHandler: ClientToServerEvents["react"] = (roomId, id, emoji) => {

        // block malformed requests

        if (typeof roomId !== "string" || typeof id !== "number" || typeof emoji !== "string") return;

        // get room 

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id);
        if (!room) return;

        // check emoji

        if (AutoMod.autoModText(emoji, 6) !== autoModResult.pass) return;

        // add reaction

        if (room.archive.addReaction(id, emoji, userData))
            io.emit("reaction", room.data.id, id, room.archive.data.getDataReference()[id])
    }

    return reactionHandler;
}