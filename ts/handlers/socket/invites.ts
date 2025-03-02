import { sendEmail } from "../..";
import { NotificationType, TextNotification } from "../../lib/notifications";
import { ClientToServerEvents } from "../../lib/socket";
import { acceptDMInvite, acceptRoomInvite, declineRoomInvite, deleteInvite, DMInviteFormat, getInvite, RoomInviteFormat } from "../../modules/invites";
import { notifications } from "../../modules/notifications";
import { parse } from "../../modules/parser";
import { checkRoom } from "../../modules/rooms";
import { Session } from "../../modules/session";
import * as fs from 'fs';
import { Users } from "../../modules/users";

export function generateInviteActionHandler(session: Session) {
    const handler: ClientToServerEvents["invite action"] = (inviteId, action) => {

        // block malformed requests

        if (typeof inviteId !== "string" || typeof action !== "string" || (action !== "accept" && action !== "decline"))
            return;

        const invite = getInvite<RoomInviteFormat | DMInviteFormat>(inviteId, session.userData.id)

        if (!invite) return;

        if (action === "decline") {
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

export function emailInviteHandler(session: Session): ClientToServerEvents["invite by email"] {
    return async (email, roomId) => {

        if (typeof roomId !== "string" || typeof email !== "string")
            return

        email = email.toLowerCase();

        const name = parse.email(email);
        if (typeof name !== "string")
            return session.alert("Can't Invite User", "The email you provided is invalid.");

        const room = checkRoom(roomId, session.userData.id, false);
        if (!room) return;

        const hasPermission = await (async () => {
            const check = () => {
                if (!room.data.members.includes(session.userData.id))
                    return `You must be a member of the room.`;

                if (Users.isWhiteListed(email))
                    return `That account already exists. Send a regular invite instead.`;

                if (room.data.emailInvites && room.data.emailInvites
                    .map(e => e.replace(/\./g, "")).includes(email.replace(/\./g, ""))
                )
                    return `That email is already invited to ${room.data.name}`;

                return true;
            };

            if (check() !== true)
                return check();

            const permission = room.checkPermission("invitePeople", session.userData.id === room.data.owner);
            if (permission === "no") return false;

            if (permission === "poll") {
                const poll = await room.quickBooleanPoll(
                    `${session.userData.name} wants to invite ${email.split("@")[0]} (via email) to the room.`,
                    `Invite ${email.split("@")[0]}?`,
                    1000 * 60
                ).catch(r => r as string);
                if (typeof poll === "string")
                    return poll;
                if (!poll) return false;
            };

            return check();
        })();

        if (typeof hasPermission === "string")
            return session.alert("Can't Invite User", hasPermission);

        if (!hasPermission) return;

        const others = room.data.members.length - 1;

        const text = fs.readFileSync("pages/email/invite.html", "utf-8")
            .replace(/{invited}/g, name)
            .replace(/{name}/g, session.userData.name)
            .replace(/{email}/g, session.userData.email)
            .replace(/{emoji}/g, room.data.emoji)
            .replace(/{room}/g, room.data.name)
            .replace(/{count}/g, others <= 1 ? session.userData.name : `${session.userData.name} and ${others} others`)
            .replace(/{messages}/g, room.archive.length < 50 ? " " : `—who have already sent over ${room.archive.length} messages—`)
            .replace(/{time}/g, new Date().toLocaleString("en-US", {
                timeZone: "America/Chicago",
                timeStyle: "long",
                dateStyle: "medium",
            }));

        room.emailInvite(email, session.userData);

        await sendEmail({
            to: "25jason.mayer@wfbschools.com",
            bcc: process.env.INFO,
            subject: `${session.userData.name} invited you`,
            html: text
        });

        session.alert("Email Sent", `An invite has been sent to ${email}\n\nMake sure to tell them to check their inbox!`);
    }
}

export function removeEmailHandler(session: Session): ClientToServerEvents["remove email"] {
    return async (email, roomId) => {
        if (typeof roomId !== "string" || typeof email !== "string")
            return;

        const room = checkRoom(roomId, session.userData.id, false);
        if (!room) return;

        if (!room.data.emailInvites || !room.data.emailInvites.includes(email))
            return;

        const permission = room.checkPermission("removePeople", room.data.owner === session.userData.id);
        if (permission === "no") return;

        if (permission === "poll") {
            const poll = await room.quickBooleanPoll(
                `${session.userData.name} wants to remove ${email.split("@")[0]} from the room.`,
                `Remove ${email.split("@")[0]}?`
            ).catch(r => r as string);
            if (typeof poll === "string")
                return session.alert("Can't Start Poll", poll);
            if (!poll) return;
        }

        if (!room.data.emailInvites || !room.data.emailInvites.includes(email))
            return;

        room.removeEmail(email);
        room.infoMessage(`${session.userData.name} removed ${email.split("@")[0]} from the room`)
    }
}