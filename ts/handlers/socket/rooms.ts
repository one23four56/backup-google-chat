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

        // check permissions

        const permissions = room.data.options.permissions

        if (permissions.invitePeople === "owner" && room.data.owner !== userData.id)
            return;

        // check user

        if (!Users.get(userId))
            return;

        if (room.data.members.includes(userId))
            return;

        // perform invite

        room.addUser(userId)

        room.infoMessage(`${userData.name} invited ${Users.get(userId).name} to the room`)
        
        io.to(room.data.id).emit("member data", room.data.id, room.getMembers())

    }

    return handler;
}