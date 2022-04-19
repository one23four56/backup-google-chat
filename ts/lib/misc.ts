import { StatusUserData } from "../modules/session";
import { UserData } from "./authdata";

export interface WebhookData {
    name: string;
    image: string;
    id: string;
    globalId: string;
    private: boolean;
    owner: string;
}

export interface LoadData {
    me: UserData,
    webhooks: WebhookData[],
    online: StatusUserData[]
}