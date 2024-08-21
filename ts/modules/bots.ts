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

export interface BotData {
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
     * Bot creator
     */
    by: {
        id: string,
        name: string,
        image: string,
    };
}

export interface FullBotData extends BotData {
    id: string;
}

export interface Command {
    command: string;
    args: [string, string][];
    description: string;
}

type output = string | BotOutput | Promise<string> | Promise<BotOutput>;

export interface ProtoBot<type = any> {
    data: BotData;
    command?(command: string, args: string[], message: Message, room: Room): output;
    check?(message: Message, room: Room): type | null;
    filter?(message: Message, room: Room, data?: type);
}

export interface Bot<type = any> extends ProtoBot<type> {
    id: string;
}

export interface BotTemplate extends BotData {
    /**
     * Preforms a custom check on the message
     * @param message Message to check
     * @returns {boolean} Whether the message should be handled by the bot
     */
    check?(message: Message, room: Room): boolean;
    /**
     * Will be called if a message contains a command in the bot's command list
     * @param command Command that is being ran (without the '/')
     * @param message Message that contains the command
     */
    runCommand?(command: string, args: string[], message: Message, room: Room): string | BotOutput | Promise<string> | Promise<BotOutput>;
    /**
     * Will be called when the check function returns true on a message
     * @param message Message that passed the check
     * @returns {string} The text of a message to generate and send
     */
    runFilter?(message: Message, room: Room): string | BotOutput;
    /**
     * Should be called by the startTrigger function when the custom trigger is met
     * @param args Any custom arguments
     * @returns {string} The text of a message to generate and send
     */
    runTrigger?(...args: any[]): any;
    /**
     * Called on bot registration, should start a custom trigger
     */
    startTrigger?(room: Room): void;
}

export function toBot(bot: ProtoBot): Bot {
    return {
        ...bot,
        id: "bot-sys-" + bot.data.name.toLowerCase().replace(/ /g, "-")
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
     * Gets an array of BotData
     * @param include (optional) IDs of bots to include. Non-present bots will not be included
     * @returns BotData array
     */
    getData(include?: string[]): FullBotData[] {
        return botList
            .filter(b => include ? include.includes(b.id) : true)
            .map(bot => ({
                ...bot.data,
                id: bot.id
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
    }

    private getCommands() {
        const data = BotList.getData([...this.ids]);
        this.commands = [];
        for (const bot of data) {
            if (!bot.commands) continue;
            for (const command of bot.commands)
                this.commands.push([
                    bot.id, command.command, command.args.map(([a]) => a)
                ]);
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
    }

    /**
     * BotData for all bots in the room
     */
    get botData(): FullBotData[] {
        return BotList.getData([...this.ids]);
    }

    runBots(message: Message) {
        const commands = checkForCommands(message.text, this.commands);
        if (commands === false) return;
        const [botId, command, args] = commands;

        const bot = BotList.get(botId);
        if (!bot || !bot.command) return;

        const output = bot.command(command, args, message, this.room);
        if (!output) return;

        extract(output).then(({ text, image, poll, replyTo }) => this.room.message({
            text,
            author: {
                name: bot.data.name,
                image: bot.data.image,
                id: bot.id
            },
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
        }))
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