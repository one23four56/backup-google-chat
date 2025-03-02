import { UserData } from "../lib/authdata";
import get from "./data";
import * as fs from 'fs'
import * as crypto from 'crypto'
import { sessions } from "..";
import { RoomFormat, checkRoom } from "./rooms";
import { Users, blockList } from "./users";
import { createDM } from "./dms";

if (!fs.existsSync('data'))
    fs.mkdirSync('data')

const invites = get<BasicInviteFormat[]>(`data/invites.json`, true, "[]")
invites.blockSleep(1);

export interface BasicInviteFormat {
    from: UserData;
    to: UserData;
    id: string;
    message: string;
    longMessage?: string;
    time?: number;
}

export interface RoomInviteFormat extends BasicInviteFormat {
    type: "room";
    room: string;
}

export interface DMInviteFormat extends BasicInviteFormat {
    type: "dm";
}

export function createRoomInvite(to: UserData, from: UserData, room: RoomFormat, time?: number) {

    const blocklist = blockList(to.id), blockedMembers = [...room.members, ...room.invites]
        .filter(m => blocklist.blockedUsers.includes(m))
        .map(m => Users.get(m).name);


    const invite: RoomInviteFormat = {
        from, to,
        room: room.id,
        id: crypto.randomBytes(16).toString('hex'),
        type: "room",
        message: `${from.name} invited you to ${room.name}`,
        longMessage:
            `${from.name} wants you to join ${room.name}. The room will be notified if you accept or decline.\n` +
            `${room.name} is owned by ${Users.get(room.owner)?.name ?? "nobody"} and has ${room.members.length} member${room.members.length === 1 ? "" : "s"}.\n` +
            (blockedMembers.length === 0 ? "" : blockedMembers.length === 1 ?
                `${blockedMembers[0]}, who you blocked, is a member of this room.\n` :
                `${blockedMembers.length} people who you blocked (${blockedMembers.join(", ")}) are members of this room.\n`) +
            `${room.name} describes itself as:\n${room.description}`,
        time: time ?? Date.now()
    }

    invites.ref.push(invite)

    const session = sessions.getByUserID(to.id)

    if (session) {
        session.socket.emit("invites updated", getInvitesTo(to.id))
    }

    console.log(`invites: ${from.name} sent invite (type: room) to ${to.name}`)

}

export function getInvite<type extends BasicInviteFormat>(id: string, to: string): type | false {

    const invite = invites.ref.find(i => i.id === id)

    if (!invite)
        return false;

    if (invite.to.id !== to)
        return false;

    return invite as type;

}

export function getInvitesTo(userId: string): BasicInviteFormat[] {
    return invites.ref.filter(invite => invite.to.id === userId)
}

export function getInvitesFrom(userId: string): BasicInviteFormat[] {
    return invites.ref.filter(invite => invite.from.id === userId)
}

export function isInvitedToRoom(userId: string, roomId: string): boolean {
    const invites = getInvitesTo(userId);

    if (invites.find(i => (i as any).room === roomId))
        return true;

    return false;
}

export function acceptRoomInvite(invite: RoomInviteFormat) {

    deleteInvite(invite) // deletes the invite from storage

    // check that room exists and sender is in room

    const room = checkRoom(invite.room, invite.from.id, false)
    if (!room)
        return;

    // add user to Room

    room.addUser(invite.to.id)

}

export function declineRoomInvite(invite: RoomInviteFormat) {
    deleteInvite(invite)

    const room = checkRoom(invite.room, invite.from.id, false)
    if (!room)
        return;

    // remove user from room invites

    room.removeUser(invite.to.id)
    room.infoMessage(`${invite.to.name} declined the invitation to the room`)
}

export function deleteInvite(invite: BasicInviteFormat) {

    invites.ref = invites.ref.filter(i => i.id !== invite.id)

    const session = sessions.getByUserID(invite.to.id)
    if (session) {
        session.socket.emit("invites updated", getInvitesTo(invite.to.id))
    }

}

export function createDMInvite(to: UserData, from: UserData) {

    const invite: DMInviteFormat = {
        from, to,
        id: crypto.randomBytes(16).toString('hex'),
        type: "dm",
        message: `${from.name} wants to start a chat with you`,
        longMessage: `${from.name} wants to start a chat with you. They won't be notified if you decline.`,
        time: Date.now()
    }

    invites.ref.push(invite)

    const session = sessions.getByUserID(to.id)

    if (session) {
        session.socket.emit("invites updated", getInvitesTo(to.id))
    }

    console.log(`invites: ${from.name} sent invite (type: dm) to ${to.name}`)

}

export function acceptDMInvite(invite: DMInviteFormat) {

    deleteInvite(invite);

    const dm = createDM(invite.to, invite.from)

}

export function isUserInvitedToDM(userId: string, withUser: string) {

    if (getInvitesTo(userId).find(i => (i as any).type === "dm" && i.from.id === withUser))
        return true;

    if (getInvitesFrom(userId).find(i => (i as any).type === "dm" && i.to.id === withUser))
        return true;

    return false;

}

interface EmailInvite {
    to: string;
    from: string;
    room: string;
    time: number;
}

const emailInvites = get<Record<string, EmailInvite[]>>('data/email-invites.json');

/**
 * create an email invite
 * @param to email address
 * @param from user id
 * @param room room id
 */
export function createEmailInvite(to: string, from: string, room: string) {
    to = to.toLowerCase().replace(/\./g, ""); // normalize
    const invite: EmailInvite = {
        to, from, room,
        time: Date.now()
    };

    if (!emailInvites.ref[to])
        emailInvites.ref[to] = [];

    if (emailInvites.ref[to].find(i => i.room === room))
        return;

    emailInvites.ref[to].push(invite);
    console.log(`invites: ${from} invited ${to} to ${room} via email`);
};

export function cancelEmailInvite(email: string, room: string) {
    email = email.toLowerCase().replace(/\./g, ""); // normalize
    if (!emailInvites.ref[email])
        return;

    emailInvites.ref[email] = emailInvites.ref[email].filter(e => e.room !== room);

    console.log(`invites: removed invite to ${room} for ${email}`);
}

function upgradeEmailInvite(invite: EmailInvite, toId: string) {
    const from = Users.get(invite.from);
    if (!from) return;

    const to = Users.get(toId);
    if (!to) return;

    if (to.email.toLowerCase().replace(/\./g, "") !== invite.to)
        return;

    const room = checkRoom(invite.room, from.id, false);
    if (!room) return;

    createRoomInvite(to, from, this.data, invite.time);

    room.upgradeEmailInvite(to);

    console.log(`invites: upgraded email invite for ${to.email} (${to.id})`)
}

export function upgradeEmailInvites(email: string, id: string) {
    email = email.toLowerCase().replace(/\./g, ""); // normalize

    if (!emailInvites.ref[email])
        return;

    for (const invite of emailInvites.ref[email])
        upgradeEmailInvite(invite, id);
}