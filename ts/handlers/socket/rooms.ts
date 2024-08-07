import { sessions as mainSessions, server } from '../..';
import { ClientToServerEvents } from '../../lib/socket'
import AutoMod, { autoModResult } from '../../modules/autoMod';
import { checkRoom, createRoom, getRoomsByUserId } from '../../modules/rooms';
import { Session } from '../../modules/session';
import { Users, blockList } from '../../modules/users';
import * as BotObjects from '../../modules/bots/botsIndex'
import * as Invites from '../../modules/invites'
import { isDMBlocked } from '../../modules/dms';
import { notifications } from '../../modules/notifications';
import { KickNotification, NotificationType, TextNotification } from '../../lib/notifications';
import { defaultOptions, isRoomOptions } from '../../lib/options';

export function generateGetMessagesHandler(session: Session) {
    const handler: ClientToServerEvents["get room messages"] = (roomId, startAt, respond) => {
        // block malformed requests

        if (
            typeof roomId !== "string" ||
            (typeof startAt !== "number" && typeof startAt !== "boolean") ||
            typeof respond !== "function"
        )
            return;

        // get room

        const room = checkRoom(roomId, session.userData.id)
        if (!room) return;

        // respond with messages

        const messages = startAt === true ? room.archive.messageRef(true) :
            room.archive.messageRef(true, Math.floor(startAt / 1000))

        const out = [];

        let count = 0;
        if (startAt === true) for (const message of messages) {
            if (count >= 50) break;
            out.unshift(message);
            count++;
        } else for (const message of messages) {
            if (message.id >= startAt) continue;
            if (count >= 50) break;
            out.unshift(message);
            count++;
        }

        respond(out);
    }

    return handler;
}

export function generateGetMembersHandler(session: Session) {
    const handler: ClientToServerEvents["get member data"] = (roomId) => {

        // block malformed requests

        if (typeof roomId !== "string")
            return;

        // get room

        const room = checkRoom(roomId, session.userData.id)
        if (!room) return;

        // send members

        session.socket.emit("member data", room.data.id, room.getMembers())

    }

    return handler;
}

export function generateInviteUserHandler(session: Session) {
    const handler: ClientToServerEvents["invite user"] = async (roomId, userId) => {

        // block malformed requests

        if (typeof roomId !== "string" || typeof userId !== "string")
            return

        // get room

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id, false)
        if (!room) return;

        // check user

        const userToAdd = Users.get(userId)

        if (!userToAdd)
            return;

        const checks = () => {
            if (room.data.members.includes(userId))
                return `${userToAdd.name} is already a member of ${room.data.name}`;

            if (room.isKicked(userId))
                return `${userToAdd.name} is kicked from ${room.data.name}`;

            if (blockList(userToAdd.id).mutualBlockExists(userData.id))
                return `${userToAdd.name} has blocked you`;

            if (Invites.isInvitedToRoom(userToAdd.id, room.data.id))
                return `${userToAdd.name} is already invited to ${room.data.name}`;

            return true;
        }

        const result = checks();
        if (result !== true)
            return session.alert("Can't Invite", result);

        // check permissions
        const permission = room.checkPermission("invitePeople", room.data.owner === userData.id);
        if (permission === "no") return;

        if (permission === "poll") {
            const poll = await room.quickBooleanPoll(
                `${userData.name} wants to invite ${userToAdd.name} to the room.`,
                `Invite ${userToAdd.name}?`,
                1000 * 60
            ).catch(r => r as string);
            if (typeof poll === "string")
                return session.alert("Can't Start Poll", poll);
            if (!poll) return;
        };

        const check = checks();
        if (check !== true)
            return session.alert("Can't Invite", check);

        room.inviteUser(userToAdd, userData);
    };

    return handler;
}

export function generateRemoveUserHandler(session: Session) {
    const handler: ClientToServerEvents["remove user"] = async (roomId, userId) => {

        // block malformed requests

        if (typeof roomId !== "string" || typeof userId !== "string")
            return

        // get room

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id, false)
        if (!room) return;

        // check user

        const userToRemove = Users.get(userId)
        if (!userToRemove)
            return;

        if (!room.isMember(userId))
            return;

        if (room.data.owner === userId)
            return;

        // check permissions

        const permission = room.checkPermission("removePeople", room.data.owner === userData.id);
        if (permission === "no") return;

        if (permission === "poll") {
            const poll = await room.quickBooleanPoll(
                `${userData.name} wants to remove ${userToRemove.name} from the room.`,
                `Remove ${userToRemove.name}?`
            ).catch(r => r as string);
            if (typeof poll === "string")
                return session.alert("Can't Start Poll", poll);
            if (!poll) return;
        }

        // do another member check
        if (!room.isMember(userId)) return;

        // perform remove

        const notify = room.data.members.includes(userId) || (room.data.invites.includes(userId) && room.isKicked(userId));
        // don't notify if member is only invited

        room.removeUser(userId)

        room.infoMessage(`${userData.name} removed ${userToRemove.name} from the room`)

        if (notify)
            notifications.send<TextNotification>([userId], {
                type: NotificationType.text,
                icon: {
                    type: "icon",
                    content: "fa-solid fa-ban"
                },
                title: `Removed from ${room.data.name}`,
                data: {
                    content: `On ${new Date().toLocaleString("en-US", {
                        timeZone: "America/Chicago",
                        dateStyle: "long",
                        timeStyle: "short"
                    })}, ${userData.name} removed you from ${room.data.name}.`,
                    title: `Removed from ${room.data.name}`
                }
            })

    }

    return handler;
}

export function generateGetOnlineListHandler(session: Session) {
    const handler: ClientToServerEvents["get online list"] = (roomId) => {
        // block malformed requests

        if (typeof roomId !== "string")
            return

        // get room

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id)
        if (!room) return;

        // send online list

        session.socket.emit("online list", room.data.id, ...room.getOnlineLists())
    }

    return handler;
}

export function generateGetBotDataHandler(session: Session) {
    const handler: ClientToServerEvents["get bot data"] = (roomId) => {
        // block malformed requests

        if (typeof roomId !== "string")
            return

        // get room

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id)
        if (!room) return;

        // send data

        session.socket.emit("bot data", room.data.id, room.bots.botData)
    }

    return handler;
}

export function generateModifyRulesHandler(session: Session) {
    const handler: ClientToServerEvents["modify rules"] = async (roomId, func, rawRule) => {
        // block malformed requests

        if (
            typeof roomId !== "string" ||
            typeof func !== "string" ||
            typeof rawRule !== "string" ||
            (func !== "add" && func !== "delete")
        )
            return;

        // get room

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id, false)
        if (!room) return;

        // check rule 

        const rule = String(rawRule).trim();

        if (AutoMod.text(rule, 100) !== autoModResult.pass)
            return;

        if (func === "delete" && !room.data.rules.includes(rule))
            return;

        if (func === "add" && room.data.rules.includes(rule))
            return session.alert("Can't Add Rule", `The rule "${rule}" already exists`);

        const index = 1 + (func === "add" ? room.data.rules.length : room.data.rules.indexOf(rule));

        // check permissions

        const permission = room.checkPermission("editRules", userData.id === room.data.owner);

        if (permission === "no") return;

        if (permission === "poll") {
            const message = func === "add" ?
                `${userData.name} wants to add Rule #${index}: ${rule}` :
                `${userData.name} wants to remove Rule #${index} (${rule})`;
            const poll = await room.quickBooleanPoll(
                message,
                `${func === "add" ? "Add" : "Remove"} Rule #${index}?`
            ).catch(r => r as string);
            if (typeof poll === "string")
                return session.alert("Can't Start Poll", poll);
            if (!poll) return;
        }

        // do changes

        if (func === "add")
            room.addRule(rule, userData.name)
        else
            room.removeRule(rule, userData.name)

    }

    return handler;
}

export function generateModifyDescriptionHandler(session: Session) {
    const handler: ClientToServerEvents["modify description"] = async (roomId, description) => {
        // block malformed requests

        if (
            typeof roomId !== "string" ||
            typeof description !== "string"
        )
            return;

        // get room

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id, false)
        if (!room) return;

        // check rule 

        if (AutoMod.text(description, 250) !== autoModResult.pass)
            return;

        // check permissions

        const permission = room.checkPermission("editDescription", room.data.owner === userData.id);

        if (permission === "no")
            return;

        if (permission === "poll") {
            const poll = await room.quickBooleanPoll(
                `${userData.name} wants to change the room description to: ${description}`,
                "Change room description?",
                5 * 60 * 1000
            ).catch(r => r as string);
            if (typeof poll === "string")
                return session.alert("Can't Start Poll", poll);
            if (!poll) return;
        }

        // do changes

        room.updateDescription(description, userData.name)
    }

    return handler;
}

export function generateCreateRoomHandler(session: Session) {
    const handler: ClientToServerEvents["create room"] = (data) => {

        // block malformed requests

        if (
            typeof data !== "object" ||
            typeof data.description !== "string" ||
            typeof data.emoji !== "string" ||
            typeof data.name !== "string" ||
            typeof data.rawMembers !== "object" ||
            !Array.isArray(data.rawMembers)
        )
            return;

        // save data as variables

        const { description, emoji, name, rawMembers } = data, userData = session.userData;

        const members = Array.from(rawMembers).map(m => m.id)

        if (!members.includes(userData.id))
            return;

        const blocklist = blockList(userData.id);
        if (members.some(id => blocklist.mutualBlockExists(id)))
            return;

        // run automod checks

        if (
            AutoMod.text(description, 100) !== autoModResult.pass ||
            AutoMod.text(name, 30) !== autoModResult.pass ||
            !AutoMod.emoji(emoji)
        )
            return;

        // check rooms by user

        const rooms = getRoomsByUserId(userData.id).filter(room => room.data.owner === userData.id).length;

        if (rooms >= 5)
            return session.socket.emit("alert", 'Room Not Created', 'You can not be the owner of more than 5 rooms at once. If you really need to create another room, delete an unused room or transfer ownership of it to someone else.')

        // create room

        const room = createRoom({
            name,
            emoji: AutoMod.emoji(emoji),
            members,
            description,
            owner: userData.id,
            options: defaultOptions
        })

        // broadcast room and add sessions

        for (const member of room.data.members) {

            const broadCastToSession = mainSessions.getByUserID(member)

            if (broadCastToSession) {
                broadCastToSession.socket.emit("added to room", room.data)
                room.addSession(broadCastToSession)
            }
        }

        // send notification to owner if needed

        if (rooms === 4)
            notifications.send<TextNotification>([userData.id], {
                type: NotificationType.text,
                icon: {
                    type: "icon",
                    content: "fa-solid fa-exclamation"
                },
                title: "Room Limit Reached",
                data: {
                    title: "Room Limit Reached",
                    content: `You currently own 5 rooms (${getRoomsByUserId(userData.id)
                        .filter(room => room.data.owner === userData.id)
                        .map(r => r.data.name).join(", ")
                        }).\n As a result, you are currently unable to create new rooms. If you wish to create another room, you must renounce/transfer ownership of or delete a room.`
                }
            })

    }

    return handler;
}

export function generateModifyOptionsHandler(session: Session) {
    const handler: ClientToServerEvents["modify options"] = (roomId, options) => {

        // block malformed requests

        if (
            typeof roomId !== "string" ||
            !isRoomOptions(options)
        )
            return session.socket.emit("alert", "Unable to Save", "Your changes could not be saved because the request was formatted incorrectly.");

        // get room

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id, false)
        if (!room) return session.socket.emit("alert", "Unable to Save", "Your changes could not be saved because you are not a member of targeted room, or the room does not exist.");

        // check permissions

        if (room.data.owner !== userData.id)
            return session.socket.emit("alert", "Unable to Save", "Your changes could not be saved because you are not the owner of the targeted room.");

        // do changes

        room.updateOptions(options);

        session.socket.emit("alert", "Changes Saved", "Your changes to the room options have been saved successfully.")

    }

    return handler;
}

export function generateModifyNameOrEmojiHandler(session: Session) {
    const handler: ClientToServerEvents["modify name or emoji"] = async (roomId, edit, changeTo) => {

        // block malformed requests

        if (
            typeof roomId !== "string" ||
            typeof changeTo !== "string" ||
            typeof edit !== "string" ||
            (edit !== "emoji" && edit !== "name")
        )
            return

        // get room

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id, false)
        if (!room) return;

        // run automod checks 

        let change: string;
        if (edit === "name" && AutoMod.text(changeTo, 30) !== autoModResult.pass)
            return;
        if (edit === "emoji" && AutoMod.text(changeTo, 30) !== autoModResult.pass)
            return;

        if (edit === "emoji") {
            change = AutoMod.emoji(changeTo);
            if (!change) return;
        } else
            change = String(changeTo).slice(0, 30);

        // check permissions

        const permission = room.checkPermission("editName", room.data.owner === userData.id);
        if (permission === "no")
            return;

        if (permission === "poll") {
            const poll = await room.quickBooleanPoll(
                `${userData.name} wants to change the room ${edit} to ${change}`,
                `Change room ${edit} to ${change}?`
            ).catch(r => r as string);
            if (typeof poll === "string")
                return session.alert("Can't Start Poll", poll);
            if (!poll) return;
        };

        // do changes

        if (edit === "name") room.updateName(change, userData.name);
        if (edit === "emoji") room.updateEmoji(change, userData.name);
    }

    return handler;
}

export function generateModifyBotsHandler(session: Session) {
    const handler: ClientToServerEvents["modify bots"] = (roomId, action, name) => {

        // block malformed requests

        if (
            typeof roomId !== "string" ||
            typeof action !== "string" ||
            typeof name !== "string" ||
            (action !== "add" && action !== "delete")
        )
            return;

        // get room

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id, false)
        if (!room) return

        // check permissions

        const permission = room.checkPermission("addBots", room.data.owner === userData.id)

        if (permission === 'no')
            return

        // check if bot exists

        let internalName: keyof typeof BotObjects;
        for (const botName in BotObjects) {

            if (new BotObjects[botName]().name === name)
                internalName = botName as keyof typeof BotObjects

        }

        if (!internalName)
            return;

        // if (internalName === "Polly" && action === "delete")
        //     return session.socket.emit("alert", `Can't Remove Polly`, `Polly is a system bot and can't be removed`)

        // make modifications

        if (permission === 'yes') {
            if (action === "add") room.addBot(internalName, name)
            if (action === "delete") room.removeBot(internalName, name)
        } else {
            room.quickBooleanPoll(
                `${userData.name} wants to ${action} the bot ${name} ${action === 'add' ? 'to' : 'from'} the room`,
                `${action.charAt(0).toUpperCase() + action.slice(1)} ${name}?`
            ).then(res => {
                if (!res) return;

                if (action === "add") room.addBot(internalName, name)
                if (action === "delete") room.removeBot(internalName, name)
            }).catch(
                err => session.socket.emit('alert', 'Error', `Error with poll: ${err}`)
            )
        }
    }

    return handler;
}

export function generateLeaveRoomHandler(session: Session) {
    const handler: ClientToServerEvents["leave room"] = (roomId) => {

        // block malformed requests

        if (typeof roomId !== "string")
            return;

        // get room

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id, false, true);
        if (!room) return;

        // check permission

        if (userData.id === room.data.owner)
            return; // the owner can't leave their own room
        // they gotta go down with the ship

        if (room.data.invites.includes(userData.id) && !room.isKicked(userData.id))
            return; // invited ppl can't leave unless they are kicked, otherwise it would mess up the invite

        // leave the room

        room.removeUser(userData.id);
        room.infoMessage(`${userData.name} left the room`);

        session.socket.emit("alert", `Left ${room.data.name}`, `You are no longer a member of ${room.data.name}`)

    }

    return handler;
}

export function generateDeleteRoomHandler(session: Session) {
    const handler: ClientToServerEvents["delete room"] = (roomId) => {

        // block malformed requests

        if (typeof roomId !== "string")
            return;

        // get room

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id, false)
        if (!room) return

        // check permission

        if (userData.id !== room.data.owner || room.data.members.length !== 1 || !room.data.members.includes(userData.id))
            return; // user must be owner, room must have only 1 member, and room owner must be in room

        // initiate delete

        room.deleteRoom()

        session.socket.emit("alert", "Room Deleted", `The room has been deleted`)

    }

    return handler;
}

export function generateGetUnreadDataHandler(session: Session) {
    const handler: ClientToServerEvents["get unread data"] = (roomId, respond) => {

        // block malformed requests

        if (typeof roomId !== "string" || typeof respond !== "function")
            return;

        // get room

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id)
        if (!room) return;

        // send data

        respond(room.getUnreadInfo(userData.id))

    }

    return handler;
}

export function generateReadHandler(session: Session) {
    const handler: ClientToServerEvents["read message"] = (roomId, messageId) => {

        // block malformed requests

        if (typeof roomId !== "string" || typeof messageId !== "number")
            return;

        // get room

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id)
        if (!room || isDMBlocked(room)) return;

        // read message

        if (room.getLastRead(userData.id) >= messageId)
            return;

        const updateIds = room.readMessage(userData, messageId)

        if (typeof updateIds === "string")
            return session.socket.emit("alert", "Error while marking message as read", updateIds)

        // send updates

        // broadcasting because you don't need to get an update that you read a message
        session.socket.broadcast.to(room.data.id).emit(
            "bulk message updates",
            room.data.id,
            updateIds.map(id => room.archive.getMessage(id))
        )

    }

    return handler;
}

export function generateRenounceOwnershipHandler(session: Session) {
    const handler: ClientToServerEvents["renounce ownership"] = (roomId) => {

        // block malformed requests

        if (typeof roomId !== "string")
            return;

        // get room

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id, false)
        if (!room) return;

        // check permission

        if (userData.id !== room.data.owner)
            return;

        // check members

        if (room.data.members.length < 2)
            return session.socket.emit("alert", `Can't Renounce Ownership`, `There aren't enough people in ${room.data.name}.`)

        //  remove as owner

        room.removeOwnership()
        room.infoMessage(`${userData.name} has renounced their ownership of the room.`)

    }

    return handler;
}

export function generateClaimOwnershipHandler(session: Session) {
    const handler: ClientToServerEvents["claim ownership"] = (roomId) => {

        // block malformed requests

        if (typeof roomId !== "string")
            return;

        // get room

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id, false)
        if (!room) return;

        // check permission 

        if (room.data.owner === "nobody")

            // check poll

            if (room.getTempData("reclaimOwnershipPoll") === true)
                return;

        // start poll 

        room.setTempData("reclaimOwnershipPoll", true)

        room.createPollInRoom({
            message: `${userData.name} wants to be made the owner of the room.`,
            prompt: `Make ${userData.name} room owner?`,
            options: ["Yes", "No"],
            defaultOption: 'No',
            time: 15 * 60 * 1000
        }).then(winner => {

            room.clearTempData("reclaimOwnershipPoll")

            if (winner !== 'Yes')
                return;

            if (!room.data.members.includes(userData.id))
                return;

            if (room.data.owner !== "nobody") return;

            room.setOwner(userData.id)
            room.infoMessage(`${userData.name} is now the owner of the room.`)

        })
    }

    return handler;
}

export function muteKickHandler(session: Session): ClientToServerEvents["mute or kick"] {
    return async (roomId, mute, user, minutes) => {

        if (typeof roomId !== "string" || typeof mute !== "boolean" || typeof user !== "string" || typeof minutes !== "number")
            return;

        const room = checkRoom(roomId, session.userData.id, false);
        if (!room) return;

        if (user === room.data.owner) return;
        if (user === session.userData.id) return;

        const owner = session.userData.id === room.data.owner;
        const duration = Math.round(Math.min(Math.max(minutes, 1), 10));

        const hasPermission = mute ?
            room.checkPermission("mute", owner) :
            room.checkPermission("kick", owner);

        if (hasPermission === "no") return;

        const target = Users.get(user);
        if (!target) return;

        const already = mute ? room.isMuted(target.id) : room.isKicked(target.id);
        if (already && !owner) return;
        else if (already && owner) {
            if (mute)
                room.unmute(target.id, session.userData.name);
            else
                room.unkick(target.id, session.userData.name);

            return;
        }

        // this check is down here so un-kicking works
        // if the user is kicked this will fail (they are on invite list, not members list)
        // therefor this must be done after the unkick check (above)
        if (!room.data.members.includes(user)) return;

        if (hasPermission === "poll") {
            const text = mute ? "Mute" : "Kick";
            const approved = await room.quickBooleanPoll(
                `${session.userData.name} wants to ${text.toLowerCase()} ${target.name} for ${duration} minute${duration === 1 ? '' : 's'}`,
                `${text} ${target.name}?`,
                1000 * 60
            ).catch(r => r as string);
            if (typeof approved === "string")
                return session.alert("Can't Start Poll", approved);
            if (!approved) return;
        }

        // do action

        if (mute)
            room.mute(target, duration, session.userData.name);
        else {
            room.kick(target, duration, session.userData.name);
            notifications.send<KickNotification>([target.id], {
                title: `Kicked from ${room.data.name}`,
                type: NotificationType.kick,
                icon: {
                    type: "icon",
                    content: "fa-solid fa-stopwatch"
                },
                data: {
                    roomId: room.data.id,
                    roomName: room.data.name,
                    kickedBy: session.userData.name,
                    kickTime: Date.now(),
                    kickLength: duration
                },
                id: `${room.data.id}-kick`
            })
        }

    }
};