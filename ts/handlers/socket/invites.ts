import { ClientToServerEvents } from "../../lib/socket";
import { acceptDMInvite, acceptRoomInvite, declineRoomInvite, deleteInvite, DMInviteFormat, getInvite, RoomInviteFormat } from "../../modules/invites";
import { Session } from "../../modules/session";

export function generateInviteActionHandler(session: Session) {
    const handler: ClientToServerEvents["invite action"] = (inviteId, action) => {

        // block malformed requests

        if (typeof inviteId !== "string" || typeof action !== "string" || (action !== "accept" && action !== "decline"))
            return;

        const invite = getInvite<RoomInviteFormat | DMInviteFormat>(inviteId, session.userData.id)

        if (!invite) return;

        if (action === "decline" ) {
            if (invite.type === "room")
                declineRoomInvite(invite)
            else 
                deleteInvite(invite)

            return;
        }

        // action has to be accept for it to get to here

        if (invite.type && invite.type === "room") {
            acceptRoomInvite(invite)
            return;
        }
        
        if (invite.type && invite.type === "dm") {
            acceptDMInvite(invite)
            return;
        }
    }

    return handler;
}