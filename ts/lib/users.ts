import { UserData } from "./authdata";

export default interface Users {
    [key: string]: UserData
}

export interface Statuses {
    [key: string]: {
        status: string,
        char: string
    }
}