// types for socket.io
// make sure to add stuff to here, otherwise you will get an error 

import Message from "./msg";
import { RoomFormat } from "../modules/rooms";
import { OnlineStatus, OnlineUserData, Status, UserData } from "./authdata";
import { ProtoWebhook } from "../modules/webhooks";
import { BotData } from "../modules/bots";
import { CreateRoomData, MemberUserData } from "./misc";
import { DMFormat } from "../modules/dms";
import { BasicInviteFormat } from '../modules/invites'
import { UnreadInfo } from "../modules/archive";
import { DefaultSettings } from "../lib/settings"

export interface SubmitData {
    text: string;
    archive: boolean;
    media?: string[];
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
    media?: string[];
}

export interface InitialData {
    me: UserData,
    rooms: RoomFormat[],
    dms: Required<DMFormat>[],
    invites: BasicInviteFormat[]
}

export interface ServerToClientEvents {
    'room data': ( rooms: RoomFormat[] ) => void;
    
    'load data updated': ()=>void;
    
    'message-deleted': (roomId: string, id: number)=>void;
    
    'message-edited': (roomId: string, message: Message)=>void;
    
    'typing': (roomId: string, names: string[]) => void;
    
    'reaction': (roomId: string, id: number, message: Message) => void;
    
    'alert': (title: string, message: string) => void;
    
    'user voted in poll': (roomId: string, poll: Message) => void;
    
    'incoming-message': (roomId: string, message: Message) => void;
    
    'connection-update': (data: {connection: boolean, name: string}) => void;

    'online list': (roomId: string, users: OnlineUserData[]) => void;
    
    'auto-mod-update': (text: string) => void;
    
    'forced_disconnect': (reason: string) => void;
    
    'forced to disconnect': (reason: string) => void;
    
    'ping': (from: string, respond: () => void) => void;

    'webhook data': (roomId: string, data: ProtoWebhook[]) => void;

    'member data': (roomId: string, data: MemberUserData[]) => void;

    'added to room': (roomData: RoomFormat) => void;

    'removed from room': (roomId: string) => void;

    'bot data': (roomId: string, data: BotData[]) => void;

    'room details updated': (roomId: string, data: {desc: string; rules: string[]}) => void;

    'hot reload room': (roomId: string, roomData: RoomFormat) => void;

    'invites updated': (invites: BasicInviteFormat[]) => void;

    'added to dm': (dm: Required<DMFormat>) => void;

    'userData updated': (userData: OnlineUserData) => void;

    'online state change': (id: string, state: OnlineStatus) => void;

    'bulk message updates': (roomId: string, messages: Message[]) => void;
}

export interface ClientToServerEvents {
    'ready for initial data': (respond: ((data: InitialData) => void) | void) => void;
    
    'get room messages': (roomId: string | void, startAt: number | void, respond: ((data: Message[]) => void) | void) => void;
    
    'get webhooks': (roomId: string | void, respond: ((webhooks: ProtoWebhook[]) => void) | void) => void;

    'get online list': (roomId: string | void) => void;

    'delete-message': (roomId: string | void, id: number | void)=>void;
    
    'edit-message': (roomId: string | void, data: {messageID: number | void; text: string | void})=>void;
    
    'status-set': (data: Status) => void;
    
    'status-reset': () => void;
    
    'typing': (roomId: string | void, start: boolean) => void;
    
    'react': (roomId: string | void, id: number | void, emoji: string | void) => void;
    
    'send ping': (id: string | void) => void;
    
    'message': (id: string | void, data: ClientToServerMessageData | void, respond: void | ((sent: boolean)=>void)) => void;
    
    'delete-webhook': (roomId: string | void, id: string | void) => void;
    
    'edit-webhook': (roomId: string | void, data: { id: string | void; webhookData: { newName: string | void; newImage: string | void } }) => void;
    
    'add-webhook': (roomId: string | void, data: {name: string | void; image: string | void; private: boolean | void}) => void;
    
    'shorten url': (url: string | void, respond: void | ((url: string) => void)) => void;
    
    'vote in poll': (roomId: string | void, id: number | void, vote: string | void) => void;

    'get member data': (roomId: string | void) => void;

    'invite user': (roomId: string | void, userId: string | void) => void;

    'remove user': (roomId: string | void, userId: string | void) => void;

    'query users by name': (name: string | void, respond: void | ((users: UserData[]) => void)) => void;

    'get bot data': (roomId: string | void) => void;

    'modify rules': (roomId: string | void, func: "add" | "delete" | void, rule: string | void) => void;

    'modify description': (roomId: string | void, description: string | void) => void;

    'create room': (data: CreateRoomData | void) => void;

    'modify options': (roomId: string, options: RoomFormat["options"]) => void;

    'modify name or emoji': (roomId: string | void, edit: "name" | "emoji" | void, changeTo: string | void) => void;

    'query bots by name': (name: string | void, respond: void | ((bots: BotData[]) => void)) => void;

    'modify bots': (roomId: string | void, action: "add" | "delete" | void, name: string | void) => void;

    'invite action': (inviteId: string, action: "accept" | "decline") => void;

    'start dm': (userId: string | void) => void;

    'leave room': (roomId: string | void) => void;

    'delete room': (roomId: string | void) => void;

    'mediashare upload': (roomId: string | void, type: string, bytes: Uint8Array, respond: (id: string) => void) => void;

    'read message': (roomId: string | void, messageId: number | void) => void;

    'renounce ownership': (roomId: string | void) => void;

    'claim ownership': (roomId: string | void) => void;

    'set schedule': (schedule: string[]) => void;

    'set online state': (idle: OnlineStatus) => void;

    'get unread data': (roomId?: string, respond?: (data: UnreadInfo) => void) => void;

    'update setting': <key extends keyof typeof DefaultSettings>(setting: key, value: typeof DefaultSettings[key]) => void;
}

export const AllowedTypes = [
    "image/apng",
    "image/avif",
    "image/gif",
    "image/jpeg",
    "image/png",
    "image/svg+xml",
    "image/webp"
]