import { StatusUserData } from "../modules/session";
import { UserData } from "./authdata";

export interface CreateRoomData {
    name: string;
    description: string;
    rawMembers: UserData[];
    emoji: string;
}

export interface MemberUserData extends UserData {
    type: "member" | "invited"
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
    online: StatusUserData[]
}

