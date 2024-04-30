import Message from '../../lib/msg';
import { BotOutput, BotTemplate, BotUtilities } from '../bots'
import Room from '../rooms';

// room id : [tries, answer, message ID, hint used, og quote bot message (to edit)]
// should not have used a tuple here, but it's too much work to change
const guessing: Record<string, [number, string, number, boolean, number]> = {};

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

        if (command === "quote guess") return QuoteBot.startGuess(room);

        let id: number;
        if (command === "quote random") {
            id = QuoteBot.getRandomId(room);
        } else if (command === "quote") {
            const map = BotUtilities.generateArgMap(args, this.commands[2].args);
            let messageId = map ? !map.message ? -1 : Number(map.message) : NaN;

            if (messageId < 0)
                messageId = message.id + messageId;

            if (messageId >= room.archive.length || messageId < 0 || isNaN(messageId))
                return `${!isNaN(messageId) ? `Message ${messageId} does not exist. ` : ``}Please specify a message ID, a negative number (eg -3 = 3rd most recent message), or leave blank to quote the last message.`

            id = messageId;
        }

        return QuoteBot.message(room.archive.getMessage(id));

    }

    static getRandomId(room: Room, tries = 1): number {
        const id = Math.floor(Math.random() * room.archive.length);
        const message = room.archive.getMessage(id);

        if (message.deleted || (message.tags && message.tags.find(t => t.text === "BOT"))) {
            // limit to a max of 3 tries to find a valid message before giving up
            if (tries >= Math.min(room.archive.length, 3)) return id;

            return this.getRandomId(room, tries + 1);
        }

        return id;
    }

    static message(message: Message) {
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

    static startGuess(room: Room): string {

        if (typeof guessing[room.data.id] !== "undefined")
            return "Please wait until the current quote is guessed before starting another."

        const id = QuoteBot.getRandomId(room);
        const message = room.archive.getMessage(id);

        guessing[room.data.id] = [0, message.author.name, id, false, room.archive.length];

        return `Who said: "${message.text}"?\n` +
            `To guess: Start your message with 'guess' followed by the name of the person you want to guess (eg 'guess info').\n` +
            `For a hint: Say 'hint'.`

    }

    check(message: Message, room: Room): boolean {
        if (!guessing[room.data.id]) return false;
        return message.text.startsWith("guess ") || message.text.startsWith("hint");
    }

    runFilter(message: Message, room: Room): string | BotOutput {

        if (message.text.startsWith("hint")) {
            if (guessing[room.data.id][3] === true) return "You already used a hint.";

            guessing[room.data.id][3] = true;

            let out: string = "";

            const formatter = new Intl.DateTimeFormat("en-US", {
                timeZone: "America/Chicago",
                dateStyle: "medium",
                timeStyle: "short"
            });

            for (const id of new Array<number>(5).fill(guessing[room.data.id][2] - 2).map((v, i) => v + i)) {
                const message = room.archive.getMessage(id);
                if (!message) continue;
                                
                out += `(${formatter.format(Date.parse(message.time as any as string))}) `;
                out += `Someone said: ${message.text.slice(0, 100).replace(/\n/g, " ")}\n`;
            }

            return out;
        }

        const guess = message.text.split("guess ")[1].trim().toLowerCase();
        const answers = [guessing[room.data.id][1], guessing[room.data.id][1].split(" ")[0]];
        const id = guessing[room.data.id][2];

        guessing[room.data.id][0] += 1;

        if (answers.map(a => a.toLowerCase()).every(a => guess !== a)) {

            if (guessing[room.data.id][0] >= 3) {
                delete guessing[room.data.id];
                { // edit old message to clean it up
                    const editId = guessing[room.data.id][4];
                    const editMessage = room.archive.getMessage(editId);
                    if (editMessage.author.name === "Quote Bot")
                        room.edit(editId, editMessage.text.split("\n")[0]);
                }
                return {
                    text: `Incorrect. The message was sent by ${answers[0]}`,
                    replyTo: room.archive.getMessage(id)
                }

            }

            const left = 3 - guessing[room.data.id][0]

            return `Incorrect. ${left} guess${left === 1 ? "" : "es"} remaining.`
        }

        { // edit old message to clean it up
            const editId = guessing[room.data.id][4];
            const editMessage = room.archive.getMessage(editId);
            if (editMessage.author.name === "Quote Bot")
                room.edit(editId, editMessage.text.split("\n")[0]);
        }

        const tries = guessing[room.data.id][0];
        const hint = guessing[room.data.id][3];
        delete guessing[room.data.id];

        const msgs = [
            "guessed correctly",
            "got it right",
            "answered correctly",
        ]

        const msg = msgs[Math.floor(Math.random() * msgs.length)];

        const hintMsg = hint ? ", with one hint" : "";

        return {
            text: tries === 1 ?
                `Great job! ${message.author.name} ${msg} first try${hintMsg}!` :
                tries === 2 ?
                    `Good job! ${message.author.name} ${msg} second try${hintMsg}!` :
                    `Good job! ${message.author.name} ${msg} third try${hintMsg}!`,
            replyTo: room.archive.getMessage(id)
        };

    }
}