export default interface Message {
    text: string;
    author: {
        name: string;
        img: string;
    };
    time: Date;
    archive?: boolean;
    isWebhook?: boolean;
    sentBy?: string;
    tag?: {
        color: string,
        text: string,
        bg_color: string,
    },
    image?: string,
    id?: number,
    channel?: {
        to: string,
        origin: string
    },
    mute?: boolean,
    index?: number,
    reactions?: {
        [key: string]: {
            id: string,
            name: string
        }[]
    }
    replyTo?: Message,
    poll?: Poll
}

// i messed up while making this as such that is extremely annoying to use
// could go back and fix it, but it isn't worth the effort
// if you ever have to work with polls just know that (poll as any) is your friend
export type Poll = {
    type: 'poll',
    finished: boolean,
    question: string,
    options: {
        votes: number,
        option: string
        voters: string[]
    }[],
    id?: number,
    creator?: string,
} | {
    type: 'result',
    question: string,
    winner: string,
    originId: number
}