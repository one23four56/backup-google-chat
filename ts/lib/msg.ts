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
    replyTo?: Message
}