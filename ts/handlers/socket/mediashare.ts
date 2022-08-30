import { ClientToServerEvents } from '../../lib/socket'
import { Session } from '../../modules/session'
import { checkRoom } from '../../modules/rooms';
import { AllowedTypes } from '../../lib/socket';

export function upload(session: Session) {
    const handler: ClientToServerEvents["mediashare upload"] = (roomId, type, bytes, respond) => {

        // block malformed requests

        if (
            typeof roomId !== "string" ||
            typeof type !== "string" ||
            typeof bytes !== "object" ||
            !Buffer.isBuffer(bytes) ||
            typeof respond !== "function" ||
            !AllowedTypes.includes(type)
        )
            return;


        // get room

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id)
        if (!room) return;

        // check size

        if (bytes.byteLength > 5e6)
            return;

        if (room.share.size > 1e8)
            return session.socket.emit("alert", "Upload Failed", `The current size of all media shared in this room is ${(room.share.size / 1e6).toFixed(2)} MB, which exceeds the maximum size of 100 MB`)

        // add to share

        room.share.add(bytes, type, userData.id).then(id => respond(id))

    }

    return handler;
}