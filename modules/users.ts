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
        for (const checkEmail of users.emails) {
            if (checkEmail === email) return true;
        }
        return false;
    }

    /**
     * Gets a user's data from their email
     * @param email Email of user to get data for
     * @returns The user's data
     */
    // static getUserDataByEmail(email: string): UserData {
    //     const users = Users.getUsers();
    //     for (const checkEmail in users.names) { 
    //         if (checkEmail === email) return {
    //             name: users.names[checkEmail],
    //             email: checkEmail,
    //             id: ''
    //         }
    //     }
    // }

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
}