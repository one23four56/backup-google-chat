import { io } from "../..";
import { ClientToServerEvents } from "../../lib/socket";
import { activePolls } from "../../modules/bots/polly";
import { checkRoom } from "../../modules/rooms";
import { Session } from "../../modules/session";

export function generateVoteInPollHandler(session: Session) {
    const handler: ClientToServerEvents["vote in poll"] = (roomId, pollId, vote) => {

        // block malformed requests 
        
        if (typeof vote !== "string" || typeof pollId !== "number" || typeof roomId !== "string") 
            return;

        // get room 

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id);
        if (!room) return;

        // get poll

        const poll = activePolls[room.data.id].find(poll => poll.type === "poll" && poll.id === pollId)

        if (
            !poll || 
            poll.type === "result" ||
            !poll.options.map(o => o.option).includes(vote) ||
            poll.finished
        ) return;

        const option = poll.options.find(o => o.option === vote);
        if (!option) return;

        for (const checkOption of poll.options) {
            if (checkOption.voters.includes(session.userData.id)) {
                checkOption.votes--;
                checkOption.voters = checkOption.voters.filter(id => id !== session.userData.id)

                if (option.option === checkOption.option) {
                    io.emit('user voted in poll', room.data.id, room.archive.getMessage(pollId));
                    return;
                }

            }
        }

        option.votes++;
        option.voters.push(session.userData.id);

        room.archive.updatePoll(pollId, poll)

        io.emit('user voted in poll', room.data.id, room.archive.getMessage(pollId));
    }

    return handler;
}