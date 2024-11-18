import { UserData } from "./authdata";

export default interface Message {
    id: number;
    author: {
        id: string;
        name: string;
        image: string;
        webhookData?: {
            name: string;
            image: string
        }
    }
    text: string;
    time: Date;
    media?: MessageMedia[];
    reactions?: {
        [key: string]: {
            id: string;
            name: string
        }[]
    };
    tags?: {
        color: string;
        text?: string;
        bgColor: string;
        icon?: string;
        temporary?: true;
    }[];
    readIcons?: UserData[];
    replyTo?: Message;
    poll?: Poll | PollResult;
    notSaved?: true;
    deleted?: true;
    muted?: true;
    links?: string[];
}

/**
 * @deprecated use new message format
 */
export interface OldMessage {
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

export interface Poll {
    type: 'poll',
    finished: boolean,
    expires: number;
    question: string,
    options: {
        votes: number,
        option: string
        voters: string[]
    }[],
    id: number,
    creator: string,
}

export interface PollResult {
    type: 'result',
    question: string,
    winner: string,
    originId: number
}

export type MessageMedia = {
    type: "media" | "link";
    location: string;
    clickURL?: string;
    icon?: MediaIcon;
}

export interface MediaIcon {
    name: string;
    alwaysShowing: boolean;
    title: string;
    color?: string;
    outlineColor?: string;
    text?: string;
    isLink?: true;
}