import { BotTemplate } from '../bots';
import Message from '../../lib/msg';

export default class HelperBot implements BotTemplate {
    name: string;
    image: string;
    desc: string;
    commands: {
        command: string,
        args: string[],
    }[];

    constructor() {
        this.name = 'Helper Bot';
        this.image = '../public/favicon.png';
        this.desc = 'A bot that helps you with some things';
        this.commands = [{ command: 'help', args: []}];
    }

    runCommand(command: string, args: string[], message: Message): string {
        return `Hello ${message.author.name}, I am the Helper Bot. I have one command which is this one. You can find a list of bots by clicking on your profile picture (top right) and then clicking 'Bot List'.`
    }
}