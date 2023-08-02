import { UserData } from "../lib/authdata";
import get from "./data";
import * as fs from 'fs'
import * as crypto from 'crypto'
import { sessions } from "..";
import { checkRoom } from "./rooms";
import { createDM } from "./dms";

if (!fs.existsSync('data'))
    fs.mkdirSync('data')

const invites = get<BasicInviteFormat[]>(`data/invites.json`, true, "[]")

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

export function createRoomInvite(to: UserData, from: UserData, room: string, name: string) {

    const invite: RoomInviteFormat = {
        from, to, room,
        id: crypto.randomBytes(16).toString('hex'),
        type: "room",
        message: `${from.name} invited you to ${name}`,
        longMessage: `Hello ${to.name}! ${from.name} wants you to join ${name}. The room will be notified if you accept or decline.`,
        time: Date.now()
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
        longMessage: `Hi ${to.name}! ${from.name} wants to start a chat with you. They will not be notified if you decline.`,
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