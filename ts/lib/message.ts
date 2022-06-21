import { Poll } from "./msg";

export default interface Message {
    id: number;
    author: {
        id: string;
        name: string;
        image: string;
        webhookData?: {
            name: string;
            img: string
        }
    }
    text: string;
    time: Date;
    archive: boolean;
    media?: any; // tbd
    reactions?: {
        [key: string]: {
            id: string;
            name: string
        }[]
    }
    tag?: {
        color: string;
        text: string;
        bgColor: string;
    }
    replyTo?: Message;
    poll?: Poll;
}