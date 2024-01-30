import { reqHandlerFunction } from ".";
import { checkRoom } from "../../modules/rooms";
import { Users } from "../../modules/users";

export interface StatsObject {
    size: {
        /**
         * Total size of just messages (bytes)
         */
        messages: number;
        /**
         * Total size of just media (bytes)
         */
        media: number;
    };
    messages: {
        numbers: {
            /**
             * Total messages sent
             */
            allTime: number;
            /**
             * Total number of messages sent with attached media
             */
            withMedia: number;
            /**
             * Total messages sent each day for the last 7 days. Index 0 is today, 1 is yesterday, etc
             */
            last7: number[];
            /**
             * Total messages sent each hour for the last 12 hours. Index 0 is this hour, 1 is last hour, etc
             */
            today: number[];
        }
        authors: {
            /**
             * How many messages people have sent over the last 7 days
             */
            last7: Record<string, number>;
            /**
             * How many messages people have sent
             */
            allTime: Record<string, number>;
            /**
             * How many messages people have sent today
             */
            today: Record<string, number>;
        }
        days: {
            /**
             * Total messages sent by weekday. Index 0 is sunday, 1 is monday, etc
             */
            total: number[];
            /**
             * Average messages sent on each weekday. Index 0 is sunday, 1 is monday, etc  
             * **Important Note:** This average excludes days where no messages were sent
             */
            average: number[];
            /**
             * Number of times each weekday has had one or more messages sent on it. Index 0 is sunday, 1 is monday, etc
             */
            active: number[];
        }
    };
    /**
     * Array of tuples of how many times each of the top 250 most-used words have been used
     * @example ["example", 5] // means the word example has been used 5 times
     */
    words: [string, number][];
    meta: {
        /**
         * Room name
         */
        name: string;
        /**
         * Room id
         */
        id: string;
        /**
         * Room emoji
         */
        emoji: string;
    }
    media: {
        /**
         * Total number of files(media) that were sent in the roo
         */
        total: number;
        /**
         * Data about the largest file
         */
        largest: {
            /**
             * Link to file
             */
            link: string;
            /**
             * File name
             */
            name: string;
            /**
             * File upload time (unix time)
             */
            timestamp: number;
            /**
             * Name of file author
             */
            author: string;
            /**
             * File size
             */
            size: number;
        }
    }
}

export const getStats: reqHandlerFunction = (req, res) => {

    const userData = req.userData;

    const roomId = req.params.room;

    if (!roomId)
        return res.sendStatus(400)

    const room = checkRoom(roomId, userData.id)

    if (!room)
        return res
            .status(401)
            .type('text/plain')
            .send("You are not permitted to view the stats of this room; either you are not a member, or the room does not exist")

    if (!room.data.options.statsPageAllowed)
        return res.status(403).send(`The stats page has been disabled by the room owner`)

    // request handling start

    const result: StatsObject = {
        messages: {
            numbers: {
                allTime: 0,
                withMedia: 0,
                last7: new Array(7).fill(0),
                today: new Array(12).fill(0),
            },
            authors: {
                last7: {},
                allTime: {},
                today: {}
            },
            days: {
                total: new Array(7).fill(0),
                average: [],
                active: new Array(7).fill(0)
            }
        },
        size: {
            media: 0,
            messages: 0
        },
        media: {
            total: 0,
            largest: {
                author: '',
                link: '',
                name: '',
                timestamp: 0,
                size: 0,
            }
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

    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        dateStyle: "short"
    })

    // some helper functions
    const compare = (date1: Date, date2: Date) => {
        return formatter.format(date1) === formatter.format(date2)
    }

    const ago = (num: number) => new Date(Date.now() - (num * 24 * 60 * 60 * 1000))

    result.messages.numbers.allTime = room.archive.length;

    const words = new Map<string, number>();
    const days: Record<string, [number, number]> = {};

    for (const message of room.archive.messageRef()) {

        if (typeof message === "undefined" || typeof message.time === "undefined")
            continue;

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

        result.messages.days.total[time.getDay()]++;

        // for average day count
        days[time.toLocaleDateString()] ??= [time.getDay(), 0]; // set if undefined
        days[time.toLocaleDateString()][1]++;

        if (message.media) {
            result.messages.numbers.withMedia++;
            result.media.total += message.media.length;
        }

        if (message.author.name === 'Info' || !message.text || typeof message.text.split !== "function")
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

    result.words = [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 250);

    {
        // fill(0) has to be here to initialize the array w/ values, otherwise map doesn't work
        const messagesPerWeekday: [number, number][] = new Array(7).fill(0).map(() => [0, 0])
        for (const [day, messages] of Object.values(days)) {

            if (isNaN(day)) continue;

            result.messages.days.active[day]++;

            messagesPerWeekday[day][0] += messages;
            messagesPerWeekday[day][1]++;
        }

        result.messages.days.average = messagesPerWeekday.map(([messages, days]) =>
            Math.round(messages / days)
        )
    }

    const largest = room.share.largestFile;

    if (largest) {
        result.media.largest.author = Users.get(largest.user).name;
        result.media.largest.link = `/media/${room.share.id}/${largest.id}/raw`;
        result.media.largest.name = largest.name ?? largest.id;
        result.media.largest.timestamp = largest.time;
        result.media.largest.size = room.share.getItemSize(largest.id)
    }

    res.type('application/json')

    if (req.query.pretty === "1")
        res.send(JSON.stringify(result, null, 4))
    else
        res.json(result)

}