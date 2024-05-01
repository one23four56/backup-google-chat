/**
 * @module userAuth
 * @version 1.6: overhauled: added OTT, tokens, factors; removed old functions
 * 1.5: added pre-hashing and quick passwords
 * 1.4: unimplemented 2FA
 * 1.3: added full function to authUser class
 * 1.2: refactored 
 * 1.1: added 2FA functions 
 * 1.0: created
 */
import * as fs from 'fs';
import * as crypto from 'crypto';
import * as cookie from 'cookie';
import * as net from 'net';
import { UserAuth } from '../lib/authdata';
import type { IncomingMessage } from 'http';
//--------------------------------------
const iterations = 8e5;
const hashLength = 128;
const saltLength = 128;

if (!fs.existsSync("userAuth.json")) fs.writeFileSync("userAuth.json", "{}", 'utf-8');

/**
 * Returns the userAuths json
 * @returns The userAuths json as an object
 */
function read(): Record<string, UserAuth> {
    return JSON.parse(fs.readFileSync('userAuth.json', 'utf-8'));
}

/**
 * Writes to the userAuths json
 * @param data Data to write
 */
function write(data: Record<string, UserAuth>) {
    fs.writeFileSync('userAuth.json', JSON.stringify(data), 'utf-8');
}

export const userAuths = {
    read, write
}

const OTTList: Record<string, [any, string, ReturnType<typeof setTimeout>]> = {};

/**
 * Generates a one-time token
 * @param data Data to store with the token
 * @param type Data type
 * @param size Size (in bytes) of the token (default: 32)
 * @param expires Lifespan of the token in milliseconds (default: 3e5 [5 minutes])
 * @returns The token
 */
function generateOTT<dataType = string>(data: dataType, type: string, size: number = 32, expires: number = 3e5): string {
    const
        token = crypto.randomBytes(size).toString("base64url"),
        timeout = setTimeout(() => delete OTTList[token], expires);

    // prevent two of the same OTTs from being issued at once
    for (const [t, [d, y]] of Object.entries(OTTList))
        if (data === d && type === y)
            consumeOTT(t, y); // unreadable var names but idgaf

    OTTList[token] = [
        data, type, timeout
    ];

    return token;
}

/**
 * Reads data from a one-time token, consuming it in the process
 * @param token Token to consume
 * @param type Data type of token
 * @returns The data stored on the token, or false if the token is invalid
 */
function consumeOTT<dataType = string>(token: string, type: string): dataType | false {
    if (typeof OTTList[token] !== "object")
        return false;

    if (OTTList[token][1] !== type)
        return false;

    clearTimeout(OTTList[token][2]);

    const data = OTTList[token][0];

    delete OTTList[token];
    return data;
}

export const OTT = {
    generate: generateOTT,
    consume: consumeOTT
}

/**
 * Sets a user's password
 * @param userId User id
 * @param password Password
 */
function setPassword(userId: string, password: string) {
    const
        auths = userAuths.read(),
        salt = crypto.randomBytes(saltLength).toString('base64'),
        hash = crypto.pbkdf2Sync(password, salt, iterations, hashLength, 'sha512').toString('base64');

    if (!auths[userId])
        addAuth(userId);

    auths[userId].factors.password = {
        hash, salt
    }

    userAuths.write(auths);
}

function hasPassword(userId: string): boolean {
    const auths = userAuths.read();

    if (typeof auths[userId] !== "object")
        addAuth(userId);

    return typeof auths[userId]?.factors?.password === "object";
}

/**
 * Checks a user's password
 * @param userId User id
 * @param password Password
 * @returns Whether or not the password is correct
 */
function checkPassword(userId: string, password: string): boolean {
    try {
        const auths = userAuths.read();

        if (typeof auths[userId]?.factors?.password !== "object")
            return false;

        const hash1 = crypto.pbkdf2Sync(
            password,
            auths[userId].factors.password.salt,
            iterations,
            hashLength,
            'sha512'
        )

        const hash2 = Buffer.from(auths[userId].factors.password.hash, "base64")

        if (hash1.length !== hash2.length)
            return false;

        return crypto.timingSafeEqual(hash1, hash2);

    } catch (err) {
        console.log(err);
        return false;
    }
}

export const factors = {
    setPassword,
    checkPassword,
    hasPassword
}

function addAuth(userId: string) {
    const auths = userAuths.read();

    auths[userId] = {
        factors: {},
        id: userId,
        tokens: {}
    };

    userAuths.write(auths);
}

function parseIP(ip: string): string {
    if (net.isIP(ip) !== 0)
        return ip;

    // https://github.com/tjanczuk/iisnode/issues/94#issuecomment-3435115
    // iisnode might append a colon + 5-digit port to the end of the ip
    // in that case, net.isIP will fail, so the port has to be removed

    if (net.isIP(ip.slice(0, -6)))
        return ip.slice(0, -6)

    // could be IPv6 ([ip]:port)

    if (net.isIP(ip.slice(0, -6).replace(/\[|\]/g, "")))
        return ip.slice(0, -6).replace(/\[|\]/g, "");

    return "invalid";

}

const tokenList: Record<string, [string, UserAuth["tokens"][keyof UserAuth["tokens"]]]> = {}

for (const [id, item] of Object.entries(userAuths.read()))
    for (const token in item.tokens)
        tokenList[token] = [id, item.tokens[token]];

function createToken(userId: string, rawIP: string) {
    const
        auths = userAuths.read(),
        ip = parseIP(rawIP),
        token = crypto.randomBytes(64).toString('base64');

    auths[userId].tokens[token] = {
        ip, token,
        expires: Date.now() + (1000 * 60 * 60 * 24 * 30)
    };

    tokenList[token] = [userId, auths[userId].tokens[token]];

    userAuths.write(auths);

    return token;

}

function verifyToken(token: string, rawIP: string): string | false {
    try {
        if (typeof token !== "string" || typeof rawIP !== "string")
            return false;

        // const
            // auths = userAuths.read(),
            // ip = parseIP(rawIP);

        // for (const id in auths)
        //     if (auths[id].tokens[token]?.token === token && auths[id].tokens[token]?.ip === ip)
        //         return id;

        if (tokenList[token]?.[1].token === token)
            return tokenList[token][0];

        return false;
    } catch (err) {
        console.log(err);
        return false;
    }
}

verifyToken.fromRequest = (request: IncomingMessage) => {
    try {
        const token = cookie.parse(request.headers.cookie).token;

        if (typeof token !== "string")
            return false;

        const ip = (request.headers['x-forwarded-for']?.toString() || '') || request.socket?.remoteAddress
            .split(",").shift().trim();

        return verifyToken(token, ip);

    } catch (err) {
        console.log(err);
        return false;
    }
}

function clearTokens(userId: string) {
    const auths = userAuths.read();

    for (const token in auths[userId].tokens)
        removeToken(token, userId);

    userAuths.write(auths);
}

function removeToken(token: string, userId: string) {
    let auths = userAuths.read();

    delete auths[userId].tokens[token];
    delete tokenList[token];

    userAuths.write(auths);
}

export const tokens = {
    create: createToken,
    verify: verifyToken,
    clear: clearTokens,
    remove: removeToken
}

// token expirer

setInterval(() => {

    const auths = userAuths.read();
    let expired = 0;

    for (const id in auths)
        for (const token in auths[id].tokens)
            if (auths[id].tokens[token].expires <= Date.now()) {
                removeToken(token, id);
                expired++;
            }

    if (expired > 0)
        console.log(`userAuth: expired ${expired} tokens`)

}, 1000 * 60)