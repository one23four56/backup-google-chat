import { reqHandlerFunction } from ".";
import { checkRoom } from "../../modules/rooms";
import authUser from "../../modules/userAuth";
import { Users } from "../../modules/users";
import * as fs from 'fs'
import { UserData } from "../../lib/authdata";
import { LedgerItem } from "../../modules/mediashare";

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