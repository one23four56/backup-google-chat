/**
 * @version 2.0: extensive rewrites
 * 1.4: fixes to BotOutput, optimizations
 * 1.3: now supported by rooms
 * 1.2: added bot utilities class
 * 1.1: added argument support
 * 1.0: created
 */
import Message, { Poll } from '../lib/msg';
import Room, { rooms } from './rooms';
import type { UserData } from '../lib/authdata';
import { autoModResult } from './autoMod';
export interface BotOutput {
    text: string;
    image?: string;
    poll?: Poll;
    replyTo?: number;
}

/**
 * **Raw** bot data. Lacks a bot ID, author, etc.
 * @see {@link BotData}
 * @internal Unless you are working directly with bots on the server, you probably want to use {@link BotData}
 * @since Bots v2.0
 */
export interface RawBotData {
    /**
     * Name of the bot
     */
    name: string;
    /**
     * Image of the bot
     */
    image: string;
    /**
     * Description of the bot
     */
    description: string;
    /**
     * An array of commands (without the '/') that will trigger the bot
     */
    commands?: Command[];
    /**
     * Whether or not to show a check next to the bot's name
     */
    check?: boolean;
    /**
     * Whether or not the bot is in beta
     */
    beta?: boolean;
    /**
     * If bot is private: List of user IDs that have access to the bot  
     * Otherwise: undefined
     */
    private?: string[];
}

/**
 * Data about a bot.
 * @note For client use. If working directly with bots on the server, {@link RawBotData} may be more useful.
 * @see {@link RawBotData}
 * @since Bots v1.0
 */
export interface BotData extends RawBotData {
    /**
     * Bot ID
     */
    id: string;
    /**
     * Bot creator
     */
    by: {
        id: string,
        name: string,
        image: string,
    };
    /**
     * *(optional)* Time when the bot will get unmuted
     */
    mute?: number;
    /**
     * Show a check next to the bot's name
     */
    check: boolean;
    /**
     * The total number of rooms the bot is added in (**note:** dms are excluded, as members cannot control which bots are added)
     */
    roomCount: number;
}

enum BotTagIcon {
    none,
    check,
    beta
}

/**
 * Most simple bot data interface. Contains only the parts necessary to form a message. 
 * @internal For internal use only
 */
interface BasicBotData {
    id: string;
    name: string;
    image: string;
    icon: BotTagIcon;
}

type FullOutput = [BasicBotData, output];

export interface Command {
    command: string;
    args: [string, string][];
    description: string;
}

type output = string | BotOutput | Promise<string> | Promise<BotOutput> | Promise<string | BotOutput>;
type hook = (out: output) => Promise<boolean>;

export interface ProtoBot<type = any> {
    data: RawBotData;
    command?(command: string, args: string[], message: Message, room: Room): output;
    check?(message: Message, room: Room): type | null;
    filter?(message: Message, room: Room, data?: type);
    added?(room: Room, by: UserData): output;
    hooks?: Map<string, hook>;
}

export interface Bot<type = any> extends ProtoBot<type> {
    id: string;
    by: {
        id: string,
        name: string,
        image: string,
    };
    checkMark: boolean;
}

export function toBot(bot: ProtoBot): Bot {
    return {
        ...bot,
        id: "bot-sys-" + bot.data.name.toLowerCase().replace(/ /g, "-"),
        by: {
            id: "system",
            name: "Backup Google Chat",
            image: "../public/favicon.png"
        },
        checkMark: bot.data.check ?? true
    }
}

// import has to be here to avoid error
import StarterBotList from './bots/botsIndex';
let botList = [...StarterBotList];

const updateListeners: Record<string, (id: string) => any> = {};

export const BotList = {
    add(bot: Bot) {
        if (botList.find(b => b.id === bot.id))
            return;

        botList.push(bot);
        Object.values(updateListeners).forEach(l => l(bot.id));
    },
    /**
     * Gets an array of RawBotData
     * @param include (optional) IDs of bots to include. Non-present bots will not be included
     * @returns RawBotData array
     */
    getData(include?: string[]): BotData[] {
        return botList
            .filter(b => include ? include.includes(b.id) : true)
            .map(bot => ({
                ...bot.data,
                id: bot.id,
                by: bot.by,
                check: bot.checkMark,
                roomCount: BotAnalytics.getRoomCount(bot.id)
            }))
    },
    getBasic(id: string): BasicBotData {
        const data = BotList.get(id);
        return {
            name: data.data.name,
            icon: data.data.beta ? BotTagIcon.beta : data.checkMark ? BotTagIcon.check : BotTagIcon.none,
            id: data.id,
            image: data.data.image
        };
    },
    get(id: string): Bot | undefined {
        return botList.find(b => b.id === id);
    },
    remove(id: string) {
        botList = botList.filter(b => b.id !== id);
        Object.values(updateListeners).forEach(l => l(id));
    },
    update(bot: Bot) {
        botList = botList.filter(b => b.id !== bot.id);
        botList.push(bot);
        Object.values(updateListeners).forEach(l => l(bot.id));
    },
    /**
     * Gets a list of the IDs of all the bots
     * @returns A list of all the bot IDs
     */
    all(): string[] {
        return botList.map(b => b.id);
    }
};

function checkForCommands(message: string, commands: [string, string, string[], string][]): false | [string, string, string[]] {
    for (const [id, command, args, original] of commands) {
        if ((message + " ").indexOf(`/${command} `) === -1) continue;

        let parseForArgs = (message + " ").split(`/${command}`)[1];
        const output = []
        // could be a regular for/of loop since i ended up not needing index but it's to much 
        // work to change
        args.forEach((arg, _index) => {
            if (arg.charAt(0) === '[') {
                parseForArgs = parseForArgs.substring(parseForArgs.indexOf(" ") + 1);
                const out = parseForArgs.substring(0, parseForArgs.indexOf(' '));
                parseForArgs = parseForArgs.substring(parseForArgs.indexOf(" "));
                // w/ spaced-out args, the last char of one is the first char of the next, 
                // so it can't be removed
                output.push(out);
            } else if (arg.charAt(0) === "'") {
                parseForArgs = parseForArgs.substring(parseForArgs.search(/'|"/) + 1);
                const out = parseForArgs.substring(0, parseForArgs.search(/'|"/));
                parseForArgs = parseForArgs.substring(parseForArgs.search(/'|"/) + 1);
                // w/ quoted args, the last char of one is NOT the first char of the next,
                // so it can be removed
                output.push(out);
            }
        })
        return [id, original, output];
    }
    return false;
}

async function extract(output: output, cap?: true): Promise<BotOutput> {
    if (typeof output === "string")
        return { text: output };

    if (BotUtilities.isBotOutput(output))
        return output;

    if (cap === true) // caps recursion
        throw `Invalid output '${output}' (type ${typeof output})`

    return extract(await output, true);
}

export default class Bots {
    private ids: Set<string> = new Set();
    private commands: [string, string, string[], string][] = [];
    private room: Room;
    private muted: Record<string, number> = {};
    private filters: Set<string> = new Set();

    /**
     * Creates a new Bots object
     * @param room The room that this is being created for
     * @param onUpdate Function called when a bot in this room is live updated. Optional
     */
    constructor(room: Room, onUpdate?: () => any) {
        this.room = room;

        updateListeners[this.room.data.id] = (id) => {
            if (!this.ids.has(id)) return;

            this.getCommands();
            this.getFilters();
            this.updateHooks();
            if (onUpdate) onUpdate();
        }
    }

    /**
     * Add bot(s) to the room
     * @param ids ID or list of IDs of bots to add
     */
    add(ids: string | string[]) {
        if (typeof ids === "string") ids = [ids];

        for (const id of ids)
            this.ids.add(id);

        this.getCommands();
        this.getFilters();
        this.updateHooks();
    }

    private getCommands() {
        const data = BotList.getData([...this.ids]);

        this.commands = [];
        const set = new Set<string>();

        for (const bot of data) {
            if (this.muted[bot.id]) continue;
            if (!bot.commands) continue;
            for (const command of bot.commands) {

                const name = (function name(command: string, counter: number = 0) {
                    // a little recursion never hurt nobody

                    // note: the statement above was fact-checked by true american 
                    //       patriots and determined to be FALSE. recursion (and other
                    //       liberal ideas) have in fact hurt many people.

                    const item = counter ? command + counter : command;

                    if (set.has(item))
                        return name(command, counter + 1);

                    set.add(item);

                    return item;
                })(command.command);

                this.commands.push([
                    bot.id, name, command.args.map(([a]) => a), command.command
                ]);
            }
        }
    }

    private getFilters() {
        this.filters = new Set();
        for (const bot of this.ids) {
            if (this.muted[bot]) continue;
            const data = BotList.get(bot);
            if (!data) continue;
            if (!data.check || !data.filter) continue;
            this.filters.add(data.id);
        }
    }

    private getHookFor(botId: string): hook {
        return async (output) => {
            if (!this.ids.has(botId)) return false;

            if (this.muted[botId]) return false;

            if (!this.room.data.options.botsCanWakeRoom && this.room.sessions.online === 0)
                return false;

            const message = await this.generateMessage([
                BotList.getBasic(botId), output
            ]).catch(e => String(e));

            if (typeof message === "string") {
                console.log(message, "(in hook)");
                return false;
            }

            const result = this.room.autoMod.check(message, true);
            switch (result) {
                case autoModResult.pass:
                    this.room.message(message);
                    return true;

                case autoModResult.kick:
                    this.room.muteBot(botId, this.room.data.options.autoMod.botMuteDuration, "Auto Moderator");
                    return false;

                default:
                    return false;
            }
        }
    }

    private updateHooks() {
        for (const id of this.ids) {
            if (this.muted[id]) continue;
            const bot = BotList.get(id);
            if (!bot || !bot.hooks) continue;

            bot.hooks.set(this.room.data.id, this.getHookFor(id));
        }
    }

    /**
     * Remove bot(s) from the room
     * @param ids ID or list of IDs of bots to remove
     */
    remove(ids: string | string[]) {
        if (typeof ids === "string") ids = [ids];

        for (const id of ids) {
            this.ids.delete(id);
            const bot = BotList.get(id);
            if (!bot || !bot.hooks) continue;
            bot.hooks.delete(this.room.data.id);
        }

        this.getCommands();
        this.getFilters();
        // this.updateHooks(); // not needed, see above
    }

    /**
     * BotData for all bots in the room
     */
    get botData(): BotData[] {
        return BotList.getData(Array.from(this.ids)).map(d => ({
            ...d,
            mute: this.muted[d.id]
        }));
    }

    mute(id: string, time: number) {
        this.muted[id] = time;
        this.getCommands();
        this.getFilters();
        this.updateHooks();
    }

    unmute(id: string) {
        delete this.muted[id];
        this.getCommands();
        this.getFilters();
        this.updateHooks();
    }

    runBots(message: Message) {
        const command = this.runCommands(message);
        const filters = this.runFilters(message);
        const outputs: FullOutput[] = [];

        if (command) outputs.push(command);
        if (filters) outputs.push(...filters);

        if (outputs.length === 0) return;

        for (const output of outputs)
            this.sendMessage(output);
    }

    private runCommands(message: Message): undefined | FullOutput {
        const commands = checkForCommands(message.text, this.commands);
        if (commands === false) return;
        const [botId, command, args] = commands;

        const bot = BotList.get(botId);
        if (!bot || !bot.command) return;

        const output = bot.command(command, args, message, this.room);
        return [
            BotList.getBasic(botId),
            output
        ];
    }

    private runFilters(message: Message): undefined | FullOutput[] {
        if (this.filters.size === 0) return;
        const output: FullOutput[] = [];
        for (const id of this.filters) {
            const bot = BotList.get(id);
            const data = bot.check(message, this.room);
            if (!data) continue;
            output.push([
                BotList.getBasic(id),
                bot.filter(message, this.room, data)
            ]);
        }

        return output;
    }

    private async generateMessage([bot, output]: FullOutput): Promise<Message> {
        const out = await extract(output).catch(e => String(e));
        if (typeof out === "string")
            throw `bots: message send failed for ${bot.name}: ${out}`

        const { text, image, poll, replyTo: replyId } = out;
        const replyTo = replyId ? this.room.archive.getMessage(replyId) : undefined;

        return {
            text,
            author: bot,
            time: new Date(),
            id: this.room.archive.length,
            tags: [{
                text: 'BOT',
                color: 'white',
                bgColor: '#3366ff',
                icon: bot.icon === BotTagIcon.check ? "fa-solid fa-check" :
                    bot.icon === BotTagIcon.beta ? "fa-solid fa-screwdriver-wrench" :
                        undefined,
            }],
            media: image ? [{
                type: 'link',
                location: image
            }] : undefined,
            // poll: poll ? poll : undefined,
            replyTo
        }
    }

    private async sendMessage(out: FullOutput): Promise<number | void> {
        const message = await this.generateMessage(out).catch(e => String(e));
        if (typeof message === "string") 
            return console.log(message);

        return this.room.message(message);
    }

    runAdded(botId: string, user: UserData) {
        if (!this.ids.has(botId)) return;

        const bot = BotList.get(botId);
        if (!bot || !bot.added) return;

        const output: FullOutput = [
            {
                id: bot.id, name: bot.data.name, image: bot.data.image,
                icon: bot.checkMark ? BotTagIcon.check : bot.data.beta ? BotTagIcon.beta : BotTagIcon.none
            },
            bot.added(this.room, user)
        ];

        return this.sendMessage(output);
    }
}


export const BotUtilities = {
    validateArguments(args: string[], map: string[]): boolean {
        const
            requiredLength = map.filter(arg => arg.charAt(arg.length - 1) !== '?').length,
            optionalLength = map.length,
            actualLength = args.filter(arg => !(!arg || arg.length === 0 || arg.trim().length === 0)).length;

        if (actualLength < requiredLength || actualLength > optionalLength)
            return false;

        return true;

    },
    generateArgMap(args: string[], rawMap: string[][]) {

        const map = rawMap.map(a => a[0]);

        if (!BotUtilities.validateArguments(args, map)) return false;

        args = args.filter(arg => !(!arg || arg.length === 0 || arg.trim().length === 0));

        const output: { [key: string]: string } = {};

        map.forEach((mapArg, index) => {
            if (args[index])
                output[mapArg.split("").filter(char => char.search(/\[|\]|'|"|\?| /) === -1).join("")] = args[index];
        })

        return output;
    },
    isBotOutput(object: unknown): object is BotOutput {
        if (typeof object !== "object")
            return false;

        const output: BotOutput = {
            // @ts-expect-error
            text: object.text, image: object.image, replyTo: object.replyTo
        };

        if (typeof output.text !== "string" ||
            (typeof output.image !== "string" && typeof output.image !== "undefined") ||
            (typeof output.replyTo !== "number" && typeof output.replyTo !== "undefined")
        ) return false;

        if (output.text.length > 5000 || output.image?.length > 1000)
            return false;

        // check for extra keys
        for (const key in object)
            if (typeof object[key] !== typeof output[key])
                return false;

        return true;
    },
    convertLegacyId(id: string): string {
        const names: Record<string, string> = {
            "ArchiveBot": "Archive Bot",
            "InspiroBot": "InspiroBot",
            "RandomBot": "Random Bot",
            "GradesBot": "Grades Bot",
            "QuotesBot": "Quote Bot",
            "LabBot": "Lab Bot",
        };

        const name = names[id];
        if (!name) return;

        return "bot-sys-" + name.toLowerCase().replace(/ /g, "-");
    },
    getSystemNames(): string[] {
        return StarterBotList.map(b => b.data.name);
    }
}

/**
 * Manages bot analytics
 */
export namespace BotAnalytics {
    let roomCount: Record<string, number> = {};
    let roomList: Record<string, Set<string>> = {};

    export function getRoomCount(bot: string): number {
        return roomCount[bot] ?? 0;
    }

    export function getTotalRoomCount() {
        return roomCount;
    }

    export function countRooms() {
        const startTime = Date.now();
        let roomTotal = 0, botTotal = 0; // for logging lol
        const sets: Record<string, Set<string>> = {};
        for (const roomId in rooms.ref) {
            const room = rooms.ref[roomId];
            if (!room.bots || room.bots.length === 0) continue;
            //@ts-expect-error
            if (room.type && room.type === "DM") continue;
            roomTotal += 1;

            for (const bot of room.bots) {
                botTotal += 1;

                if (!sets[bot])
                    sets[bot] = new Set();

                sets[bot].add(roomId);
            }
        }

        const counts: Record<string, number> = {};
        for (const bot in sets)
            counts[bot] = sets[bot].size;

        roomCount = counts;
        roomList = sets;
        console.log(`botAnalytics: Counted ${botTotal} bots in ${roomTotal} rooms in ${Date.now() - startTime}ms`);
        return counts;
    }

    export function getRooms(bot: string): Set<string> {
        return roomList[bot] ?? new Set();
    }
}


//*------------------------------------------------------*//
//* To register a bot, go to bots/botsIndex.ts, import it, then export it
//* It will do everything else automatically for you, all you have to do is add the bot to a room
//*------------------------------------------------------*//