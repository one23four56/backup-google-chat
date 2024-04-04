import Room, { createRoom, RoomFormat, rooms, roomsReference } from './rooms'
import { OnlineUserData, UserData } from '../lib/authdata';
import { blockList, Users } from './users';
import { server, sessions } from '..';

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
    statsPageAllowed: false,
    mediaPageAllowed: false,
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

    const session1 = sessions.getByUserID(user1.id);
    const session2 = sessions.getByUserID(user2.id);

    for (const session of [session1, session2]) {
        if (!session) continue;

        dm.addSession(session)
        session.socket.emit("added to dm", dm.getDataFor(session.userData.id))
    }

    if (session1)
        session1.socket.emit("userData updated", Users.getOnline(user2.id))

    if (session2)
        session2.socket.emit("userData updated", Users.getOnline(user1.id))

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
    declare data: DMFormat;

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

export function getFriendsOf(userId: string): string[] {
    const out = new Set<string>(); // set to avoid possible duplicates 
    // there are none in prod but on my dev build i accidentally made a duplicate dm
    // and it messed everything up so i had to add this lol
    for (const id in rooms.ref) {
        const dm = rooms.ref[id]

        if ((dm as DMFormat).type !== "DM")
            continue;

        if (!dm.members.includes(userId)) continue;
        // so this is embarrassing but when i originally wrote this function i was very
        // tired (just had gotten back from spain) and totally forgot to include the above
        // line that actually checks if the user is in the dm, so the friends list was
        // just a list of every single DM (lol). the worst part is that i somehow didn't
        // notice this until 2 days later when i saw that DM invites stopped working
        // moral of the story: make sure you go to sleep, and i might be stupid

        out.add(dm.members.find(m => m !== userId));
    }

    return [...out];
}

export function isInDMWith(userId: string, withUserId: string) {
    return getFriendsOf(userId).includes(withUserId);
}