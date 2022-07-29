import { BotOutput, BotTemplate, BotUtilities } from '../bots';
import Message, { Poll } from '../../lib/msg';
import { io } from '../..';
import Room from '../rooms';

export let activePolls: {
    [key: string]: Poll[]
} = {};

export default class Polly implements BotTemplate {
    name: string;
    image: string;
    desc: string;
    commands?: { command: string; args: string[]; }[];

    constructor() {
        this.name = "Polly";
        this.image = "../public/polly.png";
        // image may or may not be copyright infringement
        // i don't really care, if polly tries to sue i'll just change it
        // i mean, the backup chat doesn't even make money, so why would they care?
        this.desc = "Creates custom polls";
        this.commands = [{
            command: "poll",
            args: [
                "'question'",
                "'option 1'",
                "'option 2'",
                "'option 3'?",
            ]
        }, { 
            command: "polly",
            args: [
                "'question'",
                "'option 1'",
                "'option 2'",
                "'option 3'?",
            ]
        }, {
            command: "polls",
            args: []
        }];
    }

    runCommand(command: string, args: string[], message: Message, room: Room): BotOutput | string {
        if (command === 'poll' || command === 'polly') {
            const parsedArgs = BotUtilities.generateArgMap(args, this.commands[0].args);

            if (typeof parsedArgs === 'boolean') return 'Invalid arguments';

            if (parsedArgs.option1 === parsedArgs.option2
                || parsedArgs.option1 === parsedArgs.option3
                || parsedArgs.option2 === parsedArgs.option3) 
                return 'Arguments must be different from each other';

            if (activePolls[room.data.id] && activePolls[room.data.id].filter(p => p.type === 'poll' && p.creator === message.author.name).length > 0)
                return 'You already have an active poll, please wait until it ends';

            if (parsedArgs.question.charAt(parsedArgs.question.length-1) !== '?')
                parsedArgs.question += '?';

            //* Actual poll creating starts here, all the stuff above is just validation

            const poll: Poll = {
                type: 'poll',
                creator: message.author.name,
                finished: false,
                question: parsedArgs.question,
                options: [
                    {
                        option: parsedArgs.option1,
                        votes: 0,
                        voters: []
                    },
                    {
                        option: parsedArgs.option2,
                        votes: 0,
                        voters: []
                    }
                ]
            }


            if (parsedArgs.option3) {
                poll.options.push({
                    option: parsedArgs.option3,
                    votes: 0,
                    voters: []
                })
            }

            this.runTrigger(room, poll, message.id+1);

            return {
                text: `${parsedArgs.question} (Poll by ${message.author.name}; ends in 1 minute)`,
                poll: poll
            }

        } else if (command === 'polls') {
            let partialMessage = "";

            if (activePolls[room.data.id].length === 0)
                partialMessage += "There are no active polls";
            else if (activePolls[room.data.id].length === 1)
                partialMessage += "There is 1 active poll:";
            else
                partialMessage += `There are ${activePolls.length} active polls:`;

            for (const poll of activePolls[room.data.id]) {
                if (poll.type !== 'poll') continue;
                partialMessage += `\n${poll.question} (Poll by ${poll.creator})`;
            }

            return partialMessage;
        }
    }

    /**
     * Runs a poll
     * @param poll Poll object
     * @param id ID of message containing poll
     * @returns A promise that resolves when the poll is finished
     */
    runTrigger(room: Room, poll: Poll, id: number): Promise<string> {
        // the poll creating is done here to save space in runCommand
        if (poll.type !== 'poll') return;

        poll.id = id;

        if (!activePolls[room.data.id])
            activePolls[room.data.id] = [];

        activePolls[room.data.id].push(poll);

        // vote listeners are now done in handlers/socket/poll.ts

        return new Promise<string>(resolve => {
            setTimeout(() => {
                const poll = activePolls[room.data.id].find((p: any) => p.id === id);
                if (!poll) return;
                if (poll.type !== 'poll') return;

                poll.finished = true;

                const winner = poll.options.reduce((a, b) => a.votes > b.votes ? a : b);

                const result: Poll = {
                    type: 'result',
                    question: poll.question,
                    winner: winner.option,
                    originId: id
                }

                room.archive.updatePoll(id, poll);

                io.emit('user voted in poll', room.data.id, room.archive.getMessage(id));

                activePolls[room.data.id] = activePolls[room.data.id].filter((p: any) => p.id !== id);

                room.bots.genBotMessage(this.name, this.image, {
                    text: `(Results) ${winner.option} has won with ${winner.votes} vote${winner.votes === 1 ? '' : 's'}! 🎉🎉🎉`,
                    poll: result,
                    replyTo: room.archive.getMessage(id)
                })

                resolve(winner.option)
            }, 60 * 1000)
        })
    }
}