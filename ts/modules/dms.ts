import Room, { createRoom, getUsersIdThatShareRoomsWith, RoomFormat, rooms, roomsReference } from './rooms'
import * as json from './json'
import { UserData } from '../lib/authdata';
import { Users } from './users';
import { Statuses } from '../lib/users';
import { sessions } from '..';

const dmReference: {
    [key: string]: DM
} = {}

export interface DMFormat extends RoomFormat {
    type: "DM";
    userData?: UserData; 
}

const defaultDMOptions: RoomFormat["options"] = {
    allowedBots: [
        "ArchiveBot",
        "RandomBot",
        "TimeBot",
    ],
    archiveViewerAllowed: false, 
    webhooksAllowed: false, 
    privateWebhooksAllowed: false,
    autoMod: {
        strictness: 3,
        warnings: 3,
    },
    permissions: { // all of these gotta be owner to block anyone from inviting anyone
        invitePeople: "owner",
        addBots: "owner"
    },
    autoDelete: true
}

export function createDM(user1: UserData, user2: UserData): DM {

    const room = createRoom({
        description: ``,
        emoji: '💬',
        members: [
            user1.id,
            user2.id
        ],
        name: `${user1.name} & ${user2.name}`,
        options: defaultDMOptions,
        owner: 'nobody'
    }, true) // set forced to bypass invites

    delete roomsReference[room.data.id]
    
    const dm = new DM(room.data.id)

    for (const session of [sessions.getByUserID(user1.id), sessions.getByUserID(user2.id)]) {
        if (!session) continue;

        dm.addSession(session)
        session.socket.emit("added to dm", dm.getDataFor(session.userData.id))
    }

    {
        const session = sessions.getByUserID(user1.id)
        if (session)
            session.socket.emit("userData updated", Users.get(user2.id))
    }

    {
        const session = sessions.getByUserID(user2.id)
        if (session)
            session.socket.emit("userData updated", Users.get(user1.id))
    }

    return dm

}

export default class DM extends Room {
    data: DMFormat = this.data;

    constructor(id: string) {
        super(id);

        if (dmReference[id])
            return dmReference[id]

        if (this.data.members.length !== 2)
            throw new Error(`dms: attempt to initialize room "${this.data.name}" as a DM, however the room does not meet the DM format requirements `)

        // set data to the dm data just in case it somehow changed

        this.data.emoji = "💬"
        this.data.type = "DM"
        this.data.options = defaultDMOptions;
        this.data.owner = "nobody"

        dmReference[id] = this;

        this.log(`Initialized as DM`)
    }

    protected log(text: string) {
        console.log(`${this.data.id} (DM ${this.data.name}): ${text}`)
    }

    getUserFor(userId: string) {
        if (!this.data.members.includes(userId))
            return false;

        const otherMember = this.data.members.filter(id => id !== userId)

        if (otherMember.length !== 1)
            return false;

        return Users.get(otherMember[0])
    }

    getDataFor(userId: string): Required<DMFormat> {

        const user = this.getUserFor(userId)
        if (!user) return;

        const data: DMFormat = structuredClone(this.data)

        data.userData = user;

        return data as Required<DMFormat>;
    }

    addUser(id: string): void {
        this.log(`Attempt to add user ${id} to DM`)
    }

    removeUser(id: string): void {
        this.log(`Attempt to remove user ${id} from DM`)
    }

    updateOptions(_options: RoomFormat["options"]): void {
        this.log(`Attempt to change options of a DM`)
    }
}

export function getDMsByUserId(userId: string) {
    
    const dmIds: string[] = []

    for (const dmId in rooms.getDataReference()) {

        const dm = rooms.getDataReference()[dmId]

        if ((dm as DMFormat).type !== "DM")
            continue;

        if (dm.members.includes(userId))
            dmIds.push(dm.id)

    }

    return dmIds
        .map(id => new DM(id))

}

export function isInDMWith(userId: string, withUserId: string) {

    const dms = getDMsByUserId(userId)

    if (dms.find(dm => dm.data.members.includes(withUserId)))
        return true;

    return false;

}