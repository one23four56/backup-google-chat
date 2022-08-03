/**
 * @module users
 */
import * as uuid from 'uuid';
import { UserData } from '../lib/authdata';
import UsersJson from '../lib/users';
import * as json from './json'

/**
 * @classdesc Class used for adding users.
 */
export class User {
    email: string;
    name: string;
    id: string;
    img: string;

    /**
     * Creates a new user. Use the addUser method of the {@link Users} class to add to the users json.
     * @param name Name of the user
     * @param email Email of the user
     * @param img Image of the user
     */
    constructor(name: string, email: string, img: string) {
        this.name = name
        this.email = email
        this.img = img;

        this.id = uuid.v4()
    }

    /**
     * Returns the user data for this user as a UserData object
     * @returns The user data for this user, as a UserData object
     */
    getAsUserData(): UserData {
        return {
            email: this.email,
            name: this.name,
            id: this.id,
            img: this.img
        }
    }
}

/**
 * @classdesc Used for interacting with users.json
 * @hideconstructor
 */
export class Users {

    /**
     * Gets the users json
     * @returns The users json
     */
    static getUsers(): UsersJson {
        return json.read("users.json")
    }

    /**
     * Gets a user by their ID
     * @param id User ID to get
     * @returns The user, or undefined if the user does not exist
     */
    static get(id: string): UserData | undefined {
        return Users.getUsers()[id]
    }

    /**
     * Adds a user to the users json
     * @param {User} user User to add to users json
     */
    static addUser(user: User) {
        let users = Users.getUsers()
        users[user.id] = user.getAsUserData();
        json.write('users.json', users)
    }

    /**
     * Checks if an email is whitelisted
     * @param email Email to check
     */
    static isWhiteListed(email: string): boolean {
        const users = Users.getUsers();
        for (const userId in users) {
            if (users[userId].email === email) return true;
        }
        return false;
    }

    /**
     * Gets a user's data from their email
     * @param email Email of user to get data for
     * @returns The user's data
     */
    static getUserDataByEmail(email: string): UserData {
        const users = Users.getUsers();
        for (const userId in users) {
            if (users[userId].email === email) return users[userId];
        }
    }

    /**
     * Updates a user's UserData in the users json
     * @param {string} id ID of user to update
     * @param {UserData} updateTo UserData to update to
     */
    static updateUser(id: string, updateTo: UserData) {
        let users = Users.getUsers();
        users[id] = updateTo;
        json.write('users.json', users)
    }

    /**
     * Gets everyone on the users list who has a given name  
     * **NOTE:** case and accent insensitive, so if someone is named 'Jóhn' and you query 'john' they will be a result
     * @param name Name to query for
     * @returns An array of everyone with that name
     */
    static queryByName(name: string): UserData[] {

        const output: UserData[] = [];

        const users = Users.getUsers();

        // complicated af, but it works better than ===
        const comparer = new Intl.Collator('en', {
            sensitivity: 'base', // sets it to case and accent insensitive
        })

        for (const id in users) {

            const userName = users[id].name.slice(0, name.length)

            if (comparer.compare(userName, name) === 0) // 0 = they are the same, it is weird i know
                output.push(users[id])

        }


        return output.sort((a, b) => comparer.compare(a.name, b.name));

    }
}