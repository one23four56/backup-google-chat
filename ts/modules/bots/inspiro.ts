import { BotTemplate } from '../bots';
import Message from '../../lib/msg';

const messages: string[] = [
    "This quote is fire 💯💯🔥🔥",
    "So inspiring 🤩",
    "Quote of the year right here 😁",
    "Truuuuuuuuu 😋",
    "🤑🤑🤑🤑🤑🤑",
    "😍😍😍😍😍😍",
    "I am a self-made millionaire 😎",
    "Buy my new book 💲💲",
    "Those 'millennials' need to see this! 🔥🔥🔥",
    "Error: This quote is too based 😎😎",
    "order corn",
    "This quote is sus 😳😳😳",
    "Please enjoy these quotes while we reprogram your brain 🤗🤖🤖",
    "🇺🇦🇺🇦🇺🇦" // all the other message are from the og bot, this is the only new one
]

export default class InspiroBot implements BotTemplate {
    name: string;
    image: string;
    desc: string;
    commands: {
        command: string,
        args: string[],
    }[]

    constructor() {
        this.name = "InspiroBot"
        this.image = "../public/inspiro.png"
        this.desc = "Generates inspirational quotes on demand"
        this.commands = [{
            command: "inspiro",
            args: []
        }]
    }

    async runCommand(command: string, args: string[], message: Message): Promise<any> {
        const res = await fetch("http://inspirobot.me/api?generate=true")
        const link = await res.text()
        return {
            text: messages[Math.floor(Math.random() * messages.length)],
            image: link
        }
    }
}