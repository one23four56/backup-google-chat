import { ClientToServerEvents } from "../../lib/socket";
import { acceptRoomInvite, declineInvite, getInvite, RoomInviteFormat } from "../../modules/invites";
import { Session } from "../../modules/session";

export function generateInviteActionHandler(session: Session) {
    const handler: ClientToServerEvents["invite action"] = (inviteId, action) => {

        // block malformed requests

        if (typeof inviteId !== "string" || typeof action !== "string" || (action !== "accept" && action !== "decline"))
            return;

        const invite = getInvite<RoomInviteFormat>(inviteId, session.userData.id)

        if (!invite) return;

        if (action === "decline") {
            declineInvite(invite)
            return;
        }

        // action has to be accept for it to get to here

        if (invite.type && invite.type === "room")
            acceptRoomInvite(invite)
    }

    return handler;
}