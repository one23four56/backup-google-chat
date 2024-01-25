import Room, { createRoom, RoomFormat, rooms, roomsReference } from './rooms'
import { OnlineUserData, UserData } from '../lib/authdata';
import { blockList, Users } from './users';
import { sessions } from '..';

const dmReference: Record<string, DM> = {}

export interface DMFormat extends RoomFormat {
    type: "DM";
    userData?: OnlineUserData; 
}

const defaultDMOptions: RoomFormat["options"] = {
    allowedBots: [
        "ArchiveBot",
        "RandomBot",
    ],
    archiveViewerAllowed: false, 
    webhooksAllowed: false, 
    privateWebhooksAllowed: false,
    autoMod: {
        strictness: 3,
        warnings: 3,
        allowBlocking: true,
        allowMutes: false,
        blockDuplicates: true,
        blockSlowSpam: true,
        canDeleteWebhooks: true,
        muteDuration: 2
    },
    permissions: { // all of these gotta be owner to block anyone from inviting anyone
        invitePeople: "owner",
        addBots: "owner",
        removePeople: "owner"
    },
    autoDelete: true,
    maxFileSize: 5,
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
            session.socket.emit("userData updated", Users.getOnline(user2.id))
    }

    {
        const session = sessions.getByUserID(user2.id)
        if (session)
            session.socket.emit("userData updated", Users.getOnline(user1.id))
    }

    return dm

}

export function isDMBlocked(dm: Room | DM) {
    if (!isDM(dm) || dm.data.members.length !== 2)
        return false;

    return blockList(dm.data.members[0]).mutualBlockExists(dm.data.members[1]);
}

function isDM(dm: Room | DM): dm is DM {
    if ("type" in dm.data && dm.data.type === "DM")
        return true;

    return false;
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

    getUserFor(userId: string): false | OnlineUserData {
        if (!this.data.members.includes(userId))
            return false;

        const otherMember = this.data.members.filter(id => id !== userId)

        if (otherMember.length !== 1)
            return false;

        return Users.getOnline(otherMember[0], this.sessions)
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