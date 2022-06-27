// types for socket.io
// make sure to add stuff to here, otherwise you will get an error 

import Message from "./msg";

export interface ClientToServerMessageData {
    text: string | void;
    recipient: string | void;
    archive: boolean | void;
    image?: string | void;
    replyTo?: number | void;
    id?: string | void;
}

export interface ServerToClientEvents {
    'load data updated': ()=>void;
    'message-deleted': (id: number)=>void;
    'message-edited': (message: Message)=>void;
    'typing': (name: string, channel: string) => void;
    'end typing': (name: string, channel: string) => void;
    'reaction': (id: number, message: Message) => void;
    'alert': (title: string, message: string) => void;
    'user voted in poll': (id: number, poll: Message) => void;
    'incoming-message': (message: Message) => void;
    'connection-update': (data: {connection: boolean, name: string}) => void;
    'auto-mod-update': (text: string) => void;
    'forced_disconnect': (reason: string) => void;
    'forced to disconnect': (reason: string) => void;
    'ping': (from: string, respond: () => void) => void;
}

export interface ClientToServerEvents {
    'delete-message': (id: number | void)=>void;
    'edit-message': (data: {messageID: number | void; text: string | void})=>void;
    'status-set': (data: {status: string | void; char: string | void})=>void;
    'status-reset': ()=>void;
    'typing start': (channel: string | void) => void;
    'typing stop': (channel: string | void) => void;
    'react': (id: number | void, emoji: string | void) => void;
    'start delete webhook poll': (id: string | void) => void;
    'send ping': (id: string | void) => void;
    'message': (data: ClientToServerMessageData, respond: (message: Message)=>void) => void;
    'send-webhook-message': (data: { data: ClientToServerMessageData } | void) => void;
    'delete-webhook': (id: string | void) => void;
    'edit-webhook': (data: { id: string | void; webhookData: { newName: string | void; newImage: string | void } }) => void;
    'add-webhook': (data: {name: string | void; image: string | void; private: boolean | void}) => void;
    'shorten url': (url: string | void, respond: void | ((url: string) => void)) => void;
}
