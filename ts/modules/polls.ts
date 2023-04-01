import { io } from '..';
import { UserData } from '../lib/authdata';
import Message, { Poll } from '../lib/msg';
import { PollData } from '../lib/socket';
import Room from './rooms';

const pollWatchers: Record<string, PollWatcher[]> = {};

export class PollWatcher {

    private timeout: ReturnType<typeof setTimeout>;
    poll: Poll;
    private room: Room;
    private endListeners: ((winner: string, votes: number, voters: string[]) => any)[] = [];

    constructor(poll: Poll, room: Room) {

        if (!poll.expires)
            return;

        console.log("poll watcher created (yay)")

        this.poll = poll;
        this.room = room;

        if (!pollWatchers[room.data.id])
            pollWatchers[room.data.id] = []

        pollWatchers[room.data.id].push(this)

        this.timeout = setTimeout(() => this.endPoll(), Math.max(poll.expires - Date.now(), 0));

    }

    /**
     * gets all the active polls in a specific room
     * @param room id of room to get active polls for
     * @returns all the active polls in that room
     */
    static getActivePolls(room: string): Poll[] {

        if (!pollWatchers[room])
            return [];

        return pollWatchers[room].map(w => w.poll)  
    }

    /**
     * Gets a poll watcher
     * @param roomId room that the poll is in
     * @param messageId the id of the message with the poll
     * @returns a poll watcher or undefined
     */
    static getPollWatcher(roomId: string, messageId: number): PollWatcher | undefined {
        
        if (!pollWatchers[roomId])
            return;

        return pollWatchers[roomId].find(i => i.poll.id === messageId);

    }

    private remove() {
        pollWatchers[this.room.data.id] = pollWatchers[this.room.data.id].filter(i => i.poll.id !== this.poll.id)
    }

    /**
     * Ends the poll early without announcing a winner  
     * **Note:** does not modify the poll object on the message that this is attached to
     */
    abort() {
        clearTimeout(this.timeout);
        this.remove();
    }

    private endPoll() {
        this.remove();

        this.poll.finished = true;
        // update poll on clients
        io.to(this.room.data.id)
            .emit("user voted in poll", this.room.data.id, this.poll)

        const winner = this.poll.options.reduce((a, b) => a.votes > b.votes ? a : b);

        for (const listener of this.endListeners)
            listener(winner.option, winner.votes, winner.voters)

        const message: Message = {
            text: `(Poll Results) ${winner.option} has won with ${winner.votes} vote${winner.votes === 1 ? '' : 's'}! 🎉🎉🎉`,
            author: {
                name: "Info",
                image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png",
                id: 'bot'
            },
            time: new Date(),
            tags: [{
                text: 'BOT',
                color: 'white',
                bgColor: 'black'
            }],
            id: this.room.archive.length,
            replyTo: this.room.archive.getMessage(this.poll.id),
            poll: {
                type: 'result',
                originId: this.poll.id,
                question: this.poll.question,
                winner: winner.option
            }
        }

        this.room.message(message)
    }

    /**
     * adds a listener for the poll ending
     * @param callback function that will be called when the poll ends
     */
    addPollEndListener(callback: (winner: string, votes: number, voters: string[]) => any) {
        this.endListeners.push(callback)
    }

}

export function createPoll(creator: string, messageId: number, data: PollData): Poll {

    return {
        creator, 
        finished: false,
        expires: data.expires,
        id: messageId,
        options: data.options.map(o => {return { option: o, voters: [], votes: 0 }}),
        question: data.question,
        type: 'poll'
    }

}