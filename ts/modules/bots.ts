/**
 * @version 1.2: added bot utilities class
 * 1.1: added argument support
 * 1.0: created
 */
import Message, { Poll } from '../lib/msg';
import { Archive } from './archive';
import { sendMessage } from './functions';
import HelperBot from './bots/helper'
import TimeBot from './bots/timebot'
import ArchiveBot from './bots/archive'
import RandomBot from './bots/random'
import InspiroBot from './bots/inspiro'
import Polly from './bots/polly'

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
    runCommand?(command: string, args: string[], message: Message): string | BotOutput | Promise<string> | Promise<BotOutput>;
    /**
     * Will be called when the check function returns true on a message
     * @param message Message that passed the check
     * @returns {string} The text of a message to generate and send
     */
    runFilter?(message: Message): string;
    /**
     * Should be called by the startTrigger function when the custom trigger is met
     * @param args Any custom arguments
     * @returns {string} The text of a message to generate and send
     */
    runTrigger?(...args: any[]): any;
    /**
     * Called on bot registration, should start a custom trigger
     */
    startTrigger?(): void;
}

interface BotData {
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
 * @hideconstructor
 */
export default class Bots {
    static bots: BotTemplate[] = [];
    static botData: BotData[] = [];

    /**
     * Registers a bot
     * @param {BotTemplate} bot Bot to register
     * @since bots v1.0
     */
    static register(bot: BotTemplate) {
        Bots.bots.push(bot);

        const type = []
        if (bot.commands && bot.runCommand) type.push('command');
        if (bot.check && bot.runFilter) type.push('filter');
        if (bot.runTrigger) {
            type.push('trigger');
            if (bot.startTrigger) bot.startTrigger();
        }

        let typeString = type.join('-');
        if (type.length > 1) typeString += ' hybrid'

        Bots.botData.push({
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
    static checkForCommand(command: string, args: string[], message: Message): boolean | string[] {
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
                    parseForArgs = parseForArgs.substring(parseForArgs.indexOf("'") + 1);
                    const out = parseForArgs.substring(0, parseForArgs.indexOf("'"));
                    parseForArgs = parseForArgs.substring(parseForArgs.indexOf("'") + 1);
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
    static runBotsOnMessage(message: Message) {
        for (const bot of Bots.bots) {
            if (bot.check && bot.runFilter)
                if (bot.check(message)) {
                    const msg: Message = {
                        text: bot.runFilter(message),
                        author: {
                            name: bot.name,
                            img: bot.image,
                        },
                        time: new Date(new Date().toUTCString()),
                        id: Archive.getArchive().length,
                        archive: true,
                        tag: {
                            text: 'BOT',
                            color: 'white',
                            bg_color: '#3366ff'
                        }
                    }
                    sendMessage(msg);
                    Archive.addMessage(msg);
                    console.log(`Bot message from ${bot.name}: ${msg.text}`);
                }

            if (bot.commands && bot.runCommand)
                for (const command of bot.commands) {
                    // this ended up being WAY more complex that i ever intended, but it works
                    const args = Bots.checkForCommand(command.command, command.args, message);
                    if (typeof args !== 'boolean') {
                        const botMessage = bot.runCommand(command.command, args, message);
                        if (typeof botMessage === 'string') {
                            BotUtilities.genBotMessage(bot.name, bot.image, {
                                text: botMessage
                            })
                        } else if (BotUtilities.determineIfObject(botMessage)) {
                            BotUtilities.genBotMessage(bot.name, bot.image, {
                                text: botMessage.text,
                                image: botMessage.image,
                                poll: botMessage.poll,
                            })
                        } else {
                            botMessage.then((msg: string | BotOutput) => {
                                if (typeof msg === 'string') {
                                    BotUtilities.genBotMessage(bot.name, bot.image, {
                                        text: msg
                                    })
                                } else {
                                    BotUtilities.genBotMessage(bot.name, bot.image, {
                                        text: msg.text,
                                        image: msg.image,
                                        poll: msg.poll,
                                    })
                                }
                            })
                        }
                    }
                }
        }  // this bracket tree leaves me in awe
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
                output[mapArg.split("").filter(char => char.search(/\[|\]|'|\?| /) === -1).join("")] = args[index];
        })

        return output;
    }

    static genBotMessage(name: string, img: string, { text, image, poll, replyTo }: BotOutput) {
        const msg: Message = {
            text: text,
            author: {
                name: name,
                img: img,
            },
            time: new Date(new Date().toUTCString()),
            id: Archive.getArchive().length,
            archive: true,
            tag: {
                text: 'BOT',
                color: 'white',
                bg_color: '#3366ff'
            },
            image: image ? image : undefined, // i dont think these ternaries are necessary but i'm adding them anyway
            poll: poll ? poll : undefined,
            replyTo: replyTo ? replyTo : undefined
        }

        sendMessage(msg);
        Archive.addMessage(msg);
        console.log(`Bot message from ${name}: ${text}`);
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
//* Register bots below
//*------------------------------------------------------*//

Bots.register(new HelperBot());
Bots.register(new TimeBot());
Bots.register(new ArchiveBot());
Bots.register(new RandomBot());
Bots.register(new InspiroBot())
Bots.register(new Polly())