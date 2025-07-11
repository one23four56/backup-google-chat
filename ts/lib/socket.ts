// types for socket.io
// make sure to add stuff to here, otherwise you will get an error 

import Message, { Poll } from "./msg";
import { RoomFormat } from "../modules/rooms";
import { OnlineStatus, OnlineUserData, Status, UserData } from "./authdata";
import { ProtoWebhook } from "../modules/webhooks";
import { BotData } from "../modules/bots";
import { CreateRoomData, MemberUserData } from "./misc";
import { DMFormat } from "../modules/dms";
import { BasicInviteFormat } from '../modules/invites'
import { UnreadInfo } from "../modules/archive";
import { DefaultSettings } from "../lib/settings"
import { UploadData } from "../modules/mediashare";
import { Notification } from "./notifications";

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
    poll?: PollData;
    links?: string[];
}

export interface PollData {
    question: string;
    expires: number;
    options: string[];
}

export function isPollData(object: any): object is PollData {

    if (
        typeof object !== "object" ||
        typeof object.question !== "string" ||
        typeof object.expires !== "number" ||
        !Array.isArray(object.options) ||
        object.question.length > 50 ||
        object.question.length < 1 ||
        object.options.length > 5 ||
        object.options.length < 2 ||
        object.expires - Date.now() < 1000 * 60 * 1 ||
        object.expires - Date.now() > 1000 * 60 * 60 * 24 * 7
    )
        return false;

    for (const opt of object.options) {
        if (typeof opt !== "string" || opt.length > 50 || opt.length < 1)
            return false;
    }

    return true;

}

export interface DebugData {
    serverStart: number;
    clientStart: number;
    timezone: number;
    version: string;
    node: string;
    socket: [number, number];
    global: [number, number];
    badReads: number;
    data: [number, number, number];
    memory: NodeJS.MemoryUsage,
    cpu: NodeJS.CpuUsage
}

export interface InitialData {
    me: UserData,
    rooms: RoomFormat[],
    dms: Required<DMFormat>[],
    invites: BasicInviteFormat[],
    blocklist: [string[], string[]];
}

export interface ServerToClientEvents {
    'room data': (rooms: RoomFormat[]) => void;

    'load data updated': () => void;

    'message-deleted': (roomId: string, id: number) => void;

    'message-edited': (roomId: string, message: Message) => void;

    'typing': (roomId: string, names: string[]) => void;

    'reaction': (roomId: string, id: number, message: Message) => void;

    'alert': (title: string, message: string) => void;

    'user voted in poll': (roomId: string, poll: Poll) => void;

    'incoming-message': (roomId: string, message: Message) => void;

    'connection-update': (data: { connection: boolean, name: string }) => void;

    'online list': (roomId: string, online: OnlineUserData[], offline: OnlineUserData[], invited: OnlineUserData[]) => void;

    'auto-mod-update': (text: string) => void;

    'forced to disconnect': (reason: string) => void;

    'ping': (from: string, respond: () => void) => void;

    'webhook data': (roomId: string, data: ProtoWebhook[]) => void;

    'member data': (roomId: string, data: MemberUserData[]) => void;

    'added to room': (roomData: RoomFormat) => void;

    'removed from room': (roomId: string) => void;

    'bot data': (roomId: string, data: BotData[]) => void;

    'room details updated': (roomId: string, data: { desc: string; rules: string[] }) => void;

    'hot reload room': (roomId: string, roomData: RoomFormat) => void;

    'invites updated': (invites: BasicInviteFormat[]) => void;

    'added to dm': (dm: Required<DMFormat>) => void;

    'userData updated': (userData: OnlineUserData) => void;

    'online state change': (id: string, state: OnlineStatus) => void;

    'bulk message updates': (roomId: string, messages: Message[]) => void;

    'mute': (roomId: string, muted: boolean) => void;

    'block': (userId: string, block: boolean, list: 0 | 1) => void;

    'notification': (notification: Notification) => void;

    'remove notification': (id: string) => void;
}

export interface ClientToServerEvents {
    'get room messages': (roomId: string | void, startAt: number | true, respond: ((data: Message[]) => void) | void) => void;

    'get webhooks': (roomId: string | void, respond: ((webhooks: ProtoWebhook[]) => void) | void) => void;

    'get online list': (roomId: string | void) => void;

    'delete-message': (roomId: string | void, id: number | void) => void;

    'edit-message': (roomId: string | void, data: { messageID: number | void; text: string | void }) => void;

    'status-set': (char: string, status: string) => void;

    'status-reset': () => void;

    'typing': (roomId: string | void, start: boolean) => void;

    'react': (roomId: string | void, id: number | void, emoji: string | void) => void;

    'send ping': (id: string | void) => void;

    'message': (id: string | void, data: SubmitData | void, respond: void | ((sent: boolean) => void)) => void;

    'delete-webhook': (roomId: string | void, id: string | void) => void;

    'edit-webhook': (roomId: string | void, data: { id: string | void; webhookData: { newName: string | void; newImage: string | void } }) => void;

    'add-webhook': (roomId: string | void, data: { name: string | void; image: string | void; private: boolean | void }) => void;

    'vote in poll': (roomId: string | void, id: number | void, vote: string | void) => void;

    'get member data': (roomId: string | void) => void;

    'invite user': (roomId: string | void, userId: string | void) => void;

    'remove user': (roomId: string | void, userId: string | void) => void;

    'query users by name': (name: string | void, includeBlocked: boolean, respond: void | ((users: UserData[]) => void)) => void;

    'get bot data': (roomId: string | void) => void;

    'modify rules': (roomId: string | void, func: "add" | "delete" | void, rule: string | void) => void;

    'modify description': (roomId: string | void, description: string | void) => void;

    'create room': (data: CreateRoomData | void) => void;

    'modify options': (roomId: string, options: RoomFormat["options"]) => void;

    'modify name or emoji': (roomId: string | void, edit: "name" | "emoji" | void, changeTo: string | void) => void;

    'query bots by name': (name: string | void, respond: void | ((bots: BotData[]) => void)) => void;

    'modify bots': (roomId: string, action: boolean, id: string) => void;

    'invite action': (inviteId: string, action: "accept" | "decline") => void;

    'start dm': (userId: string | void) => void;

    'leave room': (roomId: string | void) => void;

    'delete room': (roomId: string | void) => void;

    'mediashare upload': (roomId: string | void, data: UploadData, bytes: Uint8Array, respond: (id: string) => void) => void;

    'read message': (roomId: string | void, messageId: number | void) => void;

    'renounce ownership': (roomId: string | void) => void;

    'claim ownership': (roomId: string | void) => void;

    'set schedule': (schedule: string[]) => void;

    'set online state': (idle: OnlineStatus) => void;

    'get unread data': (roomId?: string, respond?: (data: UnreadInfo) => void) => void;

    'update setting': <key extends keyof typeof DefaultSettings>(setting: key, value: typeof DefaultSettings[key]) => void;

    'get active polls': (roomId: string, respond: (active: [UserData, Poll][], old: [UserData, Poll, number][]) => void) => void;

    'block': (userId: string, block: boolean) => void; a

    'get notifications': (respond: (notifications: Notification[]) => void) => void;

    'dismiss notification': (id: string) => void;

    'mute or kick': (room: string, mute: boolean, user: string, minutes: number, bot?: true) => void;

    'debug': (respond: (data: DebugData) => void) => void;
}

export enum MediaCategory {
    image,
    text,
    pdf
}

export const TypeCategories = {
    "image/apng": MediaCategory.image,
    "image/avif": MediaCategory.image,
    "image/gif": MediaCategory.image,
    "image/jpeg": MediaCategory.image,
    "image/png": MediaCategory.image,
    "image/svg+xml": MediaCategory.image,
    "image/webp": MediaCategory.image,
    "text/plain": MediaCategory.text,
    "text/css": MediaCategory.text,
    "text/csv": MediaCategory.text,
    "text/html": MediaCategory.text,
    "text/markdown": MediaCategory.text,
    "text/xml": MediaCategory.text,
    "application/json": MediaCategory.text,
    "application/javascript": MediaCategory.text,
    "text/javascript": MediaCategory.text,
    "application/x-javascript": MediaCategory.text,
    "application/xml": MediaCategory.text,
    "application/pdf": MediaCategory.pdf
}

export const AllowedTypes = Object.keys(TypeCategories);

// types of files to compress when uploaded
// for other file types compression is not worth it
export const CompressTypes = [
    "image/svg+xml",
    "text/plain",
    "text/css",
    "text/csv",
    "text/html",
    "text/markdown",
    "text/xml",
    "application/json",
    "application/javascript",
    "text/javascript",
    "application/x-javascript",
    "application/xml",
]

export function iconUrl(type: string, url: string): string {
    switch (TypeCategories[type]) {
        case MediaCategory.text: return "/public/text-file.svg";
        case MediaCategory.pdf: return "/public/pdf-file.svg";
        default: return url;
    }
}