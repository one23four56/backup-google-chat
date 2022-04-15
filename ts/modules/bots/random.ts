import { BotTemplate } from '../bots';
import Message from '../../lib/msg';

export default class RandomBot implements BotTemplate {
    name: string;
    image: string;
    desc: string;
    commands: {
        command: string,
        args: string[],
    }[];

    constructor() {
        this.name = 'Random Bot';
        this.image = 'https://cdn.pixabay.com/photo/2014/04/03/00/37/die-308887_960_720.png';
        this.desc = 'A bot that can roll dice and give you a random answer';
        this.commands = [{
            command: 'roll6',
            args: [],
        }, {
            command: 'roll100',
            args: [],
        }, {
            command: '8ball',
            args: [],
        }];
    }

    runCommand(command: string, args: string[], message: Message): string {
        switch (command) {
            case 'roll6':
                const roll6 = Math.floor(Math.random() * 6) + 1;
                return `${message.author.name} rolled a die and got a ${roll6}!`;
            case 'roll100':
                const roll100 = Math.floor(Math.random() * 100) + 1;
                return `${message.author.name} rolled a 100-sided die and got a ${roll100}!`;
            case '8ball':
                const ball = Math.floor(Math.random() * 20);
                let answer;
                switch (ball) {
                    case 0: answer = 'It is certain'; break;
                    case 1: answer = 'It is decidedly so'; break;
                    case 2: answer = 'Without a doubt'; break;
                    case 3: answer = 'Yes definitely'; break;
                    case 4: answer = 'You may rely on it'; break;
                    case 5: answer = 'As I see it, yes'; break;
                    case 6: answer = 'Most likely'; break;
                    case 7: answer = 'Outlook good'; break;
                    case 8: answer = 'Yes'; break;
                    case 9: answer = 'Signs point to yes'; break;
                    case 10: answer = 'Reply hazy try again'; break;
                    case 11: answer = 'Ask again later'; break;
                    case 12: answer = 'Better not tell you now'; break;
                    case 13: answer = 'Cannot predict now'; break;
                    case 14: answer = 'Concentrate and ask again'; break;
                    case 15: answer = 'Don\'t count on it'; break;
                    case 16: answer = 'My reply is no'; break;
                    case 17: answer = 'My sources say no'; break;
                    case 18: answer = 'Outlook not so good'; break;
                    case 19: answer = 'Very doubtful'; break;
                }

                return `${message.author.name} asked the magic 8 ball a question and got: ${answer}`;
            }
    }
}