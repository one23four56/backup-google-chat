import { ClientToServerEvents } from '../../lib/socket'
import { Session } from '../../modules/session'
import { checkRoom } from '../../modules/rooms';
import { AllowedTypes } from '../../lib/socket';
import * as path from 'path';
import { isDMBlocked } from '../../modules/dms';

export function upload(session: Session) {
    const handler: ClientToServerEvents["mediashare upload"] = (roomId, data, bytes, respond) => {

        // block malformed requests

        if (
            typeof roomId !== "string" ||
            typeof data !== "object" ||
            typeof data.name !== "string" ||
            typeof data.type !== "string" ||
            typeof bytes !== "object" ||
            !Buffer.isBuffer(bytes) ||
            typeof respond !== "function" ||
            !AllowedTypes.includes(data.type)
        )
            return;


        // get room

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id)
        if (!room || isDMBlocked(room)) return;

        // check size

        if (bytes.byteLength > 5e6)
            return;

        if (room.share.size + bytes.byteLength > 1e8) {
            if (!room.data.options.autoDelete)
                return session.socket.emit(
                    "alert",
                    "Upload Failed",
                    `The file is ${(bytes.byteLength / 1e6).toFixed(2)} MB and the total size is ${(room.share.size / 1e6).toFixed(2)} MB, adding it would push the total size above 100 MB.\n` +
                    `Note: enabling auto-delete in the room options will allow you to upload this file`
                )

            const recursiveDelete = () => {
                console.log(`mediashare: auto-delete invoked for file ${room.share.firstItemId}.bgcms`)
                room.share.remove(room.share.firstItemId)

                if (room.share.size + bytes.byteLength > 1e8)
                    recursiveDelete()
            }

            recursiveDelete()
        }

        // add to share

        const name = data.name?.trim().length > 0 ?
            path.parse(data.name).name // get file name
                .slice(0, 50) // limit max name length to 50 chars
                // clean up the name to make it easier to read, not really necessary but idc
                .replace(/ |_|\/|\(|\)|\.|,/g, "-")
                .toLowerCase()
            : `${userData.name.toLowerCase().replace(/ /g, "-")}-${Date.now()}`

        room.share.add(bytes, {
            type: data.type, name
        }, userData.id).then(id => respond(id))

    }

    return handler;
}