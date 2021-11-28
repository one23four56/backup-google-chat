import * as fs from 'fs';
import * as crypto from 'crypto';
import * as cookie from 'cookie';
import { UserAuths, UserData } from './lib/authdata';
//--------------------------------------
const iterations = 100000;
const hashLength = 128;
const saltLength = 32;

/**
 * Returns the userAuths json as a userAuths object
 * @returns The userAuths json as an object
 */
export const getUserAuths: () => UserAuths = () => {
    if (!fs.existsSync("userAuths.json")) fs.writeFileSync("userAuths.json", "{}", 'utf-8');
    return JSON.parse(fs.readFileSync('userAuths.json', 'utf-8'))
}

/**
 * Adds a user to the userAuths json
 * @param email Email of user to add
 * @param name Name of user to add
 * @param pass Password to add
 * @returns Pepper to be stored by the user
 */
export const addUserAuth: (email: string, name: string, pass: string) => string = (email, name, pass) => {
    let auths = getUserAuths()
    const salt = auths[email] ? auths[email].salt : crypto.randomBytes(saltLength).toString('base64');
    const pepper = crypto.randomBytes(saltLength).toString('base64');
    //salt is saved on the server, pepper is saved on the client 
    const hash = crypto.pbkdf2Sync(`${pass}${pepper}`, salt, iterations, hashLength, 'sha512').toString('base64')

    if (!auths[email]) auths[email] = {name: name, salt: salt, hashes: [hash]};
    else auths[email].hashes.push(hash)

    fs.writeFileSync("userAuths.json", JSON.stringify(auths), 'utf-8')
    return pepper
}

export interface AuthUser {
    callback: (
        email:string,pass:string,pepper:string,
        success:(userData:UserData)=>any,
        failure:()=>any
    )=>void;
    bool: (
        email:string,pass:string,pepper:string
    )=>boolean | UserData;
    fromCookie: {
        bool: (
            cookieString: string
        )=>boolean | UserData;
        callback: (
            cookieString: string,
            success: (userData:UserData)=>any,
            failure: ()=>any
        )=>void;
    };
}

export const authUser: AuthUser = {
    /**
     * Authorizes a user and returns the result
     * @param email Email of user to auth
     * @param pass Given password
     * @param pepper Given pepper
     * @returns False if incorrect, UserData if correct
     */
    bool: (email, pass, pepper) => {
        try {
            const auths = getUserAuths();
            if (!auths[email] || !auths[email].salt || !auths[email].name || !auths[email].hashes) return false;

            const hash = crypto.pbkdf2Sync(`${pass}${pepper}`, auths[email].salt, iterations, hashLength, 'sha512').toString('base64')

            if (auths[email].hashes.includes(hash)) return {name: auths[email].name, email: email};
            else return false;

        } catch {
            return false
        }
    },
    /**
     * Authorizes a user and expresses the result via callback functions
     * @param email Email of user to auth
     * @param pass Given password
     * @param pepper Given pepper
     * @param success Function called on success
     * @param failure Function called on failure
     */
    callback: (email, pass, pepper, success, failure) => {
        try {
            const auths = getUserAuths();
            if (authUser.bool(email, pass, pepper)) success({email: email, name: auths[email].name});
            else failure();
        } catch {
            failure()
        }
    },
    fromCookie: {
        /**
         * Authorizes a user from a cookie string and returns a boolean
         * @param cookieString Cookie string of user to auth
         * @returns False if failure, UserData if success
         */
        bool: (cookieString)=>{
            try {
                const cookieObj = cookie.parse(cookieString);
                return authUser.bool(cookieObj.email, cookieObj.pass, cookieObj.pepper)
            } catch {
                return false;
            }
        },
        /**
         * Authorizes a user from a cookie string and expresses the result via a callback
         * @param cookieString Cookie string of user to auth
         * @param success Function that will be called on success
         * @param failure Function that will be called on failure
         */
        callback: (cookieString, success, failure)=>{
            try {
                const bool = authUser.fromCookie.bool(cookieString)
                if (bool) success(bool as UserData);
                else failure();
            } catch {
                failure();
            }
        }
    }
}

/**
 * Resets a user's auth
 * @param email Email of user whose user auth will be reset
 */
export const resetUserAuth: (email: string) => void = (email) => {
    let auths = getUserAuths();
    delete auths[email];
    fs.writeFileSync("userAuths.json", JSON.stringify(auths), 'utf-8')
}