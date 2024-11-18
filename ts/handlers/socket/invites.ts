import { NotificationType, TextNotification } from "../../lib/notifications";
import { ClientToServerEvents } from "../../lib/socket";
import { acceptDMInvite, acceptRoomInvite, declineRoomInvite, deleteInvite, DMInviteFormat, getInvite, RoomInviteFormat } from "../../modules/invites";
import { notifications } from "../../modules/notifications";
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
            acceptDMInvite(invite);
            notifications.send<TextNotification>([invite.from.id], {
                type: NotificationType.text,
                icon: {
                    type: "image",
                    content: invite.to.img
                },
                title: `Chat started with ${invite.to.name}`,
                data: {
                    title: "Chat Started",
                    content: `${invite.to.name} accepted your invite. Your chat with them has been started.`
                }
            })
            return;
        }
    }

    return handler;
}