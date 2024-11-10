import { reqHandlerFunction } from ".";
import Message from "../../lib/msg";
import { BotAnalytics } from "../../modules/bots";
import Room, { checkRoom, rooms } from '../../modules/rooms';
import { toUserBotRoom } from "../../modules/userBots";

export const getRooms: reqHandlerFunction = (req, res) => {
    const botId = req.bot;

    if (typeof botId !== "string")
        return res.sendStatus(400);

    const rooms = Array.from(BotAnalytics.getRooms(botId))
        .map(id => toUserBotRoom(new Room(id)));

    res.json(rooms);
}

export const getArchive: reqHandlerFunction = (req, res) => {
    const botId = req.bot, roomId = req.params.room;

    if (typeof botId !== "string" || typeof roomId !== "string")
        return res.sendStatus(400);

    const room = checkRoom.bot(roomId, botId);
    if (!room) return res.sendStatus(403);

    if (!room.data.options.archiveViewerAllowed || !room.data.options.allowBotsOnArchive)
        return res.status(403).type("text/plain").send("Cannot access room archive");

    const out: Message[] = [];
    for (const message of room.archive.messageRef())
        out.push(message);

    res.json(out);
}

export const getMessages: reqHandlerFunction = (req, res) => {
    const botId = req.bot, roomId = req.params.room;

    if (typeof botId !== "string" || typeof roomId !== "string")
        return res.sendStatus(400);

    const room = checkRoom.bot(roomId, botId);
    if (!room) return res.sendStatus(403);

    const out: Message[] = [];
    let count = 0;
    for (const message of room.archive.messageRef(true)) {
        out.push(message);
        if ((count += 1) === 50) break;
    }

    res.json(out);
}