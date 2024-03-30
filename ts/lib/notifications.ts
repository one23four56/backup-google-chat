import * as Update from '../update.json';

export enum NotificationType {
    text,
    status,
    update
}

export interface ProtoNotification<type> {
    type: NotificationType;
    data: type;
    title: string;
    icon: {
        type: "emoji" | "image" | "icon";
        content: string;
    }
    id?: string;
}

export interface Notification<type = any> extends ProtoNotification<type> {
    time: number;
    id: string;
}

export interface TextNotification {
    title: string;
    content: string;
}

export type UpdateNotification = typeof Update;