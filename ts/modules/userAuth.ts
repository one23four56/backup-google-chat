/**
 * @module userAuth
 * @version 1.4: unimplemented 2FA
 * 1.3: added full function to authUser class
 * 1.2: refactored 
 * 1.1: added 2FA functions 
 * 1.0: created
 */
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as cookie from 'cookie';
import { UserAuths, UserData } from '../lib/authdata';
import { Users } from './users'
//--------------------------------------
const iterations = 2e5;
const hashLength = 128;
const saltLength = 32;

/**
 * Returns the userAuths json as a userAuths object
 * @returns {UserAuths} The userAuths json as an object
 * @since userAuth version 1.0
 */
export function getUserAuths(): UserAuths {
    if (!fs.existsSync("userAuths.json")) fs.writeFileSync("userAuths.json", "{}", 'utf-8');
    return JSON.parse(fs.readFileSync('userAuths.json', 'utf-8'))
}

export function genPreHash(pass: string, salt: string): string {

    const lv1 = crypto.pbkdf2Sync(pass, salt, iterations * 2, hashLength, 'sha512').toString('base64')
    
    return crypto.pbkdf2Sync(lv1, salt, iterations, hashLength / 2, 'sha512').toString('base64')

}

/**
 * Adds a user to the userAuths json
 * @param {string} email Email of user to add
 * @param {string} name Name of user to add
 * @param {string} pass Password to add
 * @since userAuth version 1.0
 */
export function addUserAuth(email: string, name: string, pass: string): string {
    let auths = getUserAuths()
    const salt = crypto.randomBytes(saltLength).toString('base64');

    const preHash = genPreHash(pass, salt); 
    const hash = crypto.pbkdf2Sync(preHash, salt, iterations, hashLength, 'sha512').toString('base64')

    auths[email] = { name: name, salt: salt, hash: hash, deviceIds: [] };

    fs.writeFileSync("userAuths.json", JSON.stringify(auths), 'utf-8');

    return preHash;
}

/**
 * @classdesc A class containing all functions needed to authorize a user. All functions take cookie strings as arguments except for bool, which can take either a cookie string or an email + password.
 * @hideconstructor
 */
export default class authUser {
    /**
     * Preforms both a regular authentication and a device id authentication. **It is recommended that you use this function for authentication.**
     * @param {string} cookieString Cookie string to check
     * @returns {UserData | false} User data if auth passed, false if failed
     * @since userAuth version 1.3
     */
    static full(cookieString: string): UserData | false {

        if (typeof cookieString !== "string")
            return false;

        const quickId = this.quickCheck(cookie.parse(cookieString).qupa)

        if (quickId)
            return Users.get(quickId) 

        const userData = authUser.bool(cookieString);

        if (userData) return userData;

        // if (userData && authUser.deviceId(cookieString)) return userData;

        return false
    }
    static bool(cookieString: string): UserData | false;
    static bool(email: string, pass: string): UserData | false;
    /**
     * Authenticates a user and returns the result
     * @param {string} emailOrCookieString Either email of user to auth or cookie string to auth
     * @param {string?} pass Password to check (not required if cookie string is used)
     * @returns {UserData | false} User data if auth passed, false if failed
     * @since userAuth version 1.0
     */
    static bool(emailOrCookieString: string, pass?: string) {
        try {
            const email = pass ? emailOrCookieString : cookie.parse(emailOrCookieString).email;
            const password = pass ? pass : cookie.parse(emailOrCookieString).pass;

            const auths = getUserAuths();
            if (!auths[email] || !auths[email].salt || !auths[email].name || !auths[email].hash) return false;

            const hash = crypto.pbkdf2Sync(password, auths[email].salt, iterations, hashLength, 'sha512').toString('base64')

            if (auths[email].hash === hash) return Users.getUserDataByEmail(email)
            else return false;

        } catch (err) {
            return false
        }
    }

    /**
    * Authorizes a user from a cookie string and expresses the result via a callback.
    * @param {string} cookieString Cookie string of user to auth
    * @param {Function} success Function that will be called on success
    * @param {Function} failure Function that will be called on failure
    * @since userAuth version 1.0
    */
    static callback(cookieString: string, success: (userData: UserData) => any, failure: () => any) {
        try {
            const bool = authUser.bool(cookieString)
            if (bool) success(bool as UserData);
            else failure();
        } catch {
            failure();
        }
    }

    /**
     * Checks if a device is authorized (used for 2FA)
     * @param {string} cookieString Cookie string to check
     * @returns {boolean} False if not authorized, true if authorized
     * @since userAuth version 1.1
     */
    static deviceId(cookieString: string) {
        // const cookieObj = cookie.parse(cookieString)
        // const id = cookieObj.deviceId
        // const email = cookieObj.email

        // if (!id) return false;
        // const auths = getUserAuths();
        // if (auths[email].deviceIds.includes(id)) return true


        // return false

        return true;
    }

    static quickCheck(pass: string | undefined): string | false {

        if (typeof pass !== "string")
            return false;

        if (!quickPasses.has(pass))
            return false;

        return quickPasses.get(pass);

    }
}

/**
 * Resets a user's auth
 * @param {string} email Email of user whose user auth will be reset
 * @since userAuth version 1.0
 */
export function resetUserAuth(email: string) {
    let auths = getUserAuths();
    delete auths[email];
    fs.writeFileSync("userAuths.json", JSON.stringify(auths), 'utf-8')
}

/**
 * Create a new device id, authorizes it for a given user, and returns it
 * @param {string} email Email of user to add to
 * @returns {string} New authorized device id
 * @since userAuth version 1.1
 */
export function addDeviceId(email: string): string {
    let auths = getUserAuths();

    const id = crypto.randomBytes(32).toString("base64")
    auths[email].deviceIds.push(id)

    fs.writeFileSync("userAuths.json", JSON.stringify(auths), 'utf-8')

    return id;
}

const quickPasses = new Map<string, string>();

export function getQuickPassFor(userId: string): string | false {

    if (!Users.get(userId)) return false;

    const pass = crypto.randomBytes(64).toString("hex")

    quickPasses.set(pass, userId)

    setTimeout(
        () => quickPasses.delete(pass), 
        1000 * 60 * 15 // 15 mins
    );

    return pass;

}