import { ClientToServerEvents } from '../../lib/socket'
import { checkRoom } from '../../modules/rooms';
import { Session } from '../../modules/session';

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