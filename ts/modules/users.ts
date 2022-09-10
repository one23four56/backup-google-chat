/**
 * @module users
 */
import { sessions } from '..';
import { Status, UserData } from '../lib/authdata';
import UsersJson from '../lib/users';
import get from './data';
import { getUsersIdThatShareRoomsWith } from './rooms';

const users = get<UsersJson>(`users.json`)

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

            const userName = users.ref[id].name.slice(0, name.length)

            if (comparer.compare(userName, name) === 0) // 0 = they are the same, it is weird i know
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

        const broadcastTo = [...getUsersIdThatShareRoomsWith(userId), userId]
        // for some reason i have to have this variable, otherwise typescript throws an error
        // ¯\_(ツ)_/¯

        broadcastTo.forEach(id => {

            const session = sessions.getByUserID(id)

            if (session)
                session.socket.emit("userData updated", userData)

        })

        return true;
    }

}