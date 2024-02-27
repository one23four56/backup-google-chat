import { BotTemplate } from '../bots';
import Message from '../../lib/msg';
import Room from '../rooms';
import { Users } from '../users';

export default class RandomBot implements BotTemplate {
    name: string;
    image: string;
    desc: string;
    commands: BotTemplate["commands"];

    constructor() {
        this.name = 'Random Bot';
        this.image = '../public/random.png';
        this.desc = 'A bot that picks random numbers, operates a magic 8 ball, and flips a coin.';
        this.commands = [{
            command: 'roll',
            description: "Picks a random number.",
            args: [['[number]', "Maximum number that can be picked."]],
        }, {
            command: '8ball',
            description: "Rolls a magic 8-ball.",
            args: []
        }, {
            command: 'flip',
            description: "Flips a coin.",
            args: []
        }, {
            command: 'picksomeone',
            description: "Picks a random member of this room.",
            args: []
        }];
    }

    runCommand(command: string, args: string[], message: Message, room: Room): string {
        switch (command) {
            case 'roll':
                if (args.length === 0 || !args[0] || args[0].length === 0 || isNaN(Number(args[0]))) return 'You need to specify a number';
                const roll = Math.floor(Math.random() * Number(args[0])) + 1;
                return roll.toString();
            case '8ball':
                const ball = Math.floor(Math.random() * 20);
                let answer: string;
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
                return "🎱: " + answer;
            case 'flip':
                return Math.random() >= 0.5 ? 'Heads' : 'Tails'
            case 'picksomeone':
                return Users.get(room.data.members[Math.floor(Math.random() * room.data.members.length)]).name;
        }
    }
}