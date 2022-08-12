/**
 * @version 1.3: now supported by rooms
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

export interface BotTemplate {
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
    desc: string;
    /**
     * An array of commands (without the '/') that will trigger the bot
     */
    commands?: {
        command: string, 
        args: string[],
    }[];
    /**
     * Preforms a custom check on the message
     * @param message Message to check
     * @returns {boolean} Whether the message should be handled by the bot
     */
    check?(message: Message): boolean;
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
    runFilter?(message: Message, room: Room): string;
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

export interface BotData {
    name: string;
    image: string;
    desc: string;
    type: string;
    commands?: {
        command: string,
        args: string[],
    }[];
}

/**
 * @classdesc Class for managing bots 
 */
export default class Bots {
    bots: BotTemplate[] = [];
    botData: BotData[] = [];
    room: Room;

    constructor(room: Room) {
        this.room = room;
    }

    /**
     * Registers a bot
     * @param {BotTemplate} bot Bot to register
     * @since bots v1.0
     */
    register(bot: BotTemplate) {
        this.bots.push(bot);

        const type = []
        if (bot.commands && bot.runCommand) type.push('command');
        if (bot.check && bot.runFilter) type.push('filter');
        if (bot.runTrigger) {
            type.push('trigger');
            if (bot.startTrigger) bot.startTrigger(this.room);
        }

        let typeString = type.join('-');
        if (type.length > 1) typeString += ' hybrid'

        this.botData.push({
            name: bot.name,
            image: bot.image,
            desc: bot.desc,
            type: typeString,
            commands: bot.commands
        })
    }

    /**
     * Checks a message for a command
     * @param {string} command Command to check for
     * @param {Message} message Message to check
     * @returns {boolean} True if found, false if not
     * @since bots v1.0
     */
    checkForCommand(command: string, args: string[], message: Message): boolean | string[] {
        if ((message.text + " ").indexOf(`/${command} `) !== -1) {
            let parseForArgs = (message.text + " ").split(`/${command}`)[1];
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
            return output;
        }
        return false;
    }

    /**
     * Runs the bots on a message
     * @param {Message} message Message to run bots on
     * @since bots v1.0
     */
    runBotsOnMessage(message: Message) {
        for (const bot of this.bots) {
            if (bot.check && bot.runFilter)
                if (bot.check(message)) {
                    const msg: Message = {
                        text: bot.runFilter(message, this.room),
                        author: {
                            name: bot.name,
                            image: bot.image,
                            id: 'bot'
                        },
                        time: new Date(new Date().toUTCString()),
                        id: this.room.archive.length,
                        tag: {
                            text: 'BOT',
                            color: 'white',
                            bgColor: '#3366ff'
                        }
                    }
                    
                    this.room.message(msg)
                }

            if (bot.commands && bot.runCommand)
                for (const command of bot.commands) {
                    // this ended up being WAY more complex that i ever intended, but it works
                    const args = this.checkForCommand(command.command, command.args, message);
                    if (typeof args !== 'boolean') {
                        const botMessage = bot.runCommand(command.command, args, message, this.room);
                        if (typeof botMessage === 'string') {
                            this.genBotMessage(bot.name, bot.image, {
                                text: botMessage
                            })
                            return;
                        } else if (BotUtilities.determineIfObject(botMessage)) {
                            this.genBotMessage(bot.name, bot.image, {
                                text: botMessage.text,
                                image: botMessage.image,
                                poll: botMessage.poll,
                            })
                            return;
                        } else {
                            botMessage.then((msg: string | BotOutput) => {
                                if (typeof msg === 'string') {
                                    this.genBotMessage(bot.name, bot.image, {
                                        text: msg
                                    })
                                    return;
                                } else {
                                    this.genBotMessage( bot.name, bot.image, {
                                        text: msg.text,
                                        image: msg.image,
                                        poll: msg.poll,
                                    })
                                    return;
                                }
                            })
                        }
                    }
                }
        }  // this bracket tree leaves me in awe
    }

    genBotMessage(name: string, img: string, { text, image, poll, replyTo }: BotOutput): Message {
        const msg: Message = {
            text: text,
            author: {
                name: name,
                image: img,
                id: 'bot'
            },
            time: new Date(new Date().toUTCString()),
            id: this.room.archive.length,
            tag: {
                text: 'BOT',
                color: 'white',
                bgColor: '#3366ff'
            },
            // image: image ? image : undefined, // i don't think these ternaries are necessary but i'm adding them anyway
            poll: poll ? poll : undefined,
            replyTo: replyTo ? replyTo : undefined
        }

        this.room.message(msg)

        return msg;
    }
}

/**
 * @classdesc Contains functions for use in bots
 * @hideconstructor
 */
export class BotUtilities {
    static validateArguments(args: string[], map: string[]): boolean {
        const 
            requiredLength = map.filter(arg => arg.charAt(arg.length-1) !== '?').length,
            optionalLength = map.length,
            actualLength = args.filter(arg => !(!arg || arg.length === 0 || arg.trim().length === 0)).length;

        if (actualLength < requiredLength || actualLength > optionalLength)
            return false;

        return true;

    }

    static generateArgMap(args: string[], map: string[]) {
        if (!BotUtilities.validateArguments(args, map)) return false;

        args = args.filter(arg => !(!arg || arg.length === 0 || arg.trim().length === 0));

        const output: { [key: string]: string } = {};

        map.forEach((mapArg, index) => {
            if (args[index]) 
                output[mapArg.split("").filter(char => char.search(/\[|\]|'|"|\?| /) === -1).join("")] = args[index];
        })

        return output;
    }

    static determineIfObject(obj: BotOutput | Promise<string> | Promise<BotOutput>): obj is BotOutput {
        return (
            typeof obj === 'object' && 
            obj.hasOwnProperty('text') && 
            (
                obj.hasOwnProperty('image') || 
                obj.hasOwnProperty('poll') ||
                obj.hasOwnProperty('replyTo')
            )  
        );
    }
}


//*------------------------------------------------------*//
//* Registering bots is now done in rooms.ts
//*------------------------------------------------------*//