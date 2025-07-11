import Message from "../../lib/msg"
import AutoMod, { autoModResult } from "../../modules/autoMod"
import { ClientToServerEvents, isPollData } from "../../lib/socket"
import { Session } from "../../modules/session"
import { checkRoom } from "../../modules/rooms"
import { io } from "../.."
import { createPoll, PollWatcher } from "../../modules/polls"
import { isDMBlocked } from "../../modules/dms"

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
        if (!room || isDMBlocked(room)) return;


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
        if (typeof data.replyTo === "number" && room.archive.getMessage(data.replyTo)) {
            replyTo = JSON.parse(JSON.stringify(room.archive.getMessage(data.replyTo)))
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

        // link + media length check

        if (Array.isArray(data.media) && Array.isArray(data.links) && data.media.length + data.links.length > 5)
            return;

        // check for media 

        if (typeof data.media === "object" && Array.isArray(data.media)) {

            if (data.media.length > 5)
                return;

            // check for duplicates, thanks https://stackoverflow.com/a/7376645/
            if (new Set(data.media).size !== data.media.length)
                return;

            for (const id of data.media) {

                if (typeof id !== "string" || !(room.share.doesItemExist(id) || room.share.isUploading(id)))
                    continue;

                msg.media = !msg.media ? [{
                    type: "media",
                    location: id
                }] : [...msg.media, {
                    type: "media",
                    location: id
                }]

            }

        }

        // check for links

        if (typeof data.links === "object" && Array.isArray(data.links)) {

            if (data.links.length > 5)
                return;

            if (new Set(data.links).size !== data.links.length)
                return;

            msg.links = [];
            
            for (const link of data.links) {

                // add all the links to the message, but make sure they are all strings first

                if (typeof link !== "string")
                    continue;

                msg.links.push(link);

            }

        }

        // check for poll & create poll if needed
        // don't init poll tho, wait until automod approves the message

        if (data.poll && isPollData(data.poll))
            msg.poll = createPoll(userData.id, msg.id, data.poll)

        // preform auto-moderator check

        const autoModRes = room.autoMod.check(msg)
        switch (autoModRes) {

            case autoModResult.pass:
                respond(true);
                room.message(msg);
                room.bots.runBots(msg);
                if (msg.poll && msg.poll.type === 'poll')
                    new PollWatcher(msg.id, room); // init poll
                break;


            case autoModResult.kick:
                respond(false)
                socket.emit("auto-mod-update", autoModRes.toString())
                room.mute(userData, room.data.options.autoMod.muteDuration, "Auto Moderator")
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
        if (!room || isDMBlocked(room)) return;

        const userData = session.userData

        // get message

        const message = room.archive.getMessage(messageId);
        if (!message) return;

        // check permission
        if (message.author.id === "bot") return;

        const isAuthor = message.author.id === userData.id;
        const isOwner = room.data.options.ownerDeleteAllMessages && room.data.owner === userData.id;

        if (!isAuthor && !isOwner) return;
        if (!room.data.members.includes(userData.id)) return;

        // shut down poll if necessary

        if (message.poll && message.poll.type === "poll" && !message.poll.finished)
            PollWatcher.getPollWatcher(room.data.id, message.id)?.abort()

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
        if (!room || isDMBlocked(room)) return;

        const userData = session.userData

        // get message

        const message = room.archive.getMessage(messageID);
        if (!message) return;

        // validate

        if (room.isMuted(userData.id)) return;
        if (message.author.id !== userData.id) return
        if (AutoMod.text(text, 5000) !== autoModResult.pass) return;

        // do edit

        room.edit(messageID, text)

    }

    return editMessage
}

export function generateTypingHandler(session: Session) {
    const typingHandler: ClientToServerEvents["typing"] = (roomId, start) => {

        const userData = session.userData

        // block malformed requests

        if (typeof roomId !== "string" || typeof start !== "boolean") return;

        // get room

        const room = checkRoom(roomId, userData.id)
        if (!room || isDMBlocked(room)) return;

        // check permissions

        if (room.isMuted(userData.id)) return;

        // add typing 

        if (start)
            room.addTyping(userData.name);
        else
            room.removeTyping(userData.name);

    }

    return typingHandler;
}

export function generateReactionHandler(session: Session) {
    const reactionHandler: ClientToServerEvents["react"] = (roomId, id, rawEmoji) => {

        // block malformed requests

        if (typeof roomId !== "string" || typeof id !== "number" || typeof rawEmoji !== "string") return;

        // get room 

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id);
        if (!room || isDMBlocked(room)) return;

        // check emoji

        const emoji = AutoMod.emoji(rawEmoji);

        if (!emoji) return;

        // add reaction

        if (room.archive.addReaction(id, emoji, userData))
            io.emit("reaction", room.data.id, id, room.archive.getMessage(id))
    }

    return reactionHandler;
}