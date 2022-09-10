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

        if (room.share.size + bytes.byteLength > 1e8) {
            if (!room.data.options.autoDelete)
                return session.socket.emit(
                    "alert",
                    "Upload Failed",
                    `The file is ${(bytes.byteLength / 1e6).toFixed(2)} MB and the total size is ${(room.share.size / 1e6).toFixed(2)} MB, adding it would push the total size above 100 MB`
                )

            const recursiveDelete = () => {
                room.share.remove(room.share.firstItemId)

                if (room.share.size + bytes.byteLength > 1e8)
                    recursiveDelete()
            }

            recursiveDelete()
        }

        // add to share

        room.share.add(bytes, type, userData.id).then(id => respond(id))

    }

    return handler;
}