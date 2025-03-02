import Channel, { ChannelFormat, channels } from './channel';
import Room, { createRoom, roomsReference } from './rooms'
import { OnlineUserData, UserData } from '../lib/authdata';
import { blockList, Users } from './users';
import { sessions } from '..';
import { defaultDMOptions } from '../lib/options';
import Share from './mediashare';
import AutoMod from './autoMod';
import { MemberUserData } from '../lib/misc';

const dmReference: Record<string, DM> = {}

export interface DMFormat extends ChannelFormat {
    type: "DM";
    userData?: OnlineUserData;
}

export function createDM(user1: UserData, user2: UserData): DM {

    const room = createRoom({
        description: ``,
        emoji: '💬',
        members: new Set([
            user1.id,
            user2.id
        ]),
        name: `${user1.name} & ${user2.name}`,
        options: defaultDMOptions,
        owner: 'nobody',
        bots: new Set([
            "bot-sys-random-bot",
            "bot-sys-archive-bot"
        ])
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

export default class DM extends Channel {
    declare data: DMFormat;
    options = defaultDMOptions;
    name: string;

    share: Share;
    autoMod: AutoMod;

    constructor(id: string) {
        super(id);

        if (dmReference[id])
            return dmReference[id]

        if (this.data.members.length !== 2)
            throw new Error(`dms: attempt to initialize room "${this.data.id}" as a DM, however the room does not meet the DM format requirements `)

        this.name = this.data.members.map(m => Users.get(m).name).join(" & ");

        // set data to the dm data just in case it somehow changed
        this.data.type = "DM"

        this.share = new Share(id, {
            autoDelete: true,
            maxFileSize: 5e6,
            maxShareSize: 2.5e8,
            canUpload: this.data.members,
            canView: this.data.members,
            indexPage: true
        });

        this.autoMod = new AutoMod(this, this.options.autoMod);

        // legacy cleanup
        { 
            //@ts-expect-error
            delete this.data.name; 
            //@ts-expect-error
            delete this.data.emoji; 
            //@ts-expect-error
            delete this.data.rules; 
            //@ts-expect-error
            delete this.data.owner; 
            //@ts-expect-error
            delete this.data.options; 
            //@ts-expect-error
            delete this.data.description; 
            //@ts-expect-error
            delete this.data.bots; 
            //@ts-expect-error
            delete this.data.invites;
        }


        dmReference[id] = this;
        // this.log(`Initialized as DM`)
    }

    protected log(text: string) {
        console.log(`${this.data.id} (${this.name}): ${text}`)
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

    getMembers(): MemberUserData[] {
        return this.data.members.map(m => m)
            .map((id) => Users.get(id))
            .filter((m) => typeof m !== "undefined")
            .map((data) => ({
                ...data,
                type: "member"
            }) as MemberUserData);
    }

    isMember(id: string): boolean {
        return this.data.members.includes(id);
    }

    isMuted(_id: string): boolean {
        return blockList(this.data.members[0]).mutualBlockExists(this.data.members[1]);
    }

    getOnlineLists(): [OnlineUserData[], OnlineUserData[], OnlineUserData[]] {
        const onlineList = this.sessions.getOnlineList();

        const offlineList = this.data.members
            .filter(i => !onlineList.find(j => j.id === i))
            .map(i => Users.getOnline(i));

        return [onlineList, offlineList, []];
    }
}

export function getDMsByUserId(userId: string) {

    const dmIds: string[] = []

    for (const dmId in channels.ref) {

        const dm = channels.ref[dmId]

        if ((dm as DMFormat).type !== "DM")
            continue;

        if (dm.members.includes(userId))
            dmIds.push(dm.id)

    }

    return dmIds
        .map(id => new DM(id))

}

export function getFriendsOf(userId: string): string[] {
    const blocklist = blockList(userId);
    const out = new Set<string>(); // set to avoid possible duplicates 
    // there are none in prod but on my dev build i accidentally made a duplicate dm
    // and it messed everything up so i had to add this lol
    for (const id in channels.ref) {
        const dm = channels.ref[id]

        if ((dm as DMFormat).type !== "DM")
            continue;

        if (!dm.members.includes(userId)) continue;
        // so this is embarrassing but when i originally wrote this function i was very
        // tired (just had gotten back from spain) and totally forgot to include the above
        // line that actually checks if the user is in the dm, so the friends list was
        // just a list of every single DM (lol). the worst part is that i somehow didn't
        // notice this until 2 days later when i saw that DM invites stopped working
        // moral of the story: make sure you go to sleep, and i might be stupid

        const user = dm.members.find(m => m !== userId);

        if (blocklist.mutualBlockExists(user)) continue;

        out.add(user);
    }

    return [...out];
}

export function isInDMWith(userId: string, withUserId: string) {
    return getFriendsOf(userId).includes(withUserId);
}