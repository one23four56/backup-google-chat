import { BotTemplate } from '../bots';
import Message from '../../lib/msg';
import * as fs from 'fs';
import { Archive } from '../archive';

export default class ArchiveBot implements BotTemplate {
    name: string;
    image: string;
    desc: string;
    commands: string[];

    constructor() {
        this.name = 'Archive Bot';
        this.image = 'https://admissions.ucr.edu/sites/g/files/rcwecm2006/files/styles/form_preview/public/2019-10/Archive-icon.png?itok=3VTR_lYi';
        this.desc = 'A bot that tells the length of the archive';
        this.commands = ['stats'];
    }

    runCommand(command: string, message: Message): string {
        const size: number = fs.statSync('messages.json').size;
        const myMessages = Archive.getArchive()
            .filter(checkMessage => checkMessage.author.name === message.author.name || checkMessage.sentBy === message.author.name).length;

        return `The archive currently has ${Archive.getArchive().length} messages, and it takes up ${(size / 1000000).toFixed(2)} MB. `
            + `You (${message.author.name}) have sent ${myMessages} messages, which is ${(myMessages / Archive.getArchive().length * 100).toFixed(2)}% of the archive.`
    }

    check(message: Message): boolean {
        if (message.id && (message.id + 1) % 100 === 0) return true;
        return false;
    }

    runFilter(message: Message): string {
        return `Congratulations! ${message.author.name} sent message #${message.id + 1}! 🎉🎉🎉`;
    }
}