import Message from '../../lib/msg';
import { BotOutput, BotTemplate, BotUtilities } from '../bots'
import Room from '../rooms';

const guessing: Record<string, [number, string, number]> = {};

export default class QuoteBot implements BotTemplate {
    name: string = "Quote Bot";
    image: string = "/public/quote.svg"
    desc: string = "Quotes messages to preserve them for years to come";
    commands: BotTemplate["commands"] = [
        {
            command: "quote random",
            description: "Turns a random message into a quote.",
            args: [],
        },
        {
            command: "quote guess",
            description: "Finds a random message and lets you guess the author.",
            args: [],
        },
        {
            command: "quote",
            description: "Quotes a specific message.",
            args: [[
                "[message]?",
                "Leave blank to quote the most recent message, or provide a specific message ID" +
                " or negative number (eg. -2 = 2nd most recent message) to quote that message."
            ]],
        },
    ]

    runCommand(command: string, args: string[], message: Message, room: Room): string | BotOutput | Promise<string> | Promise<BotOutput> {
        if (room.archive.length === 0) return "No messages have been sent";

        if (command === "quote guess") return this.startGuess(room);

        let id: number;
        if (command === "quote random") {
            id = Math.floor(Math.random() * room.archive.length)
        } else if (command === "quote") {
            const map = BotUtilities.generateArgMap(args, this.commands[2].args);
            let messageId = map ? !map.message ? -1 : Number(map.message) : NaN;
            console.log(map, messageId)

            if (messageId < 0)
                messageId = message.id + messageId;

            if (messageId >= room.archive.length || messageId < 0 || isNaN(messageId))
                return `${!isNaN(messageId) ? `Message ${messageId} does not exist. ` : ``}Please specify a message ID, a negative number (eg -3 = 3rd most recent message), or leave blank to quote the last message.`

            id = messageId;
        }

        return this.message(room.archive.getMessage(id));

    }

    private message(message: Message) {
        if (message.author.name === "Quote Bot")
            return {
                text: message.text,
                replyTo: message.replyTo
            } // lol

        return {
            text: `"${message.text.replace(/\n/g, " ").slice(0, 500)}"\n- ${message.author.name}, ${new Date(message.time).toLocaleString('en-US', {
                dateStyle: 'medium', timeStyle: "short", timeZone: "America/Chicago"
            })}`,
            replyTo: message,
        }
    }

    private startGuess(room: Room): string {

        if (typeof guessing[room.data.id] !== "undefined")
            return "Please wait until the current quote is guessed before starting another."

        const id = Math.floor(Math.random() * room.archive.length);
        const message = room.archive.getMessage(id);

        guessing[room.data.id] = [0, message.author.name, id];

        return `Who said: "${message.text}"?\nTo guess, start your message with 'guess' followed by the name of the person you want to guess (eg 'guess info').`

    }

    check(message: Message, room: Room): boolean {
        if (!guessing[room.data.id]) return false;
        return message.text.toLowerCase().startsWith("guess ")
    }

    runFilter(message: Message, room: Room): string | BotOutput {
        const guess = message.text.split("guess ")[1].trim().toLowerCase();
        const answers = [guessing[room.data.id][1], guessing[room.data.id][1].split(" ")[0]];
        const id = guessing[room.data.id][2];

        guessing[room.data.id][0] += 1;

        if (answers.map(a => a.toLowerCase()).every(a => guess !== a)) {

            if (guessing[room.data.id][0] >= 3) {
                delete guessing[room.data.id];
                return {
                    text: `Incorrect. The message was sent by ${answers[0]}`,
                    replyTo: room.archive.getMessage(id)
                }

            }

            const left = 3 - guessing[room.data.id][0]

            return `Incorrect. ${left} guess${left === 1 ? "" : "es"} remaining.`
        }


        const tries = guessing[room.data.id][0];
        delete guessing[room.data.id];

        const msgs = [
            "guessed correctly",
            "got it right",
            "answered correctly",
        ]

        const msg = msgs[Math.floor(Math.random() * msgs.length)];

        return {
            text: tries === 1 ?
                `Great job! ${message.author.name} ${msg} first try!` :
                tries === 2 ?
                    `Good job! ${message.author.name} ${msg} second try!` :
                    `Good job! ${message.author.name} ${msg} third try!`,
            replyTo: room.archive.getMessage(id)
        };

    }
}