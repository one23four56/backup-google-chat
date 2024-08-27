import * as crypto from 'crypto';
import get from './data';
import { BotUtilities } from './bots';
import { MediaCategory, TypeCategories } from '../lib/socket';

export interface UserBot {
    id: string;
    author: string;
    name: string;
    image: string;
    token: {
        hash: string;
        salt: string;
    } | false;
    webhookData?: {
        enabled: true;
        url: string;
    };
    commandData?: {
        enabled: true;
        url: string;
        commands: Command[];
    };
    published: boolean;
    canPublish?: boolean;
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
        published: false,
        canPublish: false,
        token: false
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

const allowedChars = "abcedfghijklmnopqrstuvwxyz ".split("");
function isLegalString(string: string): boolean {
    for (const letter of string.split(""))
        if (!allowedChars.includes(letter))
            return false;

    return true;
}

function isValidName(name: string): [true] | [false, string] {
    name = name.toLowerCase().trim();
    if (name.length > 20)
        return [false, "Name is too long (max 20 chars)"];

    if (name.length < 5)
        return [false, "Name is too short (min 5 chars)"];

    if (!isLegalString(name))
        return [false, "Name contains one or more illegal characters"];

    const reservedNames = [
        "Info", "Backup Google Chat", "My Bot", "AutoMod", "Auto Moderator", "Admin",
        ...BotUtilities.getSystemNames()
    ].map(n => n.toLowerCase().trim());

    if (reservedNames.includes(name))
        return [false, "Name is unavailable"];

    const userBotNames = Object.values(userBots.ref)
        .filter(b => b.published).map(b => b.name.toLowerCase().trim());

    if (userBotNames.includes(name))
        return [false, "Name is already in use"];

    return [true]
}

function setName(id: string, name: string): [true] | [false, string] {
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

async function isValidImage(url: string): Promise<[true] | [false, string]> {
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

async function setImage(id: string, url: string): Promise<[true] | [false, string]> {
    const bot = userBots.ref[id];
    if (!bot)
        return [false, "Bot does not exist"];
    
    const isValid = await isValidImage(url);
    if (!isValid[0])
        return isValid;

    userBots.ref[id].image = url;

    return [true];
}

export const UserBots = {
    create,
    get: getBot,
    getByAuthor: getBotsByAuthor,
    setName, setImage
}