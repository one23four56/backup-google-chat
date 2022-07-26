// types for socket.io
// make sure to add stuff to here, otherwise you will get an error 

import Message from "./msg";
import Room, { RoomFormat } from "../modules/rooms";
import { UserData } from "./authdata";
import { ProtoWebhook } from "../modules/webhooks";

export interface SubmitData {
    text: string;
    archive: boolean;
    //TODO media?: any; // tbd
    image?: string;
    webhook?: {
        name: string;
        id: string;
        image: string;
    };
    replyTo?: number;
}

export interface ClientToServerMessageData {
    text: string | void;
    // recipient: string | void;
    archive: boolean | void;
    // image?: string | void;
    replyTo?: number | void;
    // id?: string | void;
    webhook?: SubmitData["webhook"];
}

export interface InitialData {
    me: UserData,
    rooms: RoomFormat[]
}

export interface ServerToClientEvents {
    'room data': ( rooms: Room[] ) => void;
    'load data updated': ()=>void;
    'message-deleted': (roomId: string, id: number)=>void;
    'message-edited': (roomId: string, message: Message)=>void;
    'typing': (roomId: string, name: string) => void;
    'end typing': (roomId: string, name: string) => void;
    'reaction': (roomId: string, id: number, message: Message) => void;
    'alert': (title: string, message: string) => void;
    'user voted in poll': (id: number, poll: Message) => void;
    'incoming-message': (roomId: string, message: Message) => void;
    'connection-update': (data: {connection: boolean, name: string}) => void;
    'auto-mod-update': (text: string) => void;
    'forced_disconnect': (reason: string) => void;
    'forced to disconnect': (reason: string) => void;
    'ping': (from: string, respond: () => void) => void;
}

export interface ClientToServerEvents {
    'ready for initial data': (respond: ((data: InitialData) => void) | void) => void;
    
    'get room messages': (roomId: string | void, respond: ((data: Message[]) => void) | void) => void;
    
    'get webhooks': (roomId: string | void, respond: ((webhooks: ProtoWebhook[]) => void) | void) => void;

    'delete-message': (roomId: string | void, id: number | void)=>void;
    'edit-message': (roomId: string | void, data: {messageID: number | void; text: string | void})=>void;
    'status-set': (data: {status: string | void; char: string | void})=>void;
    'status-reset': ()=>void;
    'typing start': (roomId: string | void) => void;
    'typing stop': (roomId: string | void) => void;
    'react': (roomId: string | void, id: number | void, emoji: string | void) => void;
    'start delete webhook poll': (id: string | void) => void;
    'send ping': (id: string | void) => void;
    'message': (id: string | void, data: ClientToServerMessageData | void, respond: void | ((sent: boolean)=>void)) => void;
    'send-webhook-message': (data: { data: ClientToServerMessageData } | void) => void;
    'delete-webhook': (id: string | void) => void;
    'edit-webhook': (data: { id: string | void; webhookData: { newName: string | void; newImage: string | void } }) => void;
    'add-webhook': (data: {name: string | void; image: string | void; private: boolean | void}) => void;
    'shorten url': (url: string | void, respond: void | ((url: string) => void)) => void;
    'vote in poll': (id: number | void, vote: string | void) => void;
}
