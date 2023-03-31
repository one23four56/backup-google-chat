import { reqHandlerFunction } from ".";
import authUser from "../../modules/userAuth";
import { checkRoom } from "../../modules/rooms";

export interface StatsObject {
    size: {
        messages: number;
        media: number;
    };
    messages: {
        numbers: {
            allTime: number;
            last7: number[];
            today: number[];
        }
        authors: {
            last7: Record<string, number>;
            allTime: Record<string, number>;
            today: Record<string, number>;
        }
    };
    words: [string, number][];
    meta: {
        name: string;
        id: string;
        emoji: string;
    }
}

export const getStats: reqHandlerFunction = (req, res) => {

    const userData = authUser.full(req.headers.cookie);
    if (!userData)
        return res.sendStatus(401)

    const roomId = req.params.room;

    if (!roomId)
        return res.sendStatus(400)

    const room = checkRoom(roomId, userData.id)

    if (!room)
        return res
            .status(401)
            .type('text/plain')
            .send("You are not permitted to view the stats of this room; either you are not a member, or the room does not exist")

    // request handling start

    const result: StatsObject = {
        messages: {
            numbers: {
                allTime: 0,
                last7: [0, 0, 0, 0, 0, 0, 0],
                today: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            },
            authors: {
                last7: {},
                allTime: {},
                today: {}
            }
        },
        size: {
            media: 0,
            messages: 0
        },
        words: [],
        meta: {
            name: room.data.name,
            id: room.data.id,
            emoji: room.data.emoji
        }
    };

    // size data
    result.size.messages = room.archive.size;
    result.size.media = room.share.size;

    // some helper functions
    const compare = (date1: Date, date2: Date) => {
        return date1.toLocaleDateString('en-US', { timeZone: 'America/Chicago' }) ===
            date2.toLocaleDateString('en-US', { timeZone: 'America/Chicago' })
    }

    const ago = (num: number) => new Date(Date.now() - (num * 24 * 60 * 60 * 1000))


    result.messages.numbers.allTime = room.archive.length;

    const words = new Map<string, number>();

    for (const message of room.archive.data.ref) {

        const time = new Date(message.time)

        const { name } = message.author

        // if message was sent less than a week ago
        if (time.getTime() > ago(7).getTime()) {

            for (let i = 0; i < 7; i++)
                compare(time, ago(i)) && result.messages.numbers.last7[i]++

            result.messages.authors.last7[name] ?
                result.messages.authors.last7[name]++ :
                result.messages.authors.last7[name] = 1

            // if message was sent today
            if (compare(time, ago(0))) {

                result.messages.authors.today[name] ?
                    result.messages.authors.today[name]++ :
                    result.messages.authors.today[name] = 1

                // if message was sent less than 11 hours ago
                if (Date.now() - time.getTime() < 11 * 60 * 60 * 1000) {

                    // this is nested way too much for my taste but it does not really 
                    // make this any harder to read so i guess i'll just leave it

                    const old = time.getHours()
                    const current = new Date().getHours()

                    const dist1 = Math.abs(old - current);
                    const dist2 = Math.abs(24 - dist1);

                    result.messages.numbers.today[dist1 > dist2 ? dist2 : dist1]++;

                }

            }

        }

        result.messages.authors.allTime[name] ?
            result.messages.authors.allTime[name]++ :
            result.messages.authors.allTime[name] = 1

        // other interesting stats

        if (message.author.name === 'Info')
            continue;

        for (const word of message.text.split(' ')) {

            if (message.deleted)
                continue;

            if (message.tags && message.tags.some(v => v.text === "BOT"))
                continue;

            const parsed = word.toLowerCase().trim();

            if (!parsed)
                continue;

            words.has(parsed) ?
                words.set(parsed, words.get(parsed) + 1) : words.set(parsed, 1)
                // note: words[parsed]++ CANNOT be used here since if the word size is sent
                // then this will attempt to increase the 'size' property of the words map
                // which causes an error
        }

    }

    // other interesting data

    result.words = [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 250)

    res.type('application/json')

    if (req.query.pretty === "1")
        res.send(JSON.stringify(result, null, 4))
    else
        res.json(result)

}