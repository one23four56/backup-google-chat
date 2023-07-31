<!--title:Raw Stats Data Format:title-->
<!--date:2022-12-11:date-->

# Raw Stats Data Format

The raw stats data implements the following interface:

```ts

// Last format change: 2023-4-23 (BGC v3.2.2)

interface StatsObject {
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
         * Total number of files(media) that were sent in the room
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
};

// feel free to copy+paste this if you need to, i don't care

```

**Note:** The above interface is in [TypeScript](https://www.typescriptlang.org/); however, the data itself is provided in [JSON](https://www.json.org/).
