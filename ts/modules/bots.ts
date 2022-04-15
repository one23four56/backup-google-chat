/**
 * @version 1.0: created
 */
import Message from '../lib/msg';
import { Archive } from './archive';
import { sendMessage } from './functions';
import HelperBot from './bots/helper'
import TimeBot from './bots/timebot'
import ArchiveBot from './bots/archive'
import RandomBot from './bots/random'


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
    runCommand?(command: string, args: string[], message: Message): string;
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
        if (bot.runTrigger && bot.startTrigger) {
            type.push('trigger');
            bot.startTrigger();
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
    static checkForCommand(command: string, args: string[], message: Message): boolean | Object {
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
                for (const command of bot.commands)
                    if (Bots.checkForCommand(command.command, command.args, message)) {
                        const msg: Message = {
                            text: bot.runCommand(command.command, command.args, message),
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
        }
    }
}


//*------------------------------------------------------*//
//* Register bots below
//*------------------------------------------------------*//

Bots.register(new HelperBot());
Bots.register(new TimeBot());
Bots.register(new ArchiveBot());
Bots.register(new RandomBot());