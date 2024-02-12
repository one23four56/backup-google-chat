import Message from '../../lib/msg';
import { BotOutput, BotTemplate, BotUtilities } from '../bots'
import Room from '../rooms';

export default class QuoteBot implements BotTemplate {
    name: string = "Quote Bot";
    image: string = "/public/quote.svg"
    desc: string = "Quotes messages to preserve them for years to come"
    commands: { command: string; args: string[]; }[] = [
        {
            command: "quote random",
            args: []
        },
        {
            command: "quote",
            args: ["[message]?"]
        }
    ]

    runCommand(command: string, args: string[], message: Message, room: Room): string | BotOutput | Promise<string> | Promise<BotOutput> {
        if (room.archive.length === 0) return "No messages have been sent";

        let id: number;
        if (command === "quote random") {
            id = Math.floor(Math.random() * room.archive.length)
        } else if (command === "quote") {
            const map = BotUtilities.generateArgMap(args, this.commands[1].args);
            let messageId = map ? !map.message ? -1 : Number(map.message) : NaN;

            if (messageId < 0)
                messageId = message.id + messageId;

            if (messageId >= room.archive.length || messageId < 0 || isNaN(messageId))
                return `${!isNaN(messageId) ? `Message ${messageId} does not exist. ` : ``}Please specify a message ID, a negative number (eg -3 = 3rd most recent message), or leave blank to quote the last message.`

            id = messageId;
        }

        const msg = room.archive.getMessage(id);

        if (msg.author.name === "Quote Bot")
            return {
                text: msg.text,
                replyTo: msg.replyTo
            } // lol

        return {
            text: `"${msg.text.replace(/\n/g, " ").slice(0, 500)}"\n- ${msg.author.name}, ${new Date(msg.time).toLocaleString('en-US', {
                dateStyle: 'medium', timeStyle: "short"
            })}`,
            replyTo: msg,
        }
    }
}