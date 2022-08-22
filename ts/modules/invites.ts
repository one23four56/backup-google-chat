import { UserData } from "../lib/authdata";
import get from "./data";
import * as fs from 'fs'
import * as crypto from 'crypto'
import { sessions } from "..";
import { checkRoom } from "./rooms";

if (!fs.existsSync('data'))
    fs.mkdirSync('data')

const invites = get<BasicInviteFormat[]>(`data/invites.json`, true, "[]")

export interface BasicInviteFormat {
    from: UserData;
    to: UserData;
    id: string;
    message: string;
}

export interface RoomInviteFormat extends BasicInviteFormat {
    type: "room";
    room: string;
}

export function createRoomInvite(to: UserData, from: UserData, room: string, name: string) {

    const invite: RoomInviteFormat = {
        from, to, room,
        id: crypto.randomBytes(16).toString('hex'),
        type: "room",
        message: `${from.name} is inviting you to join the room ${name}`
    }

    invites.ref.push(invite)

    const session = sessions.getByUserID(to.id)

    if (session) {
        session.socket.emit("invites updated", getInvitesTo(to.id))
    }


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

export function declineInvite(invite: RoomInviteFormat) {
    deleteInvite(invite)

    const room = checkRoom(invite.room, invite.from.id, false)
    if (!room)
        return;

    // remove user from room invites

    room.data.invites = room.data.invites.filter(i => i !== invite.from.id)
}

export function deleteInvite(invite: BasicInviteFormat) {

    invites.ref = invites.ref.filter(i => i.id !== invite.id)

    const session = sessions.getByUserID(invite.to.id)
    if (session) {
        session.socket.emit("invites updated", getInvitesTo(invite.to.id))
    }

}