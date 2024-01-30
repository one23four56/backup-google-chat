import { io, sessions as mainSessions } from '../..';
import { ClientToServerEvents } from '../../lib/socket'
import AutoMod, { autoModResult } from '../../modules/autoMod';
import { checkRoom, createRoom, defaultOptions, getRoomsByUserId, isRoomOptions } from '../../modules/rooms';
import { Session } from '../../modules/session';
import { Users, blockList } from '../../modules/users';
import * as BotObjects from '../../modules/bots/botsIndex'
import * as Invites from '../../modules/invites'
import { isDMBlocked } from '../../modules/dms';

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
    const handler: ClientToServerEvents["invite user"] = (roomId, userId) => {

        // block malformed requests

        if (typeof roomId !== "string" || typeof userId !== "string")
            return

        // get room

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id, false)
        if (!room) return;

        // check user

        if (room.data.members.includes(userId))
            return;

        const userToAdd = Users.get(userId)

        if (!userToAdd)
            return;

        if (blockList(userToAdd.id).mutualBlockExists(userData.id))
            return session.socket.emit("alert", "User Not Invited", `${userToAdd.name} has blocked you`)

        if (Invites.isInvitedToRoom(userToAdd.id, room.data.id))
            return session.socket.emit("alert", "User Not Invited", `${userToAdd.name} cannot be invited because they are already invited to the room`);

        // check permissions (async)

        new Promise<void>((resolve, reject) => {
            const permissions = room.data.options.permissions

            if (permissions.invitePeople === "owner" && room.data.owner !== userData.id)
                reject(`${room.data.name}'s rules only allow the room owner to invite users.`)

            else if (
                (
                    (permissions.invitePeople === "owner" || permissions.invitePeople === "poll")
                    && room.data.owner === userData.id
                )
                ||
                permissions.invitePeople === "anyone"
            )
                resolve();

            else if (permissions.invitePeople === "poll" && room.data.owner !== userData.id) {

                if (room.getTempData("addUserPollInProgress"))
                    reject(`${room.data.name} already has a poll to invite someone in progress. Please wait until it ends, and try again.`);

                else {
                    room.setTempData<boolean>("addUserPollInProgress", true);

                    room.createPollInRoom({
                        message: `${userData.name} wants to invite ${userToAdd.name} to the room.`,
                        prompt: `Invite ${userToAdd.name}?`,
                        options: ["Yes", "No"],
                        defaultOption: 'No'
                    }).then(winner => {
                        room.clearTempData("addUserPollInProgress");

                        if (winner === 'Yes')
                            resolve()
                        else
                            reject(`Poll to add ${userToAdd.name} ended in no.`)
                    })

                }
            }
        })

            // handle check permission results

            .then(() => {
                // perform invite

                room.inviteUser(userToAdd, userData)
            })

            .catch((reason: string) => {
                session.socket.emit("alert", 'User Not Added', `${userToAdd.name} was not added to ${room.data.name}. Reason:\n${reason}`)
            })
    }

    return handler;
}

export function generateRemoveUserHandler(session: Session) {
    const handler: ClientToServerEvents["remove user"] = (roomId, userId) => {

        // block malformed requests

        if (typeof roomId !== "string" || typeof userId !== "string")
            return

        // get room

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id, false)
        if (!room) return;

        // check user

        if (!room.data.members.includes(userId) && !room.data.invites?.includes(userId))
            return;

        if (room.data.owner === userId)
            return;

        const userToRemove = Users.get(userId)

        if (!userToRemove)
            return;

        // check permissions (async)

        new Promise<void>((resolve, reject) => {
            const permissions = room.data.options.permissions

            if (permissions.removePeople === "owner" && room.data.owner !== userData.id)
                reject(`${room.data.name}'s rules only allow the room owner to remove users.`)

            else if (
                (
                    (permissions.removePeople === "owner" || permissions.removePeople === "poll")
                    && room.data.owner === userData.id
                )
                ||
                permissions.removePeople === "anyone"
            )
                resolve();

            else if (permissions.removePeople === "poll" && room.data.owner !== userData.id) {

                if (room.getTempData("removeUserPollInProgress"))
                    reject(`${room.data.name} already has a poll to remove someone in progress. Please wait until it ends, and try again.`);

                else {
                    room.setTempData<boolean>("removeUserPollInProgress", true);

                    room.createPollInRoom({
                        message: `${userData.name} wants to remove ${userToRemove.name} from the room.`,
                        prompt: `Remove ${userToRemove.name}?`,
                        options: ['Yes', 'No'],
                        defaultOption: 'No'
                    }).then(winner => {
                        room.clearTempData("removeUserPollInProgress");

                        if (winner === 'Yes')
                            resolve()
                        else
                            reject(`Poll to remove ${userToRemove.name} ended in no.`)
                    })

                }
            }
        })

            // handle check permission results

            .then(() => {
                // perform remove

                room.removeUser(userId)

                room.infoMessage(`${userData.name} removed ${userToRemove.name} from the room`)
            })

            .catch((reason: string) => {
                session.socket.emit("alert", 'User Not Removed', `${userToRemove.name} was not removed from ${room.data.name}. Reason:\n${reason}`)
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
    const handler: ClientToServerEvents["modify rules"] = (roomId, func, rule) => {
        // block malformed requests

        if (
            typeof roomId !== "string" ||
            typeof func !== "string" ||
            typeof rule !== "string" ||
            (func !== "add" && func !== "delete")
        )
            return;

        // get room

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id, false)
        if (!room) return;

        // check permissions

        if (room.data.owner !== userData.id)
            return;

        // check rule 

        if (AutoMod.text(rule, 100) !== autoModResult.pass)
            return;

        // do changes

        if (func === "add")
            room.addRule(rule)
        else
            room.removeRule(rule)

    }

    return handler;
}

export function generateModifyDescriptionHandler(session: Session) {
    const handler: ClientToServerEvents["modify description"] = (roomId, description) => {
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

        // check permissions

        if (room.data.owner !== userData.id)
            return;

        // check rule 

        if (AutoMod.text(description, 100) !== autoModResult.pass)
            return;

        // do changes

        room.updateDescription(description)
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

        if (getRoomsByUserId(userData.id).filter(room => room.data.owner === userData.id).length >= 5) {
            session.socket.emit("alert", 'Room Not Created', 'You can not be the owner of more than 5 rooms at once. If you really need to create another room, delete an unused room or transfer ownership of it to someone else.')
            return;
        }

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
    const handler: ClientToServerEvents["modify name or emoji"] = (roomId, edit, changeTo) => {

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
        if (!room) return

        // check permissions

        if (room.data.owner !== userData.id)
            return

        // run automod checks 

        if (edit === "name" && AutoMod.text(changeTo, 30) !== autoModResult.pass)
            return;

        if (edit === "emoji" && !AutoMod.emoji(changeTo))
            return;

        // do changes

        if (edit === "name") room.updateName(changeTo)
        if (edit === "emoji") room.updateEmoji(AutoMod.emoji(changeTo))
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

        const room = checkRoom(roomId, userData.id, false)
        if (!room) return

        // check permission

        if (userData.id === room.data.owner)
            return; // the owner can't leave their own room
        // they gotta go down with the ship

        // leave the room

        room.removeUser(userData.id)
        room.infoMessage(`${userData.name} left the room`)

        session.socket.emit("alert", `Left ${room.data.name}`, `You have successfully left ${room.data.name}`)

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

        respond(room.archive.getUnreadInfo(userData.id))

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

        const updateIds = room.archive.readMessage(userData, messageId)

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

        if (room.data.members.length < 3)
            return session.socket.emit("alert", `Can't Renounce Ownership`, `${room.data.name} is too small. You can only renounce ownership of rooms with 3 or more members.`)

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
            defaultOption: 'No'
        }).then(winner => {

            room.clearTempData("reclaimOwnershipPoll")

            if (winner !== 'Yes')
                return;

            if (!room.data.members.includes(userData.id))
                return

            room.setOwner(userData.id)
            room.infoMessage(`${userData.name} has been made the owner of the room.`)

        })
    }

    return handler;
}