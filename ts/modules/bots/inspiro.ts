import { BotTemplate } from '../bots';
import Message from '../../lib/msg';

// const messages: string[] = [
//     "This quote is fire 💯💯🔥🔥",
//     "So inspiring 🤩",
//     "Quote of the year right here 😁",
//     "Truuuuuuuuu 😋",
//     "🤑🤑🤑🤑🤑🤑",
//     "😍😍😍😍😍😍",
//     "I am a self-made millionaire 😎",
//     "Buy my new book 💲💲",
//     "Those 'millennials' need to see this! 🔥🔥🔥",
//     "Error: This quote is too based 😎😎",
//     "order corn",
//     "This quote is sus 😳😳😳",
//     "Please enjoy these quotes while we reprogram your brain 🤗🤖🤖",
//     "🇺🇦🇺🇦🇺🇦" // all the other message are from the og bot, this is the only new one
// ]

export default class InspiroBot implements BotTemplate {
    name: string;
    image: string;
    desc: string;
    commands: BotTemplate["commands"];

    constructor() {
        this.name = "InspiroBot"
        this.image = "../public/inspiro.png"
        this.desc = "Generates inspirational quotes on demand"
        this.commands = [{
            command: "inspiro",
            description: "Generates a random inspirational quote.",
            args: [],
        }]
    }

    async runCommand(command: string, args: string[], message: Message): Promise<any> {
        const res = await fetch("https://inspirobot.me/api?generate=true");
        const link = await res.text()

        const quotes = (await fetch("https://inspirobot.me/api?generateFlow=1").then(res => res.json())).data.filter(
            i => i.type === "quote" && i.text.length < 50
        )

        return {
            text: quotes.length > 0 ? quotes[0].text : "order corn",
            image: link
        }

    }
}