import { ClientToServerEvents } from "../../lib/socket";
import { Session } from "../../modules/session";
import { Users } from "../../modules/users";
import * as Invites from '../../modules/invites'
import { isInDMWith } from "../../modules/dms";

export function generateStartDMHandler(session: Session) {
    const handler: ClientToServerEvents["start dm"] = (userId) => {

        // block malformed requests 
        if (typeof userId !== "string") return;

        // check user
        const user = Users.get(userId)
        if (!user) return;

        // check invites
        if (Invites.isUserInvitedToDM(user.id, session.userData.id))
            return session.socket.emit("alert", "Cannot Start DM", `You have already sent a DM invite to ${user.name}`)

        // check dms
        if (isInDMWith(user.id, session.userData.id))
            return session.socket.emit("alert", "Cannot Start DM", `You are already in a DM with ${user.name}!`)

        // send invite
        Invites.createDMInvite(user, session.userData)

    }

    return handler;
}