import { BotTemplate } from '../bots';
import Message from '../../lib/msg';
import * as fs from 'fs';
import Room from '../rooms';

export default class ArchiveBot implements BotTemplate {
    name: string;
    image: string;
    desc: string;
    commands: {
        command: string,
        args: string[],
    }[];

    constructor() {
        this.name = 'Archive Bot';
        this.image = '../public/archive.png';
        this.desc = 'A bot that alerts you when important messages are sent, and tells stats about the archive';
        this.commands = [{ command: 'stats', args: ["'name'?"]}];
    }

    runCommand(_command: string, args: string[], message: Message, room: Room): string {
        let name;
        if (args.length === 0 || !args[0] || args[0].length === 0) name = message.author.name;
        else name = args[0];

        const myMessages = room.archive.data.getDataReference()
            .filter(checkMessage => checkMessage.author.name === name).length;

        if (myMessages === 0) return `${name} has not sent any messages.`;

        let output = ``;

        if (name !== args[0])
            output += `${room.data.name} currently has ${room.archive.length} messages, and takes up ${(room.archive.size / 1000000).toFixed(2)} MB. `

        output += `${name} has sent ${myMessages} messages, which is ${(myMessages / room.archive.length * 100).toFixed(2)}% of the archive.`

        return output
    }

    check(message: Message): boolean {
        if (message.id && (message.id + 1) % 100 === 0) return true;
        return false;
    }

    runFilter(message: Message): string {
        return `Congratulations! ${message.author.name} sent message #${message.id + 1}! 🎉🎉🎉`;
    }
}