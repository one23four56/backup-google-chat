import { reqHandlerFunction } from ".";
import Message from "../../lib/msg";
import { BotAnalytics, BotList, BotOutput, BotUtilities } from "../../modules/bots";
import Room, { checkRoom } from '../../modules/rooms';
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

interface SendMessageRequest {
    data: BotOutput,
    include?: string[],
    exclude?: string[],
    wake?: boolean;
}

export const sendMessage: reqHandlerFunction = async (req, res) => {
    if (typeof req.body !== "object") return res.sendStatus(400);

    const botId = req.bot;
    if (typeof botId !== "string") return res.sendStatus(400);

    const output = req.body.data;
    if (!BotUtilities.isBotOutput(output)) return res.sendStatus(400);

    const wake = req.body.wake === true;

    let include: string[] | undefined, exclude: string[] | undefined;

    {
        const rawInclude = req.body.include, rawExclude = req.body.exclude;

        if (typeof rawInclude == "object" && Array.isArray(rawInclude) && rawInclude.every(e => typeof e === "string"))
            include = rawInclude;

        if (typeof rawExclude == "object" && Array.isArray(rawExclude) && rawExclude.every(e => typeof e === "string"))
            exclude = rawExclude;
    }

    const bot = BotList.get(botId);
    if (!bot || !bot.hooks) return res.sendStatus(400);

    const out: Record<string, boolean> = {};
    for (const id of BotAnalytics.getRooms(botId)) {
        out[id] = false;
        if (wake) new Room(id); // wake up room
    }

    for (const [id, hook] of bot.hooks.entries()) {
        if (exclude && exclude.includes(id)) continue;
        if (include && !include.includes(id)) continue;

        out[id] = await hook(output);
    };

    res.json(out);
};