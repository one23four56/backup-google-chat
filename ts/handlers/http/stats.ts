import { reqHandlerFunction } from ".";
import authUser from "../../modules/userAuth";
import { checkRoom } from "../../modules/rooms";

export interface StatsObject {
    size: {
        messages: number;
        media: number;
    };
    messages: {
        allTime: number;
        past: number[];
        hours: number[];
        authors: {
            last7: Record<string, number>;
            allTime: Record<string, number>;
            today: Record<string, number>;
        }
    },
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
            .send("You are not permitted to view the stats of this room: either you are not a member, or the room does not exist")

    // request handling start

    const result: StatsObject = {
        messages: {
            allTime: 0,
            past: [0, 0, 0, 0, 0, 0, 0],
            hours: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
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

    // message data
    
    result.messages.allTime = room.archive.length;

    for (const message of room.archive.data.ref) {

        const time = new Date(message.time)

        const name = message.tags ?
            message.author.name + ' [' + message.tags.map(t => t.text).join('] [') + ']' :
            message.author.name

        // if message was sent less than a week ago
        if (time.getTime() > ago(7).getTime()) {

            for (let i = 0; i < 7; i++)
                compare(time, ago(i)) && result.messages.past[i]++

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
                    
                    result.messages.hours[dist1 > dist2 ? dist2 : dist1]++;

                }

            }

        }

        result.messages.authors.allTime[name] ?
            result.messages.authors.allTime[name]++ :
            result.messages.authors.allTime[name] = 1

    }

    res.json(result)

}