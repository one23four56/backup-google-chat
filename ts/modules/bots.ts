/**
 * @version 2.0: extensive rewrites
 * 1.4: fixes to BotOutput, optimizations
 * 1.3: now supported by rooms
 * 1.2: added bot utilities class
 * 1.1: added argument support
 * 1.0: created
 */
import Message, { Poll } from '../lib/msg';
import Room from './rooms';
export interface BotOutput {
    text: string;
    image?: string;
    poll?: Poll;
    replyTo?: Message;
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
}

/**
 * Most simple bot data interface. Contains only the parts necessary to form a message. 
 * @internal For internal use only
 */
interface BasicBotData {
    id: string;
    name: string;
    image: string;
}

type FullOutput = [BasicBotData, output];

export interface Command {
    command: string;
    args: [string, string][];
    description: string;
}

type output = string | BotOutput | Promise<string> | Promise<BotOutput>;

export interface ProtoBot<type = any> {
    data: RawBotData;
    command?(command: string, args: string[], message: Message, room: Room): output;
    check?(message: Message, room: Room): type | null;
    filter?(message: Message, room: Room, data?: type);
}

export interface Bot<type = any> extends ProtoBot<type> {
    id: string;
    by: {
        id: string,
        name: string,
        image: string,
    };
}

export function toBot(bot: ProtoBot): Bot {
    return {
        ...bot,
        id: "bot-sys-" + bot.data.name.toLowerCase().replace(/ /g, "-"),
        by: {
            id: "system",
            name: "Backup Google Chat",
            image: "../public/favicon.png"
        }
    }
}

// import has to be here to avoid error
import StarterBotList from './bots/botsIndex';
let botList = [...StarterBotList];

export const BotList = {
    add(bot: Bot) {
        if (botList.find(b => b.id === bot.id))
            return;

        botList.push(bot);
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
                by: bot.by
            }))
    },
    get(id: string): Bot | undefined {
        return botList.find(b => b.id === id);
    },
    remove(id: string) {
        botList = botList.filter(b => b.id !== id);
    }
};

function checkForCommands(message: string, commands: [string, string, string[]][]): false | [string, string, string[]] {
    for (const [id, command, args] of commands) {
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
        return [id, command, output];
    }
    return false;
}

async function extract(output: output): Promise<BotOutput> {
    if (typeof output === "string")
        return { text: output };

    if (BotUtilities.determineIfObject(output))
        return output;

    return extract(await output);
}

export default class Bots {
    private ids: Set<string> = new Set();
    private commands: [string, string, string[]][] = [];
    private room: Room;
    private muted: Record<string, number> = {};
    private filters: Set<string> = new Set();

    constructor(room: Room) {
        this.room = room;
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
    }

    private getCommands() {
        const data = BotList.getData([...this.ids]);
        this.commands = [];
        for (const bot of data) {
            if (this.muted[bot.id]) continue;
            if (!bot.commands) continue;
            for (const command of bot.commands)
                this.commands.push([
                    bot.id, command.command, command.args.map(([a]) => a)
                ]);
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

    /**
     * Remove bot(s) from the room
     * @param ids ID or list of IDs of bots to remove
     */
    remove(ids: string | string[]) {
        if (typeof ids === "string") ids = [ids];

        for (const id of ids)
            this.ids.delete(id);

        this.getCommands();
        this.getFilters();
    }

    /**
     * BotData for all bots in the room
     */
    get botData(): BotData[] {
        return BotList.getData([...this.ids]).map(d => ({
            ...d,
            mute: this.muted[d.id]
        }));
    }

    mute(id: string, time: number) {
        this.muted[id] = time;
        this.getCommands();
        this.getFilters();
    }

    unmute(id: string) {
        delete this.muted[id];
        this.getCommands();
        this.getFilters();
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
            { id: bot.id, name: bot.data.name, image: bot.data.image },
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
                {
                    id: bot.id, name: bot.data.name, image: bot.data.image
                },
                bot.filter(message, this.room, data)
            ]);
        }

        return output;
    }

    private async sendMessage([bot, output]: FullOutput) {
        const { text, image, poll, replyTo } = await extract(output);
        this.room.message({
            text,
            author: bot,
            time: new Date(),
            id: this.room.archive.length,
            tags: [{
                text: 'BOT',
                color: 'white',
                bgColor: '#3366ff'
            }],
            media: image ? [{
                type: 'link',
                location: image
            }] : undefined,
            // poll: poll ? poll : undefined,
            replyTo: replyTo ? replyTo : undefined
        });
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
    determineIfObject(obj: BotOutput | Promise<string> | Promise<BotOutput>): obj is BotOutput {
        return (
            typeof obj === 'object' &&
            obj.hasOwnProperty('text') &&
            (
                obj.hasOwnProperty('image') ||
                obj.hasOwnProperty('poll') ||
                obj.hasOwnProperty('replyTo')
            )
        );
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
    }
}


//*------------------------------------------------------*//
//* To register a bot, go to bots/botsIndex.ts, import it, then export it
//* It will do everything else automatically for you, all you have to do is add the bot to a room
//*------------------------------------------------------*//