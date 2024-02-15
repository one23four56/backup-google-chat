import { ClientToServerEvents } from "../../lib/socket";
import { Session } from "../../modules/session";
import { Users, blockList } from "../../modules/users";
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
            return session.socket.emit("alert", "Cannot Start Chat", `You have already sent an invite to ${user.name}`)

        // check dms
        if (isInDMWith(user.id, session.userData.id))
            return session.socket.emit("alert", "Cannot Start Chat", `You are already have a chat with ${user.name}!`)

        // check blocks
        if (blockList(user.id).mutualBlockExists(session.userData.id))
            return session.socket.emit("alert", "Cannot Start Chat", `${user.name} blocked you`)

        // send invite
        Invites.createDMInvite(user, session.userData)

        session.socket.emit("alert", "Invite Sent", `An invite has been sent to ${user.name}. Your chat with them will begin if they accept.`)

    }

    return handler;
}