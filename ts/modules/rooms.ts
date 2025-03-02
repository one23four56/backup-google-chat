import Channel, { ChannelFormat, channels as rooms } from './channel';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as json from './json';
import Message from '../lib/msg';
import { io, sessions } from '..';
import { OnlineUserData, UserData } from '../lib/authdata';
import Bots, { BotAnalytics, BotData, BotList, BotUtilities } from './bots';
import AutoMod from './autoMod';
import { Users } from './users';
import Share from './mediashare';
import { defaultOptions, RoomOptions } from '../lib/options';
import DM from './dms';
import { cancelEmailInvite, createEmailInvite, createRoomInvite, deleteInvite, getInvitesTo, RoomInviteFormat } from './invites';
import { MemberUserData } from '../lib/misc';
import { notifications } from './notifications';
import { NotificationType, TextNotification } from '../lib/notifications';

export interface RoomFormat extends ChannelFormat {
    name: string;
    emoji: string;
    owner: string;
    options: RoomOptions
    rules: string[];
    description: string;
    bots: string[];
    invites?: string[];
    kicks?: Record<string, number>;
    emailInvites?: string[];
    type: "room";
}

export const roomsReference: Record<string, Room> = {};

BotAnalytics.countRooms(); // has to be after rooms object is defined above

/**
 * @class Room
 * @classdesc Representation of a room on the server.
 */
export default class Room extends Channel {

    declare data: RoomFormat;
    bots: Bots;
    autoMod: AutoMod;
    share: Share;

    constructor(id: string) {
        super(id);

        if (roomsReference[id])
            return roomsReference[id];


        // automatically set room options to defaults if they are not set
        // this is required to make it so adding new options doesn't break old rooms
        (function recursiveAdd(object: Object, check: Object) {

            for (const optionName in check) {
                if (typeof object[optionName] === "undefined")
                    object[optionName] = check[optionName]

                if (typeof check[optionName] === "object" && !Array.isArray(check[optionName]))
                    recursiveAdd(object[optionName], check[optionName])
            }

        })(this.data.options, defaultOptions);


        // delete any extra options to keep compatibility
        (function recursiveRemove(object: Object, check: Object) {

            for (const optionName in object) {
                if (typeof check[optionName] === "undefined")
                    delete object[optionName];

                if (typeof check[optionName] === "object" && !Array.isArray(check[optionName]))
                    recursiveRemove(object[optionName], check[optionName])
            }

        })(this.data.options, defaultOptions);

        this.autoMod = new AutoMod(this, this.data.options.autoMod)

        // convert bots to new format
        if (!this.data.bots) {
            this.data.bots = [];
            this.data.options.allowedBots.forEach(
                b => this.data.bots.push(BotUtilities.convertLegacyId(b))
            );
            this.data.bots = this.data.bots.filter(b => typeof b === "string");
        };

        this.bots = new Bots(this, () => {
            // emit bot data when a bot is updated
            io.to(this.data.id).emit("bot data", this.data.id, this.bots.botData);
        });
        this.bots.add(this.data.bots);

        this.share = new Share(this.data.id, {
            autoDelete: this.data.options.autoDelete,
            maxFileSize: this.data.options.maxFileSize * 1e6,
            maxShareSize: 5e8,
            canUpload: this.data.members,
            canView: this.data.members,
            indexPage: this.data.options.mediaPageAllowed
        });

        // load kicks
        if (this.data.kicks)
            for (const [userId, endTime] of Object.entries(this.data.kicks))
                this.addKickCountdown(userId, endTime);

        this.data.type = "room";
        roomsReference[id] = this;

        // this.log(`Initialized as room`)

    }

    get options() {
        return this.data.options;
    }

    /**
     * Logs text to console
     * @param text Text to log
     */
    protected log(text: string) {
        console.log(`${this.data.id} ("${this.data.name}"): ${text}`)
    }

    addUser(id: string, customMessage?: string) {
        this.data.members.push(id)

        this.share.options.canUpload = this.data.members;
        this.share.options.canView = this.data.members;

        if (this.data.invites) this.data.invites = this.data.invites.filter(i => i !== id)

        this.log(`User ${id} added to room`)

        this.infoMessage(`${Users.get(id).name} ${customMessage ?? "joined the room"}`)

        this.readMessage(Users.get(id), this.archive.mostRecentMessageId);

        const session = sessions.getByUserID(id)

        if (session) {
            this.addSession(session)
            session.socket.emit("added to room", this.data)
        }

        io.to(this.data.id).emit("member data", this.data.id, this.getMembers())
        this.broadcastOnlineListToRoom();
    }

    removeUser(id: string) {
        this.data.members = this.data.members.filter(userId => userId !== id)

        this.share.options.canUpload = this.data.members;
        this.share.options.canView = this.data.members;

        if (this.data.invites)
            this.data.invites = this.data.invites.filter(userId => userId !== id)

        getInvitesTo(id)
            .filter(i => (i as RoomInviteFormat).type === "room" && (i as RoomInviteFormat).room === this.data.id)
            .forEach(i => deleteInvite(i))

        this.log(`User ${id} removed from room`)

        const session = this.sessions.getByUserID(id)

        if (session) {
            this.removeSession(session)
            session.socket.emit("removed from room", this.data.id)
        }

        notifications.remove([id], `${this.data.id}-kick`, true);

        delete this.readData.ref[id];
        io.to(this.data.id).emit("bulk message updates", this.data.id, this.archive
            .resetReadIconsFor(id)
            .map(i => this.archive.getMessage(i))
        );

        if (this.data.members.length === 1 && this.data.members[0] !== this.data.owner) {
            // if only one user remains, make them the owner
            const member = this.data.members[0];
            this.setOwner(member);
            this.infoMessage(`${Users.get(member)?.name} is now the owner of the room`);
            notifications.send<TextNotification>([member], {
                type: NotificationType.text,
                title: `You are now the owner of ${this.data.name}`,
                icon: {
                    type: "icon",
                    content: "fa-solid fa-crown"
                },
                data: {
                    title: `You are now owner of ${this.data.name}`,
                    content: `Because you became the sole member of ${this.data.name}, you were automatically made the owner to prevent the room from becoming abandoned.\nIf you do not wish to be the owner, you can invite someone else and renounce/transfer ownership or delete the room.`
                }
            })
        }

        io.to(this.data.id).emit("member data", this.data.id, this.getMembers());
        this.broadcastOnlineListToRoom();
    }

    isMember(id: string) {
        if (!this.data.invites) this.data.invites = [];
        return [...this.data.members, ...this.data.invites].includes(id);
    }

    /**
     * Gets room members as a UserData array
     * @returns Members as a UserData array
     */
    getMembers(): MemberUserData[] {

        if (!this.data.invites) this.data.invites = []

        // below:
        // step 1: get members/invited, mark members true and invited false
        // step 2: get userData of everyone in list
        // step 3: remove any w/ undefined userData (it can happen lol)
        // step 4: reformat into MemberUserData using previous t/f as reference
        return [
            ...this.data.members.map(m => [m, true]),
            ...this.data.invites.map(m => [m, false])
        ].map(([id, member]: [string, boolean]) => [
            Users.get(id), member
        ]).filter(([m]) => typeof m !== "undefined").map(
            ([data, member]: [UserData, boolean]) => ({
                ...data,
                type: member ? "member" : "invited",
                mute: this.muteEndTime(data.id),
                kick: this.kickEndTime(data.id)
            }) as MemberUserData
        );
    }

    /**
     * Shorthand function for sending a message as the info bot
     * @param text Message text
     */
    infoMessage(text: string) {
        const message: Message = {
            text: text,
            author: {
                name: "Info",
                image: "/public/info.svg",
                id: 'bot'
            },
            time: new Date(new Date().toUTCString()),
            tags: [{
                text: ["BOT", "SYSTEM", undefined][this.options.infoTag],
                color: 'white',
                bgColor: ['black', 'black', 'var(--main-text-color)'][this.options.infoTag],
                icon: 'fa-solid fa-gear'
            }],
            id: this.archive.length,
        }

        this.message(message)

        return message;
    }

    /**
     * Gets the room online lists
     * @returns `[onlineList, offlineList, invitedList]`
     */
    getOnlineLists(): [OnlineUserData[], OnlineUserData[], OnlineUserData[]] {
        const onlineList = this.sessions.getOnlineList();

        const offlineList = this.data.members
            .filter(i => !onlineList.find(j => j.id === i))
            .map(i => Users.getOnline(i))

        const invitedList = (this.data.invites ?? [] as string[])
            .map(i => Users.getOnline(i))

        return [onlineList, offlineList, invitedList];
    }

    addRule(rule: string, by?: string) {
        this.data.rules.push(rule);

        this.log(`Added rule ${rule}`)

        io.to(this.data.id).emit("room details updated", this.data.id, {
            desc: this.data.description,
            rules: this.data.rules
        })

        this.infoMessage(`${by ?? "System"} added a new rule: ${rule}`)
    }

    removeRule(rule: string, by?: string) {
        if (!this.data.rules.includes(rule))
            return;

        this.data.rules = this.data.rules.filter(r => r !== rule);

        this.log(`Deleted rule ${rule}`)

        io.to(this.data.id).emit("room details updated", this.data.id, {
            desc: this.data.description,
            rules: this.data.rules
        })

        this.infoMessage(`${by ?? "System"} removed the rule '${rule}'`)
    }

    updateDescription(description: string, changedBy?: string) {

        this.data.description = description

        this.log(`Description is now ${description}`)

        io.to(this.data.id).emit("room details updated", this.data.id, {
            desc: this.data.description,
            rules: this.data.rules
        })

        this.infoMessage(`${changedBy ?? "System"} changed the room description to: ${description}`);

    }

    updateOptions(options: RoomOptions) {

        for (const name in this.data.options)
            this.data.options[name] = options[name]
        // idk why i am doing it like this, it just feels safer

        this.log(`Room options updated`)

        this.infoMessage(`${Users.get(this.data.owner)?.name} updated the room options.`)

        this.hotReload();

    }

    /**
     * Preforms a hot reload of the room (basically recreates it)  
     * Also tells the clients to preform a hot reload of the room on their end
     */
    hotReload() {

        delete roomsReference[this.data.id]
        // remove from reference

        const newRoom = new Room(this.data.id)
        // recreate

        newRoom.sessions = this.sessions;

        // update mutes and kicks
        [
            ...Object.entries(this.muted).map(m => [true, ...m]),
            ...Object.entries(this.kicked).map(k => [false, ...k])
        ].forEach(([mute, id, [endTime, timeout]]: [boolean, string, [number, ReturnType<typeof setTimeout>]]) => {
            clearTimeout(timeout);
            if (mute) newRoom.addMutedCountdown(id, endTime);
            else newRoom.addKickCountdown(id, endTime);
        });

        // set data that cannot be reset

        this.log("Server-side hot reload completed")

        io.to(this.data.id).emit("hot reload room", this.data.id, this.data)

    }

    updateName(name: string, by: string = "System") {

        this.data.name = name;

        this.log(`Name is now ${name}`)

        this.infoMessage(`${by} renamed the room to ${name}`);

        this.hotReload();

    }

    updateEmoji(emoji: string, by: string = "System") {

        this.data.emoji = emoji;

        this.log(`Emoji is now ${emoji}`)

        this.infoMessage(`${by} changed the room emoji to ${emoji}`);

        this.hotReload();

    }

    addBot(id: string | string[], userId: string) {
        if (typeof id === "string") id = [id];

        const bots = id
            .filter(i => !this.data.bots.includes(i))
            .map(i => BotList.get(i))
            .filter(b => !!b);

        const by = Users.get(userId);

        const ids = bots.map(b => b.id);

        this.data.bots.push(...ids);
        this.bots.add(ids);

        BotAnalytics.countRooms();

        io.to(this.data.id).emit("bot data", this.data.id, this.bots.botData);

        for (const bot of bots) {
            this.infoMessage(`${by.name} added ${bot.data.name} to the room`);
            this.bots.runAdded(bot.id, by);
        }

        this.log(`${by.name} added bot(s) ${ids.join(", ")}`);

    }

    removeBot(id: string, by: string) {

        if (!this.data.bots.includes(id))
            return;

        const bot = BotList.get(id);
        if (!bot) return;

        this.data.bots = this.data.bots.filter(n => n !== id);
        this.bots.remove(id);

        BotAnalytics.countRooms();

        io.to(this.data.id).emit("bot data", this.data.id, this.bots.botData);

        this.log(`Removed bot ${id}`)
        this.infoMessage(`${by} removed ${bot.data.name} from the room`);

    }

    inviteUser(to: UserData, from: UserData) {

        if (!this.data.invites)
            this.data.invites = []

        this.data.invites.push(to.id)

        createRoomInvite(to, from, this.data)

        this.log(`${from.name} invited ${to.name}`)

        this.infoMessage(`${from.name} invited ${to.name} to the room`)

        io.to(this.data.id).emit("member data", this.data.id, this.getMembers())
        this.broadcastOnlineListToRoom();

    }

    deleteRoom() {

        // remove all members and invites

        this.data.members.forEach(m => this.removeUser(m))
        if (this.data.invites) this.data.invites.forEach(m => this.removeUser(m))

        const id = String(this.data.id) // make a new string, i think, idk if this is necessary 

        // remove from files and reference

        delete roomsReference[id];
        delete rooms.ref[id];

        // remove archive and webhooks

        this.archive.segments.forEach(s => s.dereference());
        this.readData.dereference();

        if (fs.existsSync(`data/rooms/archive-${id}.json`))
            fs.unlinkSync(`data/rooms/archive-${id}.json`)

        if (fs.existsSync(`data/rooms/${id}`))
            fs.rm(`data/rooms/${id}`, { recursive: true, force: true }, err => {
                if (err) throw err
            })

        if (fs.existsSync(`data/rooms/webhook-${id}.json`))
            fs.unlinkSync(`data/rooms/webhook-${id}.json`)

        // remove media

        this.share.dereference();
        this.share.options.canUpload = false; // prevent a possible upload to deleted share
        if (fs.existsSync(`data/shares/${id}`))
            fs.rm(`data/shares/${id}`, { recursive: true, force: true }, err => {
                if (err)
                    throw err
            })

        this.log(`This room has been deleted, adios :(`)

    }

    /**
     * Remove's the room owner's owner privileges
     */
    removeOwnership() {

        this.data.owner = "nobody"

        for (const name in this.data.options.permissions) {
            if (
                this.data.options.permissions[name] === "owner" ||
                (this.data.options.permissions[name] === "poll" && this.data.members.length <= 2)
            )
                this.data.options.permissions[name] = "anyone"
        }

        this.log(`Owner reset`)

        this.hotReload()

    }

    /**
     * Sets a new owner
     */
    setOwner(owner: string) {

        this.data.owner = owner

        this.log(`${this.data.owner} now owner`)

        this.hotReload()

    }

    checkPermission(action: keyof RoomOptions["permissions"], owner: boolean): "yes" | "no" | "poll" {

        if (this.data.options.permissions[action] === "anyone")
            return 'yes';

        if (this.data.options.permissions[action] === "poll")
            return owner ? 'yes' : 'poll'

        if (this.data.options.permissions[action] === "owner" && owner)
            return 'yes';

        return 'no';

    }

    private muted: Record<string, [number, ReturnType<typeof setTimeout>]> = {};
    private kicked: Record<string, [number, ReturnType<typeof setTimeout>]> = {};

    /**
     * Mutes a user
     * @param userData UserData or User ID to mute
     * @param time Time to mute in minutes
     * @param mutedBy Who muted the user
     */
    mute(userData: string | UserData, time: number, mutedBy: string = "System"): void {

        const
            userId = typeof userData === "string" ? userData : userData.id,
            name = typeof userData === "string" ? Users.get(userId).name : userData.name,
            endTime = Date.now() + (time * 60 * 1000),
            session = this.sessions.getByUserID(userId);

        if (this.isMuted(userId)) return;
        if (userId === this.data.owner) return;

        if (session)
            session.socket.emit("mute", this.data.id, true);

        this.infoMessage(`${name} has been muted for ${time} minute${time === 1 ? '' : 's'} by ${mutedBy}`)
        this.removeTyping(name);

        this.addMutedCountdown(userId, endTime);

        // VVV this is here to add the muted tag on the members page VVV
        io.to(this.data.id).emit("member data", this.data.id, this.getMembers())
    }

    muteBot(botData: string | BotData, time: number, by: string = "System"): void {
        const
            botId = typeof botData === "string" ? botData : botData.id,
            name = typeof botData === "string" ? BotList.getData([botData])[0].name : botData.name,
            endTime = Date.now() + (time * 60 * 1000);

        if (this.isMuted(botId)) return;
        this.infoMessage(`${name} has been muted for ${time} minute${time === 1 ? '' : 's'} by ${by}`);

        this.bots.mute(botId, endTime);
        this.addMutedCountdown(botId, endTime);

        io.to(this.data.id).emit("bot data", this.data.id, this.bots.botData);
    }

    private addMutedCountdown(userId: string, endTime: number) {

        if (this.muted[userId])
            clearTimeout(this.muted[userId][1]);

        this.muted[userId] = [endTime, setTimeout(() => {
            this.unmute(userId);
        }, endTime - Date.now())];

    }

    unmute(userId: string, by?: string) {
        if (this.muted[userId])
            clearTimeout(this.muted[userId][1]);

        delete this.muted[userId];

        const bot = userId.startsWith("bot-");
        const name = bot ? BotList.getData([userId])[0].name : Users.get(userId).name;

        if (bot)
            this.bots.unmute(userId);
        else {
            const session = this.sessions.getByUserID(userId);
            if (session) session.socket.emit("mute", this.data.id, false);
        }

        this.infoMessage(`${name} has been unmuted${by ? ` by ${by}` : ""}`)

        // VVV this is here to add the muted tag on the members page VVV
        if (bot) io.to(this.data.id).emit("bot data", this.data.id, this.bots.botData);
        else io.to(this.data.id).emit("member data", this.data.id, this.getMembers())
    }

    /**
     * Checks if a user is muted
     * @param userId User ID to check
     * @returns Whether or not the user is muted
     */
    isMuted(userId: string) {
        return typeof this.muted[userId] !== "undefined"
    }

    kick(userData: UserData | string, time: number, kickedBy?: string) {
        const
            userId = typeof userData === "string" ? userData : userData.id,
            name = typeof userData === "string" ? Users.get(userId).name : userData.name,
            endTime = Date.now() + (time * 60 * 1000);

        if (userId === this.data.owner) return;
        if (this.isKicked(userId)) return;

        this.removeUser(userId); // remove from room (obv)

        if (!this.data.invites)
            this.data.invites = []

        this.data.invites.push(userId)
        // add to invites list w/o sending invite (to prevent being added back)

        this.addKickCountdown(userId, endTime);

        if (!this.data.kicks)
            this.data.kicks = {};

        this.data.kicks[userId] = endTime;

        io.to(this.data.id).emit("member data", this.data.id, this.getMembers())
        this.broadcastOnlineListToRoom(); // update lists on clients
        this.infoMessage(`${name} has been kicked for ${time} minute${time === 1 ? '' : 's'} by ${kickedBy}`)
    }

    private addKickCountdown(userId: string, endTime: number) {

        if (this.kicked[userId])
            clearTimeout(this.kicked[userId][1]);

        this.kicked[userId] = [endTime, setTimeout(() => {
            this.unkick(userId);
        }, endTime - Date.now())];
    }

    isKicked(userId: string): boolean {
        return typeof this.kicked[userId] !== "undefined";
    }

    unkick(userId: string, by?: string) {
        if (this.kicked[userId])
            clearTimeout(this.kicked[userId][1]);

        delete this.kicked[userId];

        if (this.data.invites && this.data.invites.includes(userId)) {
            // verify they haven't left or been removed before re-adding
            this.addUser(userId, by ? `has been re-added by ${by}` : "has rejoined the room");
            notifications.remove([userId], `${this.data.id}-kick`, true);
        }

        if (this.data.kicks) {
            delete this.data.kicks[userId];

            if (Object.keys(this.data.kicks).length === 0)
                delete this.data.kicks;

        }
    }

    muteEndTime(userId: string): number | undefined {
        const data = this.muted[userId];
        if (!data) return undefined;
        return data[0];
    }

    kickEndTime(userId: string): number | undefined {
        const data = this.kicked[userId];
        if (!data) return undefined;
        return data[0];
    }

    emailInvite(email: string, from: UserData) {
        if (!this.data.emailInvites)
            this.data.emailInvites = [];

        this.data.emailInvites.push(email);

        createEmailInvite(email, from.id, this.data.id);

        io.to(this.data.id).emit("email invites", this.data.id, this.data.emailInvites);
        
        this.infoMessage(`${from.name} invited ${email.split("@")[0]} (via email) to the room`)
    }

    removeEmail(email: string) {
        if (!this.data.emailInvites)
            return;

        this.data.emailInvites = this.data.emailInvites
            .filter(e => e.toLowerCase().replace(/\./g, "") !== email.toLowerCase().replace(/\./g, ""));

        cancelEmailInvite(email, this.data.id);

        io.to(this.data.id).emit("email invites", this.data.id, this.data.emailInvites);
    }

    upgradeEmailInvite(to: UserData) {
        this.removeEmail(to.email);

        if (!this.data.invites)
            this.data.invites = []

        this.data.invites.push(to.id)

        this.log(`${to.name} upgraded from email invite`);

        io.to(this.data.id).emit("member data", this.data.id, this.getMembers())
        this.broadcastOnlineListToRoom();
    }
}

export function createRoom(
    { name, emoji, owner, options, members, description, bots }:
        { name: string, emoji: string, owner: string, options: RoomOptions, members: Set<string>, description: string, bots: Set<string> },
    forced: boolean = false
) {

    // set room id
    // i could use recursion but i am just not feeling it today

    let id: string;
    while (!id) {
        const tempId = crypto.randomBytes(16).toString('hex');
        if (!rooms.getDataReference()[tempId])
            id = tempId
    }

    const invites = [...members].filter(id => id !== owner)

    const data: RoomFormat = {
        id, name, emoji, owner, options, description,
        members: forced ? [...members] : [owner],
        bots: [], // will be added later
        rules: [],
        invites: [],
        type: "room"
    }

    json.write(`data/rooms/webhook-${id}.json`, [])
    fs.mkdirSync(`data/rooms/${id}`);
    fs.mkdirSync(`data/rooms/${id}/archive`);

    rooms.ref[id] = data;

    console.log(`rooms: ${owner} created room "${name}" (id ${id})`)

    const room = new Room(id)
    const ownerData = Users.get(owner);

    if (!forced)
        for (const userId of invites)
            room.inviteUser(Users.get(userId), ownerData);

    if (ownerData)
        room.addBot([...bots], ownerData.id);

    return room
}

export function getRoomsByUserId(userId: string): Room[] {
    const out: Room[] = [];

    for (const roomId in rooms.ref) {
        const room = rooms.ref[roomId]

        if ((room as any).type === "DM")
            continue;

        if (room.members.includes(userId))
            out.push(new Room(room.id))

    }

    return out;
}

export function doesRoomExist(id: string) {

    if (
        !rooms.getDataReference()[id] ||
        (
            !fs.existsSync(`data/rooms/${id}`) &&
            !fs.existsSync(`data/rooms/${id}/archive`) &&
            !fs.existsSync(`data/rooms/archive-${id}.json`)
        ) ||
        !fs.existsSync(`data/rooms/webhook-${id}.json`)
    )
        return false;

    return true;

}

/**
 * Checks if a given room exists, and if a given user is in it
 * @param roomId ID of room to check
 * @param userId ID of user to check
 * @param allowDMs Whether or not to allow DMs (default true)
 * @param allowInvited Whether or not to allow invited users (default false)
 * @returns False if check failed, room if it succeeded
 */
export function checkRoom(roomId: string, userId: string, allowDMs?: true, allowInvited?: boolean): false | Room | DM;
export function checkRoom(roomId: string, userId: string, allowDMs?: false, allowInvited?: boolean): false | Room;
export function checkRoom(roomId: string, userId: string, allowDMs: boolean = true, allowInvited: boolean = false): false | Room | DM {

    if (!doesRoomExist(roomId)) return false;

    if (!allowDMs && (rooms.getDataReference()[roomId] as any).type === "DM")
        return false

    let room: Room | DM;

    if (rooms.ref[roomId].type === "DM")
        room = new DM(roomId)
    else
        room = new Room(roomId)

    const members = allowInvited && room.data.type === "room" ?
        [...room.data.members, ...room.data.invites] :
        room.data.members;

    if (!members.includes(userId)) return false;

    return room;

}

checkRoom.bot = (roomId: string, botId: string): Room | false => {
    if (!doesRoomExist(roomId)) return false;

    const room = rooms.ref[roomId].type === "DM" ?
        false : new Room(roomId);

    if (!room) return false;

    if (!room.data.bots) return false;

    if (!room.data.bots.includes(botId))
        return false;

    return room;
}

/**
 * @deprecated use emitToRoomsWith instead
 */
export function getUsersIdThatShareRoomsWith(userId: string): string[] {

    const rooms = getRoomsByUserId(userId);

    const userIds: string[] = [];

    for (const room of rooms)
        userIds.push(...room.data.members)

    return [...new Set(userIds)]    // remove duplicates 
        .filter(id => id !== userId)
}