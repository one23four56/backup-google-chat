import * as crypto from 'crypto';
import get from './data';
import { BotUtilities } from './bots';
import { MediaCategory, TypeCategories } from '../lib/socket';

export interface UserBot {
    id: string;
    author: string;
    name: string;
    image: string;
    description: string;
    webhook?: {
        public: string;
        beta: string;
    }
    commandServer: string | false;
    commands?: Command[];
    published: boolean;
    enabled: boolean;
}

interface Command {
    name: string;
    description: string;
    args: Argument[];
}

interface Argument {
    name: string;
    description: string;
    multiWord?: boolean;
    optional?: boolean;
}

const userBots = get<Record<string, UserBot>>('data/userBots.json');

/**
 * Creates a user bot
 * @param author User ID of the person who made the bot
 * @returns The ID of the newly created user bot
 */
function create(author: string): string {
    const id = crypto.randomBytes(16).toString("hex");
    if (userBots.ref[id]) return create(author);

    const bot: UserBot = {
        id, author,
        name: "My Bot",
        image: "/public/bot.svg",
        description: "",
        published: false,
        enabled: false,
        commandServer: false,
    };

    userBots.ref[id] = bot;

    return id;
}

function getBot(id: string): UserBot | undefined {
    return userBots.ref[id];
}

function getBotsByAuthor(author: string): UserBot[] {
    return Object.values(userBots.ref).filter(b => b.author === author);
}

const allowedChars = new Set("abcedfghijklmnopqrstuvwxyz 1234567890".split(""));
const extendedChars = new Set([
    ...allowedChars,
    ...`-+=~.,/:;'"|[](){}#$%&*!?_^@`.split("")
]);

function isLegalString(string: string, set: Set<string> = allowedChars): boolean {
    string = string.toLowerCase();
    for (const letter of string.split(""))
        if (!set.has(letter))
            return false;

    return true;
}

type validity = [true] | [false, string];

interface BaseValidityOptions {
    minLength: number;
    maxLength: number;
    extendedCharset?: boolean;
}

function checkBaseValidity(string: string, options: BaseValidityOptions): validity {
    string = string.toLowerCase();
    if (string.length > options.maxLength)
        return [false, `Text is too long (max ${options.maxLength} chars)`];

    if (string.length < options.minLength)
        return [false, `Text is too short (min ${options.minLength} chars)`];

    if (!isLegalString(string, options.extendedCharset ? extendedChars : allowedChars))
        return [false, "Text contains one or more illegal characters"];

    return [true];
}

function isValidName(name: string): validity {
    name = name.toLowerCase();

    const base = checkBaseValidity(name, {
        minLength: 5, maxLength: 20
    });

    if (!base[0])
        return base;

    const reservedNames = [
        "Info", "Backup Google Chat", "My Bot", "AutoMod", "Auto Moderator", "Admin",
        ...BotUtilities.getSystemNames()
    ].map(n => n.toLowerCase().trim());

    if (reservedNames.includes(name))
        return [false, "Name is unavailable"];

    const userBotNames = Object.values(userBots.ref)
        .filter(b => b.enabled && b.published).map(b => b.name.toLowerCase().trim());

    if (userBotNames.includes(name))
        return [false, "Name is already in use"];

    return [true]
}

function setName(id: string, name: string): validity {
    name = name.trim();
    const bot = userBots.ref[id];
    if (!bot) return [false, "Bot doesn't exist"];

    const isValid = isValidName(name);
    if (!isValid[0])
        return isValid;

    userBots.ref[id].name = name;

    return [true];
}

const imageTypes = Object.entries(TypeCategories)
    .filter(([_t, c]) => c === MediaCategory.image)
    .map(([t]) => t);

async function isValidImage(url: string): Promise<validity> {
    if (url.length > 500)
        return [false, "Image URL is too long"];

    try {
        const object = new URL(url);
        if (object.protocol !== "https:")
            return [false, "Invalid URL protocol (only HTTPS is supported)"];
    } catch {
        return [false, "Invalid image URL"];
    }

    try {
        const abort = new AbortController();
        const timeout = setTimeout(() => abort.abort(), 10 * 1000);
        const res = await fetch(url, { signal: abort.signal });
        clearTimeout(timeout);
        // test ping times out after 10 seconds

        if (!res.ok)
            return [false, `Invalid response from external server (${res.status} ${res.statusText})`];

        if (!res.headers.has("Content-Type"))
            return [false, `External server provided no content type`];

        const type = res.headers.get("Content-Type");
        if (!imageTypes.includes(type))
            return [false, `Invalid content type (${type})`];
    } catch {
        return [false, "Test ping failed"];
    }

    return [true];
}

async function setImage(id: string, url: string): Promise<validity> {
    const bot = userBots.ref[id];
    if (!bot)
        return [false, "Bot does not exist"];

    const isValid = await isValidImage(url);
    if (!isValid[0])
        return isValid;

    userBots.ref[id].image = url;

    return [true];
}

function setDescription(id: string, description: string): validity {
    const bot = userBots.ref[id];
    if (!bot)
        return [false, "Bot does not exist"];

    const isValid = checkBaseValidity(description, {
        minLength: 10, maxLength: 250, extendedCharset: true
    });

    if (!isValid[0])
        return isValid;

    userBots.ref[id].description = description;

    return [true];
}

interface BotToken {
    hash: string;
    salt: string;
}

const botTokens = get<Record<string, BotToken>>('data/userBotTokens.json');

function generateToken(id: string): string {
    const token = crypto.randomBytes(64).toString("base64url");
    const salt = crypto.randomBytes(128).toString("base64");
    const hash = crypto.pbkdf2Sync(
        token, salt, 1e5, 128, "sha512"
    ).toString("base64");

    botTokens.ref[id] = {
        hash, salt
    };

    return token;
}

function checkToken(id: string, token: string): boolean {
    const bot = botTokens.ref[id];
    if (!bot) return false;

    const
        hash1 = Buffer.from(bot.hash, "base64"),
        salt = bot.salt;

    const hash2 = crypto.pbkdf2Sync(
        token, salt, 1e5, 128, "sha512"
    );

    if (hash1.length !== hash2.length) return false;

    return crypto.timingSafeEqual(hash1, hash2);
}

function generateFullToken(id: string) {
    const base64id = Buffer.from(id, "hex").toString("base64url");
    const token = generateToken(id);
    tokenCache = {}; // reset it for everyone, idc, it's easier than going in and only taking one out
    return base64id + "." + token;
}

let tokenCache: Record<string, string> = {};

setInterval(() => {
    tokenCache = {};
}, 30 * 60 * 1000)

function parseFullToken(token: string): false | string {
    try {
        if (tokenCache && tokenCache[token])
            return tokenCache[token];

        const items = token.split(".");
        if (items.length !== 2) return false;

        const id = Buffer.from(items[0], "base64url").toString("hex");
        if (!botTokens.ref[id] || !userBots.ref[id]) return false;
        // past here, bot id is valid 

        const isTokenValid = checkToken(id, items[1]);
        if (!isTokenValid) return false;

        // cache token
        tokenCache[token] = id;

        return id;
    } catch {
        return false;
    }
}

function deleteBot(id: string): validity {
    const bot = userBots.ref[id];
    if (!bot)
        return [false, "Bot does not exist"];

    if (bot.enabled)
        return [false, "Bot must be disabled to be deleted"];

    delete userBots.ref[id];
    delete botTokens.ref[id];
    tokenCache = {};

    return [true];
}

async function checkCommandServer(url: string, id: string): Promise<validity> {
    if (url.length > 500)
        return [false, "URL is too long (max 500 chars)"];

    try {
        const object = new URL(url);
        if (object.protocol !== "https:")
            return [false, "Invalid URL protocol (only HTTPS is supported)"];
    } catch {
        return [false, "Invalid URL"];
    }

    try {
        const abort = new AbortController();
        const timeout = setTimeout(() => abort.abort(), 10 * 1000);
        const res = await fetch(url, { signal: abort.signal });
        clearTimeout(timeout);
        // test ping times out after 10 seconds

        if (!res.ok)
            return [false, `Invalid response from external server (${res.status} ${res.statusText})`];

        const body = await res.text();

        if (body !== id)
            return [false, `Server did not respond with bot ID`]

    } catch (err) {
        return [false, `Ping failed: ${err}`];
    }

    return [true];
}

async function setCommandServer(id: string, url: string): Promise<validity> {
    const bot = userBots.ref[id];
    if (!bot)
        return [false, "Bot does not exist"];

    const isValid = await checkCommandServer(url, id);
    if (!isValid[0])
        return isValid;

    userBots.ref[id].commandServer = url;

    return [true];
}

async function checkPublishValidity(id: string): Promise<validity> {
    const bot = userBots.ref[id];
    if (!bot) return [false, "Bot does not exist"];

    const errors: string[] = [];

    const name = setName(id, bot.name);
    if (!name[0])
        errors.push(`Name: ${name[1]}`);

    const image = await setImage(id, bot.image);
    if (!image[0])
        errors.push(`Image: ${image[1]}`);

    const description = setDescription(id, bot.description);
    if (!description[0])
        errors.push(`Description: ${description[1]}`);

    if (!botTokens.ref[id])
        errors.push("Bot: Bot token not set")

    if (typeof bot.commandServer !== "string")
        errors.push(`Bot: Command server not set`);

    if (errors.length === 0)
        return [true];

    return [
        false,
        `Bot can't be enabled due to the following error(s):\n${errors.join("\n")}`
    ];
}

export const UserBots = {
    create,
    get: getBot,
    getByAuthor: getBotsByAuthor,
    setName, setImage, setDescription,
    generateToken: generateFullToken,
    parseToken: parseFullToken,
    delete: deleteBot,
    publish: checkPublishValidity,
    setCommandServer
}