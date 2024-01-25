import { reqHandlerFunction } from ".";
import { checkRoom } from "../../modules/rooms";
import { Users } from "../../modules/users";
import * as fs from 'fs'
import { UserData } from "../../lib/authdata";
import { LedgerItem } from "../../modules/mediashare";
import { AllowedTypes } from "../../lib/socket";
import { isDMBlocked } from "../../modules/dms";

export const getMedia: reqHandlerFunction = async (req, res) => {

    // validate

    const { id, type, room: roomId } = req.params;

    if (typeof id !== "string" || typeof type !== "string" || typeof roomId !== "string" || (type !== "raw" && type !== "data"))
        return res.sendStatus(400)

    const room = checkRoom(roomId, req.userData.id)

    if (!room)
        return res.status(401).send("You are either not a member of this room or the room does not exist.")

    // check type

    if (type === "raw") {

        const item = await room.share.getData(id)

        if (!item)
            return res.type("image/svg+xml").send(fs.readFileSync("public/mediashare-404.svg"))
        // yeah i know sendFile exists i just really don't want to deal with path.join

        res.type(item.type);
        item.encoding && res.setHeader("Content-Encoding", item.encoding);
        res.send(item.buffer);

    } else if (type === "data") {

        const item = await room.share.getData(id)

        if (!item)
            return res.sendStatus(404)

        delete item.buffer;

        const output: MediaDataOutput = item as unknown as MediaDataOutput;

        output.user = Users.get(item.user) || false;
        output.size = room.share.getItemSize(item.id);
        output.totalSize = room.share.size;

        res.json(output)

    }
}

export interface MediaDataOutput extends Omit<LedgerItem, 'user'> {
    user: UserData | false;
    size: number;
    totalSize: number;
}

export const uploadMedia: reqHandlerFunction = async (req, res) => {

    const { room: roomId } = req.params;
    const { name, type: t } = req.query;

    const type = String(t).slice(0, 50);

    if (
        typeof roomId !== "string" ||
        typeof name !== "string" ||
        !Buffer.isBuffer(req.body)
    ) return res.sendStatus(400);

    const room = checkRoom(roomId, req.userData.id);

    if (!room || isDMBlocked(room)) return res.sendStatus(403);

    if (!AllowedTypes.includes(type)) return res.status(415).send("File type not supported");

    const bytes = Buffer.from(req.body);

    if (bytes.byteLength > room.data.options.maxFileSize * 1e6)
        return res.status(413).send("This file is too large.");

    // auto-delete
    
    if (room.share.size + bytes.byteLength > 1e8) {
        if (!room.data.options.autoDelete)
            return res.status(413).send(`The file cannot be uploaded as there is not enough space left.\n\nNote: Enabling auto-delete in the room options will allow you to upload this file.`)

        const recursiveDelete = () => {
            console.log(`mediashare: auto-delete invoked for file ${room.share.firstItemId}.bgcms`)
            room.share.remove(room.share.firstItemId)

            if (room.share.size + bytes.byteLength > 1e8)
                recursiveDelete()
        }

        recursiveDelete()
    }

    // add to share 

    const id = await room.share.add(bytes, { type, name }, req.userData.id)
    
    res.send(id);

}