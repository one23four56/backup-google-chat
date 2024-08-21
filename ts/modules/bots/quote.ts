import Message from '../../lib/msg';
import { RawBotData, BotOutput, BotUtilities, toBot } from '../bots'
import Room from '../rooms';

interface GuessData {
    tries: number;
    answers: [string, string, string];
    /**
     * ID of the message being guessed
     */
    guessingId: number;
    /**
     * ID of the bot message (to edit later)
     */
    editId: number;
    hints: number;
}

const guessing: Record<string, GuessData> = {};

const data: RawBotData = {
    name: "Quote Bot",
    image: "/public/quote.svg",
    description: "Quotes messages to preserve them for years to come",
    commands: [
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
    ],
}

function command(command: string, args: string[], message: Message, room: Room): string | BotOutput | Promise<string> | Promise<BotOutput> {
    if (room.archive.length === 0) return "No messages have been sent";

    if (command === "quote guess") return startGuess(room);

    let id: number;
    if (command === "quote random") {
        id = getRandomId(room);
    } else if (command === "quote") {
        const map = BotUtilities.generateArgMap(args, data.commands[2].args);
        let messageId = map ? !map.message ? -1 : Number(map.message) : NaN;

        if (messageId < 0)
            messageId = message.id + messageId;

        if (messageId >= room.archive.length || messageId < 0 || isNaN(messageId))
            return `${!isNaN(messageId) ? `Message ${messageId} does not exist. ` : ``}Please specify a message ID, a negative number (eg -3 = 3rd most recent message), or leave blank to quote the last message.`

        id = messageId;
    }

    return format(room.archive.getMessage(id));

}

function getRandomId(room: Room, tries = 1): number {
    const id = Math.floor(Math.random() * room.archive.length);
    const message = room.archive.getMessage(id);

    if (
        message.deleted ||
        message.text.startsWith("/") ||
        message.text.startsWith("hint") ||
        message.text.startsWith("guess") ||
        (message.tags && message.tags.find(t => t.text === "BOT"))
    ) {
        // limit to a max of 3 tries to find a valid message before giving up
        if (tries >= Math.min(room.archive.length, 3)) return id;

        return getRandomId(room, tries + 1);
    }

    return id;
}

function format(message: Message) {
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

function startGuess(room: Room): string {

    if (typeof guessing[room.data.id] !== "undefined")
        return "Please wait until the current quote is guessed before starting another."

    const id = getRandomId(room);
    const message = room.archive.getMessage(id);

    guessing[room.data.id] = {
        tries: 0,
        hints: 0,
        guessingId: id,
        editId: room.archive.length,
        answers: [
            message.author.name.toLowerCase(),
            message.author.name.split(" ")[0].toLowerCase(),
            message.author.name
        ]
    }

    return `Who said: "${message.text}"?\n` +
        `To guess: Start your message with 'guess' followed by the name of the person you want to guess (eg 'guess info').\n` +
        `You have two hints. To use one, say 'hint'.`

}

function check(message: Message, room: Room): boolean {
    if (!guessing[room.data.id]) return false;
    return message.text.startsWith("guess ") || message.text.startsWith("hint");
}

function filter(message: Message, room: Room): string | BotOutput {

    const data = guessing[room.data.id];

    if (message.text.startsWith("hint")) {
        if (data.hints >= 2) return "You've already used both hints.";

        data.hints += 1;
        const first = data.hints === 1;

        let out: string = "";

        const formatter = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/Chicago",
            dateStyle: "medium",
            timeStyle: "short"
        });

        const ids = new Array<number>(data.hints * 4 + 1)
            .fill(data.guessingId - data.hints * 2)
            .map((v, i) => v + i);

        const people = new Set<string>();

        for (const id of ids) {
            const message = room.archive.getMessage(id);
            if (!message) continue;

            people.add(message.author.name);
            const name = first ? "Someone" :
                `Person ${[...people].indexOf(message.author.name) + 1}`;

            out += `(${formatter.format(Date.parse(message.time as any as string))}) `;
            out += `${name} said: ${message.text.slice(0, 100).replace(/\n/g, " ")}\n`;
        }

        return out;
    }

    let guess = message.text.split("guess ")[1].trim().toLowerCase();

    if (guess === "me")
        guess = message.author.name.toLowerCase();

    data.tries += 1;

    if (!(guess.includes(data.answers[1]) && data.answers[0].includes(guess))) {

        if (data.tries >= 3) {
            { // edit old message to clean it up
                const editMessage = room.archive.getMessage(data.editId);
                if (editMessage.author.name === "Quote Bot")
                    room.edit(data.editId, editMessage.text.split("\n")[0]);
            }

            delete guessing[room.data.id];

            return {
                text: `Incorrect. The message was sent by ${data.answers[2]}`,
                replyTo: room.archive.getMessage(data.guessingId)
            }

        }

        const guesses = 3 - data.tries;
        const hints = 2 - data.hints;

        return `Incorrect. ${guesses} guess${guesses === 1 ? "" : "es"} and ${hints} hint${hints === 1 ? "" : "s"} remaining.`
    }

    { // edit old message to clean it up
        const editMessage = room.archive.getMessage(data.editId);
        if (editMessage.author.name === "Quote Bot")
            room.edit(data.editId, editMessage.text.split("\n")[0]);
    }

    delete guessing[room.data.id];

    const winMessages = [
        "guessed correctly",
        "got it right",
        "answered correctly",
    ]

    const winMessage = winMessages[Math.floor(Math.random() * winMessages.length)];
    const hintMessage = [
        "",
        ", with one hint",
        ", with two hints"
    ][data.hints];

    return {
        text:
            `${data.tries + data.hints === 1 ? "Great" : "Good"} job! ${message.author.name} ` +
            `${winMessage} ${["first", "second", "third"][data.tries - 1]} try${hintMessage}!`,
        replyTo: room.archive.getMessage(data.guessingId)
    };

}

export default toBot({ data, command, filter, check });