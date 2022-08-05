import { socket } from '..';
import { io } from '../..';
import { ClientToServerEvents } from '../../lib/socket'
import { checkRoom } from '../../modules/rooms';
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