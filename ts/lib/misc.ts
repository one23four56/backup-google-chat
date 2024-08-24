import { UserData } from "./authdata";

export interface CreateRoomData {
    name: string;
    description: string;
    members: string[];
    emoji: string;
    bots: string[];
}

export interface MemberUserData extends UserData {
    type: "member" | "invited";
    mute?: number;
    kick?: number;
}

/**
 * @deprecated literally the exact same thing as ProtoWebhook. use ProtoWebhook instead
 * @see ProtoWebhook
 */
export interface WebhookData {
    name: string;
    image: string;
    id: string;
    private: boolean;
    owner: string;
}

export interface LoadData {
    me: UserData,
    webhooks: WebhookData[],
    online: UserData[]
}

