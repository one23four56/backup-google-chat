/**
 * @module users
 */
import { sessions } from '..';
import { OnlineStatus, OnlineUserData, Status, UserData } from '../lib/authdata';
import UsersJson from '../lib/users';
import get from './data';
import { getUsersIdThatShareRoomsWith } from './rooms';
import SessionManager, { emitToRoomsWith } from './session';

const
    users = get<UsersJson>(`users.json`),
    blocks = get<Record<string, [string[], string[]]>>(`data/blocklist.json`);

/**
 * @classdesc Used for interacting with users.json
 * @hideconstructor
 */
export class Users {

    /**
     * Gets a user by their ID
     * @param id User ID to get
     * @returns The user, or undefined if the user does not exist
     */
    static get(id: string): UserData | undefined {
        return structuredClone(users.ref[id])
    }

    /**
     * Same as {@link Users.get}, but returns online user data (user data w/ online status)
     * @param id User ID to get
     * @param override Optional; session manager to use instead of main one
     * @returns User + online status, or undefined
     */
    static getOnline(id: string, override?: SessionManager): OnlineUserData | undefined {

        const user = this.get(id);

        if (!user)
            return undefined;

        const session: SessionManager = override || sessions

        return {
            ...user,
            online: session.getByUserID(id)?.onlineState ||
                (Date.now() - user.lastOnline > 1000 * 60 * 60 * 24 * 7 ? OnlineStatus.inactive : OnlineStatus.offline)
        }

    }

    /**
     * Adds a user to the users json
     * @param {UserData} user User to add to users json
     */
    static addUser(user: UserData) {
        users.ref[user.id] = user;
    }

    /**
     * Checks if an email is whitelisted
     * @param email Email to check
     */
    static isWhiteListed(email: string): boolean {
        for (const userId in users.ref) {
            if (users.ref[userId].email === email) return true;
        }
        return false;
    }

    /**
     * Gets a user's data from their email
     * @param email Email of user to get data for
     * @returns The user's data
     */
    static getUserDataByEmail(email: string): UserData {
        for (const userId in users.ref) {
            if (users.ref[userId].email === email) return users.ref[userId];
        }
    }

    /**
     * Updates a user's UserData in the users json
     * @param {string} id ID of user to update
     * @param {UserData} updateTo UserData to update to
     */
    static updateUser(id: string, updateTo: UserData) {
        users.ref[id] = updateTo;
    }

    /**
     * Gets everyone on the users list who has a given name  
     * **NOTE:** case and accent insensitive, so if someone is named 'Jóhn' and you query 'john' they will be a result
     * @param name Name to query for
     * @returns An array of everyone with that name
     */
    static queryByName(name: string): UserData[] {

        const output: UserData[] = [];

        // complicated af, but it works better than ===
        const comparer = new Intl.Collator('en', {
            sensitivity: 'base', // sets it to case and accent insensitive
        })

        for (const id in users.ref) {

            const firstName = users.ref[id].name.slice(0, name.length)
            const lastName = (users.ref[id].name.split(" ")[1] ?? "").slice(0, name.length)

            if (comparer.compare(firstName, name) === 0 || comparer.compare(lastName, name) === 0) // 0 = they are the same, it is weird i know
                output.push(users.ref[id])

        }


        return output.sort((a, b) => comparer.compare(a.name, b.name));

    }
}

/**
 * @hideconstructor
 */
export class Statuses {

    static get(userId: string): Status | undefined {
        return Users.get(userId)?.status
    }

    static set(userId: string, status?: Status): boolean {
        const userData = Users.get(userId)

        if (!userData)
            return false

        if (status)
            userData.status = status
        else
            delete userData.status

        Users.updateUser(userId, userData)

        emitToRoomsWith(
            { userId, manager: sessions },
            { event: "userData updated", args: [Users.getOnline(userId)] }
        )



        return true;
    }

}

export class Schedules {

    static get(id: string): string[] | undefined {
        return Users.get(id)?.schedule
    }

    static set(userId: string, schedule?: string[]): boolean {
        const userData = Users.get(userId)

        if (!userData)
            return false

        if (schedule)
            userData.schedule = schedule
        else
            delete userData.schedule

        Users.updateUser(userId, userData)

        emitToRoomsWith(
            { userId, manager: sessions },
            { event: "userData updated", args: [Users.getOnline(userId)] }
        )

        return true;
    }
}

export function blockList(userId: string) {
    const lists = blocks.ref[userId], list = new Set(lists ? [...lists[0], ...lists[1]] : []);

    const list1 = lists ? lists[0] : []; // user is blocking
    const list2 = lists ? lists[1] : []; // user is blocked by
    const has = (userId: string) => list.has(userId);

    const block = (blockUserId: string) => {
        if (!blocks.ref[userId])
            blocks.ref[userId] = [[], []];

        if (!blocks.ref[blockUserId])
            blocks.ref[blockUserId] = [[], []];

        blocks.ref[userId][0].push(blockUserId);
        blocks.ref[blockUserId][1].push(userId);
        // so satisfying that they line up
    }

    const unblock = (blockUserId: string) => {
        if (!blocks.ref[userId])
            blocks.ref[userId] = [[], []];

        if (!blocks.ref[blockUserId])
            blocks.ref[blockUserId] = [[], []];

        blocks.ref[userId][0] = blocks.ref[userId][0].filter(i => i !== blockUserId);
        blocks.ref[blockUserId][1] = blocks.ref[blockUserId][1].filter(i => i !== userId);
        // dang they don't line up
    }

    return {
        blockedUsers: list1,
        blockedBy: list2,
        mutualBlockExists: has,
        list: [list1, list2] as [string[], string[]], // it is string[][] by default
        block, unblock,
    }
}