import * as crypto from 'crypto';
import get from './data';
import { Bot, BotList, BotUtilities, Command as BotCommand, BotData } from './bots';
import { MediaCategory, TypeCategories } from '../lib/socket';
import { Users } from './users';
import Message from '../lib/msg';
import Room from './rooms';
import { MemberUserData } from '../lib/misc';
import { UserData } from '../lib/authdata';

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
    enabled: boolean;
    events: Record<keyof typeof defaultEvents, boolean>;
}

const defaultEvents = {
    "added": false
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

export type {
    Command as UserBotCommand,
    Argument as UserBotArg
}

const userBots = get<Record<string, UserBot>>('data/userBots.json');
const publicUserBots = get<Record<string, UserBot>>('data/public-userBots.json');

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
        enabled: false,
        commandServer: false,
        events: defaultEvents
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

function isValidName(name: string, id: string): validity {
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
        .filter(b => b.enabled && isPublic(b.id) && b.id !== id).map(b => b.name.toLowerCase().trim());

    if (userBotNames.includes(name))
        return [false, "Name is already in use"];

    return [true]
}

function setName(id: string, name: string): validity {
    name = name.trim();
    const bot = userBots.ref[id];
    if (!bot) return [false, "Bot doesn't exist"];

    const isValid = isValidName(name, id);
    if (!isValid[0])
        return isValid;

    userBots.ref[id].name = name;

    if (bot.enabled)
        syncBot(userBots.ref[id]);

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

    if (bot.enabled)
        syncBot(userBots.ref[id]);

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

    if (bot.enabled)
        syncBot(userBots.ref[id]);

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

    if (bot.enabled)
        syncBot(userBots.ref[id]);

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
    else {
        const server = await setCommandServer(id, bot.commandServer);
        if (!server[0])
            errors.push(`Command Server: ${server[1]}`);
    }

    if (errors.length === 0)
        return [true];

    return [
        false,
        `Bot can't be enabled due to the following error(s):\n${errors.join("\n")}`
    ];
}

function convertCommands(commands: Command[]): BotCommand[] {
    return commands.map(command => {
        const args: BotCommand["args"] = command.args.map(arg => {
            const wrapper = (arg.multiWord ? `' '` : `[ ]`).split("");
            wrapper[1] = arg.name;
            return [
                wrapper.join("") + (arg.optional ? "?" : ""),
                arg.description
            ];
        });

        return {
            command: command.name,
            description: command.description,
            args
        };
    })
}

function syncBot(bot: UserBot, beta: boolean = true) {
    const wrapper = getBotWrapper(bot, beta);

    BotList.remove(wrapper.id);
    if (bot.enabled)
        BotList.add(wrapper);
}

async function enableBot(id: string): Promise<validity> {
    if (userBots.ref[id].enabled)
        return [false, "Bot is already enabled"];

    const validity = await checkPublishValidity(id);
    if (!validity[0])
        return validity;

    userBots.ref[id].enabled = true;
    syncBot(userBots.ref[id]);

    return [true];
}

function isPublic(id: string): boolean {
    return typeof publicUserBots.ref[id] !== "undefined";
}

function isArgument(object: unknown): object is Argument {
    if (typeof object !== "object") return false;

    const arg: Argument = {
        //@ts-expect-error
        description: object.description, name: object.name, multiWord: object.multiWord, optional: object.optional
    };

    if (
        typeof arg.description !== "string" ||
        typeof arg.name !== "string" ||
        (typeof arg.multiWord !== "boolean" && typeof arg.multiWord !== "undefined") ||
        (typeof arg.optional !== "boolean" && typeof arg.optional !== "undefined")
    ) return false;

    // check for extra properties
    for (const property in object)
        if (typeof arg[property] !== typeof object[property]) return false;

    return true;
}

function isCommand(object: unknown): object is Command {
    if (typeof object !== "object") return false;

    const command: Command = {
        //@ts-expect-error
        args: object.args, name: object.name, description: object.description
    };

    if (
        typeof command.name !== "string" ||
        typeof command.description !== "string" ||
        typeof command.args !== "object" ||
        !Array.isArray(command.args)
    ) return false;

    if (command.args.length > 5)
        return false;

    for (const arg of command.args)
        if (!isArgument(arg))
            return false;

    // check for extra properties
    for (const property in object)
        if (typeof command[property] !== typeof object[property]) return false;

    return true;
}

function isCommands(object: unknown): object is Command[] {
    if (typeof object !== "object" || !Array.isArray(object))
        return false;

    if (object.length > 10) return false;

    for (const item of object)
        if (!isCommand(item)) return false;

    return true;
}

function checkCommandBase(item: Command | Argument): validity {
    const name = checkBaseValidity(item.name, {
        maxLength: 20,
        minLength: 4,
    });

    if (!name[0])
        return [false, `Name: ${name[1]}`];

    const description = checkBaseValidity(item.description, {
        maxLength: 100,
        minLength: 5,
        extendedCharset: true
    });

    if (!description[0])
        return [false, `Description: ${description[1]}`];

    return [true];
}

function checkCommands(commands: Command[]): validity {
    if (commands.length > 10)
        return [false, "Only 10 commands are allowed per bot"];

    const errors: string[] = [];
    const previousCommands = new Set<string>();

    for (const [index, command] of commands.entries()) {
        const string = `Command ${index + 1}: `;

        const base = checkCommandBase(command);
        if (!base[0]) {
            errors.push(string + base[1]);
            continue;
        }

        if (previousCommands.has(command.name)) {
            errors.push(string + "Command already exists");
            continue;
        }

        previousCommands.add(command.name);

        let optional = false;
        for (const [index, arg] of command.args.entries()) {
            const string2 = string + `Arg ${index + 1}: `;

            const base = checkCommandBase(arg);
            if (!base[0]) {
                errors.push(string2 + base[1]);
                break;
            }

            if (arg.optional)
                optional = true;

            if (optional && !arg.optional) {
                errors.push(string + "Can't have a non-optional arg after an optional arg");
                break;
            }
        }
    }

    if (errors.length === 0)
        return [true];

    return [false, errors.join("\n")];
}

function setCommands(id: string, commands: Command[]): validity {
    const bot = userBots.ref[id];
    if (!bot) return [false, "Bot does not exist"];

    const validity = checkCommands(commands);
    if (!validity[0])
        return validity;

    if (commands.length === 0)
        delete userBots.ref[id].commands;
    else
        userBots.ref[id].commands = commands;

    if (bot.enabled)
        syncBot(userBots.ref[id]);

    return validity;
}


function checkEvent(event: string, enabled: boolean): validity {
    if (typeof event !== "string" || typeof enabled !== "boolean")
        return [false, "Invalid types"];

    if (typeof defaultEvents[event] !== "boolean")
        return [false, `Unknown event '${event}'`];

    return [true];
}

function setEvent(id: string, event: string, enabled: boolean): validity {
    const bot = userBots.ref[id];
    if (!bot) return [false, "Bot does not exist"];

    const validity = checkEvent(event, enabled);
    if (!validity[0])
        return validity;

    if (typeof userBots.ref[id].events === "undefined")
        userBots.ref[id].events = defaultEvents;

    userBots.ref[id].events[event] = enabled;

    if (bot.enabled)
        syncBot(userBots.ref[id]);

    return validity;
}

function getEvent(id: string, event: keyof typeof defaultEvents): boolean {
    const bot = userBots.ref[id];
    if (!bot) return undefined;
    if (!bot.events) return false;
    return bot.events[event] ?? false;
}

async function publishBot(id: string): Promise<validity> {
    const bot = userBots.ref[id];
    if (!bot) return [false, "Bot does not exist"];

    const validity = await checkPublishValidity(id);
    if (!validity[0]) 
        return validity;

    // good to publish

    publicUserBots.ref[id] = userBots.ref[id];
    syncBot(publicUserBots.ref[id], false);

    console.log(`userBots: published bot ${bot.name}`);

    return validity;
}

// ----------------------------

enum EventType {
    command = "command",
    added = "added"
}

type Event = {
    event: EventType.command,
    data: CommandRequest
} | {
    event: EventType.added,
    data: AddedRequest
}

interface CommandRequest {
    command: string;
    arguments: string[];
    areArgumentsValid: boolean;
    message: Message;
    room: UserBotRoom;
}

interface AddedRequest {
    room: UserBotRoom;
    addedBy: UserData;
    time: number;
}

interface UserBotRoom {
    name: string;
    emoji: string;
    rules: string[];
    description: string;
    id: string;
    owner?: UserData;
    members: MemberUserData[];
    bots: BotData[];
}

function toUserBotRoom(room: Room): UserBotRoom {
    return {
        id: room.data.id,
        name: room.data.name,
        emoji: room.data.emoji,
        description: room.data.description,
        rules: room.data.rules,
        owner: Users.get(room.data.owner) ?? undefined,
        members: room.getMembers(),
        bots: room.bots.botData
    }
}

export const UserBots = {
    create,
    get: getBot,
    getByAuthor: getBotsByAuthor,
    setName, setImage, setDescription,
    generateToken: generateFullToken,
    parseToken: parseFullToken,
    delete: deleteBot,
    publish: publishBot,
    enable: enableBot,
    setCommandServer, isCommands, setCommands,
    setEvent
}

// --------

async function postEvent(commandServer: string, event: Event) {
    const res = await fetch(commandServer, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
    }).catch(err => String(err));

    if (typeof res === "string")
        throw `[ERROR]: ${res}`;

    if (!res.ok)
        throw `[ERROR] (HTTP ${res.status} / ${res.statusText.toUpperCase()}): ${await res.text()}`;

    const object = await res.json().catch(e => String(e));

    if (typeof object === "string")
        throw `[ERROR] (JSON parse): ${object}`;

    if (!BotUtilities.isBotOutput(object))
        throw "[ERROR]: Response is not a valid bot output";

    return object;
}

function getBotWrapper(bot: UserBot, beta: boolean): Bot {
    const author = Users.get(bot.author);
    const commands = bot.commands ? convertCommands(bot.commands) : undefined
    if (!author) return;

    return {
        by: {
            id: author.id,
            image: author.img,
            name: author.name
        },
        checkMark: false,
        data: {
            description: bot.description,
            image: bot.image,
            // name: bot.name + (beta ? " [BETA]" : ""),
            name: bot.name,
            beta,
            private: beta ? [author.id] : undefined,
            commands,
        },
        id: `bot-usr-${bot.id}${beta ? "-beta" : ""}`,
        async command(command, args, message, room) {
            const commandData = commands.find(c => c.command === command);

            const isValid = BotUtilities.validateArguments(
                args, commandData.args.map(([a]) => a)
            );

            const event: Event = {
                event: EventType.command,
                data: {
                    command,
                    arguments: args.filter(arg => !(!arg || arg.length === 0 || arg.trim().length === 0)),
                    areArgumentsValid: isValid,
                    message,
                    room: toUserBotRoom(room)
                }
            };

            const output = await postEvent(bot.commandServer as string, event).catch(e => String(e));

            if (typeof output === "string")
                return beta ? output : undefined; // log error if in beta, otherwise ignore

            return output;
        },
        added: getEvent(bot.id, "added") ? async (room, by) => {
            const event: Event = {
                event: EventType.added,
                data: {
                    room: toUserBotRoom(room),
                    addedBy: by,
                    time: Date.now()
                }
            };

            const output = await postEvent(bot.commandServer as string, event).catch(e => String(e));

            if (typeof output === "string")
                return beta ? output : undefined; // log error if in beta, otherwise ignore

            return output;
        } : undefined,
    }
}

// enable bots

let pub = 0, beta = 0;

for (const bot of Object.values(userBots.ref)) {
    if (!bot.enabled) continue;
    syncBot(bot);
    beta++;
}

for (const bot of Object.values(publicUserBots.ref)) {
    if (!bot.enabled) continue;
    syncBot(bot, false);
    pub++;
}

console.log(`userBots: enabled ${beta} beta, ${pub} public userBots`)