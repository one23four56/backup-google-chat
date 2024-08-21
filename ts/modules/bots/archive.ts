import { BotData, toBot } from '../bots';
import Message from '../../lib/msg';
import Room from '../rooms';

const data: BotData = {
    name: 'Archive Bot',
    image: '../public/archive.png',
    description: 'Sends messages whenever a milestone message is sent, and says stats about the archive.',
    commands: [
        {
            command: 'stats',
            description: "Gets the number of messages sent by a user, as well as the archive size and length.",
            args: [["'name'?", "Name of a user (eg. 'Info'). Defaults to your name."]],
        }
    ],
    by: {
        id: "system",
        name: "Backup Google Chat",
        image: "../public/favicon.png"
    }
}

// /stats
function command(_command: string, args: string[], message: Message, room: Room): string {
    let name;
    if (args.length === 0 || !args[0] || args[0].length === 0) name = message.author.name;
    else name = args[0];

    const myMessages = room.archive
        .findMessages(checkMessage => checkMessage.author.name === name).length;

    if (myMessages === 0) return `${name} has not sent any messages.`;

    let output = ``;

    if (name !== args[0])
        output += `${room.data.name} currently has ${room.archive.length} messages, and takes up ${((room.archive.size + room.share.size) / 1000000).toFixed(2)} MB. `

    output += `${name} has sent ${myMessages} messages, which is ${(myMessages / room.archive.length * 100).toFixed(2)}% of the archive.`

    return output
}

function check(message: Message, room: Room): boolean {
    return (message.id + 1) % (10 ** Math.max(Math.floor(Math.log10(room.archive.length || 1)), 2)) === 0;
}

function filter(message: Message): string {
    return `Congratulations! ${message.author.name} sent message #${message.id + 1}! 🎉🎉🎉`;
}

export default toBot({
    data, command, check, filter
});