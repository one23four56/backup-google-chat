import { reqHandlerFunction } from ".";
import { checkRoom } from "../../modules/rooms";
import authUser from "../../modules/userAuth";
import { escape } from '../../modules/functions'
import { Users } from "../../modules/users";
import * as fs from 'fs'

export const getMedia: reqHandlerFunction = async (req, res) => {

    // validate

    const userData = authUser.full(req.headers.cookie)
    const { id, type, room: roomId } = req.params;

    if (!userData)
        return res.status(401).send(`You are not authorized`);

    if (typeof id !== "string" || typeof type !== "string" || typeof roomId !== "string" || (type !== "raw" && type !== "data"))
        return res.sendStatus(400)

    const room = checkRoom(roomId, userData.id)

    if (!room)
        return res.status(401).send("You are either not a member of this room or the room does not exist.")

    // check type

    if (type === "raw") {
        
        const item = await room.share.getData(id)

        if (!item)
            return res.type("image/svg+xml").send(fs.readFileSync("public/mediashare-404.svg"))
            // yeah i know sendFile exists i just really don't want to deal with path.join

        res.type(item.type)
        res.send(item.buffer)

    } else if (type === "data") {

        const item = await room.share.getData(id)

        if (!item)
            return res.sendStatus(404)

        let output = `<style>* {font-family: monospace; font-size: x-large}</style>`

        output += `<img src="raw" height="75%"><br><br>`

        // i don't need to escape all of these but i am not taking any chances
        output += `ID: ${escape(item.id)}<br><br>`
        output += `Uploaded At: ${escape(new Date(item.time).toUTCString())}<br><br>`

        const user = Users.get(item.user)

        if (user) {
            output += `Uploaded By: ${escape(user.name)}<br><br>`
        } else {
            output += `Uploaded By: Unknown (${escape(item.user)})<br><br>`
        }
        
        output += `Shared In: ${escape(room.data.name)} (${escape(room.data.id)})<br><br>`
        output += `File Type: ${escape(item.type)}<br><br>`
        output += `File Size: ${room.share.getItemSize(item.id)} Bytes<br><br>`
        output += `Checksum: ${escape(item.hash)} <a href="/notices/mediashare-checksum.md">(sha-256, base64)</a><br><br>`

        res.send(output)

    }
}