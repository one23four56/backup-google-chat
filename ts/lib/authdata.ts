// Generated by https://quicktype.io (some parts were also written manually)
// this entire thing was written manually but i don't want to remove that because it is history
// well at least history from back when i barely knew typescript

export interface Status {
    status: string;
    char: string;
    updated: number;
}

export interface UserData {
    name: string;
    email: string;
    id: string;
    img: string;
    status?: Status;
    schedule?: string[];
    lastOnline?: number;
    activity?: string;
    created?: number;
}

export enum OnlineStatus {
    online = "ONLINE",
    offline = "OFFLINE",
    idle = "BUSY",
    active = "ACTIVE",
    inactive = "INACTIVE"
}

export function isOnlineStatus(object: unknown): object is OnlineStatus {

    if (typeof object !== "string")
        return false;

    return Object.values(OnlineStatus).includes(<OnlineStatus>object)

}

export interface OnlineUserData extends UserData {
    online: OnlineStatus;
}
export interface UserAuth {
    id: string;
    factors: {
        password?: PasswordFactor;
    };
    tokens: {
        [key: string]: {
            ip: string;
            token: string;
            expires: number;
        }
    }
}

interface PasswordFactor {
    hash: string;
    salt: string
}

/**
 * @deprecated Use UserAuth/UserData instead
 */
export interface AuthData2 {
    name: string;
    email: string;
    mpid: string;
}

/**
 * @deprecated Use AuthData2 instead
 */
export interface AuthData {
    name: string;
    authname: string;
    cdid: string;
}
