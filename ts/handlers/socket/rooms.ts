import { io, sessions as mainSessions } from '../..';
import { ClientToServerEvents } from '../../lib/socket'
import AutoMod, { autoModResult } from '../../modules/autoMod';
import { checkRoom, createRoom, defaultOptions, getRoomsByUserId } from '../../modules/rooms';
import { Session } from '../../modules/session';
import { Users } from '../../modules/users';

export function generateGetMessagesHandler(session: Session) {
    const handler: ClientToServerEvents["get room messages"] = (roomId, respond) => {
        // block malformed requests

        if (
            (!roomId || !respond) ||
            typeof roomId !== "string" ||
            typeof respond !== "function"
        )
            return;

        // get room

        const room = checkRoom(roomId, session.userData.id)
        if (!room) return;

        // respond with messages

        respond(
            room.archive.queryArchive(0, 50, true)
        )
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

        const room = checkRoom(roomId, userData.id)
        if (!room) return;

        // check user

        if (room.data.members.includes(userId))
            return;
        
        const userToAdd = Users.get(userId)

        if (!userToAdd)
            return;

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
                        message: `${userData.name} wants to invite ${userToAdd.name} to the room. (Poll by System; ends in 1 minute)`,
                        prompt: `Invite ${userToAdd.name}?`,
                        option1: {
                            option: 'Yes',
                            votes: 0,
                            voters: [],
                        },
                        option2: {
                            option: 'No',
                            votes: 1,
                            voters: ["System"],

                        }
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

                room.addUser(userId)

                room.infoMessage(`${userData.name} invited ${userToAdd.name} to the room`)

                io.to(room.data.id).emit("member data", room.data.id, room.getMembers())
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

        const room = checkRoom(roomId, userData.id)
        if (!room) return;

        // check user

        if (!room.data.members.includes(userId))
            return;

        if (room.data.owner === userId)
            return;

        const userToRemove = Users.get(userId)

        if (!userToRemove)
            return;

        // check permissions (async)

        new Promise<void>((resolve, reject) => {
            const permissions = room.data.options.permissions

            if (permissions.invitePeople === "owner" && room.data.owner !== userData.id)
                reject(`${room.data.name}'s rules only allow the room owner to remove users.`)

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

                if (room.getTempData("removeUserPollInProgress"))
                    reject(`${room.data.name} already has a poll to remove someone in progress. Please wait until it ends, and try again.`);

                else {
                    room.setTempData<boolean>("removeUserPollInProgress", true);

                    room.createPollInRoom({
                        message: `${userData.name} wants to remove ${userToRemove.name} from the room. (Poll by System; ends in 1 minute)`,
                        prompt: `Remove ${userToRemove.name}?`,
                        option1: {
                            option: 'Yes',
                            votes: 0,
                            voters: [],
                        },
                        option2: {
                            option: 'No',
                            votes: 1,
                            voters: ["System"],

                        }
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

                io.to(room.data.id).emit("member data", room.data.id, room.getMembers())
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

        session.socket.emit("online list", room.data.id, room.sessions.getOnlineList())
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

        const room = checkRoom(roomId, userData.id)
        if (!room) return;

        // check permissions

        if (room.data.owner !== userData.id)
            return; 

        // check rule 

        if (AutoMod.autoModText(rule, 100) !== autoModResult.pass)
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

        const room = checkRoom(roomId, userData.id)
        if (!room) return;

        // check permissions

        if (room.data.owner !== userData.id)
            return;

        // check rule 

        if (AutoMod.autoModText(description, 100) !== autoModResult.pass)
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

        // run automod checks

        if (
            AutoMod.autoModText(description, 100) !== autoModResult.pass ||
            AutoMod.autoModText(name, 30) !== autoModResult.pass ||
            AutoMod.autoModText(emoji, 6) !== autoModResult.pass
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
            emoji,
            members,
            description,
            owner: userData.id,
            options: defaultOptions
        })

        // broadcast room and add sessions

        for (const member of members) {

            const broadCastToSession = mainSessions.getByUserID(member)

            if (broadCastToSession) {
                broadCastToSession.socket.emit("added to room", room.data)
                room.addSession(broadCastToSession)
            }
        }

    }

    return handler;
}