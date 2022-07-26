import { StatusUserData } from "../modules/session";
import { UserData } from "./authdata";

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