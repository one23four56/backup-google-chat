import * as crypto from 'crypto';
import * as fs from 'fs';
import get from './data';
import * as json from './json';
import Archive from './archive';
import Message, { Poll } from '../lib/msg';
import Webhooks, { Webhook } from './webhooks';
import SessionManager, { Session } from './session';
import { io, sessions } from '..';
import { UserData } from '../lib/authdata';
import Bots from './bots';
import * as BotObjects from './bots/botsIndex'
import AutoMod from './autoMod';
import { Users } from './users';
import Share from './mediashare';

interface RoomOptions {
    /**
     * Controls whether or not webhooks are allowed in the room
     */
    webhooksAllowed: boolean;
    /**
     * Controls whether or not deleting private webhooks is allowed
     */
    allowDeletingPrivateWebhooks: boolean;
    /**
     * Controls whether or not users can access the archive viewer for this room
     */
    archiveViewerAllowed: boolean;
    /**
     * An array of all the bots allowed in the room
     */
    allowedBots: (keyof typeof BotObjects)[];
    /**
     * Automod settings
     */
    autoMod: {
        /**
         * Number controlling the automod strictness, higher = more strict
         */
        strictness: number;
        /**
         * Number of warnings automod will give out before a mute
         */
        warnings: number;
    };
    /**
     * Room permissions
     */
    permissions: {
        /**
         * Controls who can invite and remove people, owner only, anyone, or require a poll for non-owners
         */
        invitePeople: "owner" | "anyone" | "poll"
    };
    /**
     * If true and the share size is above 100 mb, old files will be deleted to make way for new ones
     */
    autoDelete: boolean;
}

function validateOptions(options: RoomOptions) {

    for (const name in options.permissions) {

        const permission = options.permissions[name]

        if (permission !== "anyone" && permission !== "owner" && permission !== "poll")
            return false;

    }

    if (options.autoMod.strictness < 1 || options.autoMod.strictness > 5) return false;
    if (options.autoMod.warnings < 1 || options.autoMod.warnings > 5) return false;

    return true;

}

export function isRoomOptions(object: unknown): object is RoomOptions {

    if (typeof object !== "object") return false;

    const recursiveCheck = (item: object, check: object) => {

        for (const name in check) {

            if (typeof item[name] !== typeof check[name]) return false;

            if (Array.isArray(check[name]) !== Array.isArray(item[name])) return false;

            // arrays break it, so it has to ignore them
            if (typeof check[name] === "object" && !Array.isArray(check[name])) {
                if (recursiveCheck(item[name], check[name]) === false)
                    return false;
            }

        }

        return true;

    }

    // make sure all the required options are there
    if (recursiveCheck(object, defaultOptions) === false) return false;

    // make sure there are no extra options
    if (recursiveCheck(defaultOptions, object) === false) return false;

    // validate option inputs
    return validateOptions(object as RoomOptions)

}


export const defaultOptions: RoomOptions = {
    webhooksAllowed: false,
    allowDeletingPrivateWebhooks: true,
    archiveViewerAllowed: true,
    allowedBots: [
        "ArchiveBot",
        "Polly",
        "RandomBot",
        "TimeBot",
        "HelperBot"
    ],
    autoMod: {
        strictness: 3,
        warnings: 3
    },
    permissions: {
        invitePeople: "anyone"
    },
    autoDelete: true,
}

export interface RoomFormat {
    name: string;
    emoji: string;
    owner: string;
    members: string[];
    options: RoomOptions
    rules: string[];
    description: string;
    id: string;
    invites?: string[];
    qualifiedOwner?: string;
}

interface CreatePollInRoomOptionSettings {
    option: string;
    votes: number;
    voters: string[];
}

interface CreatePollInRoomSettings {
    message: string;
    prompt: string;
    option1: CreatePollInRoomOptionSettings;
    option2: CreatePollInRoomOptionSettings;
    option3?: CreatePollInRoomOptionSettings
}

// check to see if it needs to make data folder
// make it if it has to

if (!fs.existsSync('data'))
    fs.mkdirSync('data')

if (!fs.existsSync('data/rooms'))
    fs.mkdirSync('data/rooms')

export const rooms = get<Record<string, RoomFormat>>("data/rooms.json")

export const roomsReference: {
    [key: string]: Room
} = {}



/**
 * @class Room
 * @classdesc Representation of a room on the server.
 */
export default class Room {

    archive: Archive;
    data: RoomFormat;
    webhooks?: Webhooks;
    sessions: SessionManager;
    bots: Bots;
    autoMod: AutoMod;
    share: Share;
    
    private tempData: {
        [key: string]: any;
    } = {};

    constructor(id: string) {

        if (!doesRoomExist(id))
            throw `rooms: room with ID "${id}" not found`

        if (roomsReference[id])
            return roomsReference[id];

        this.data = rooms.getDataReference()[id]
        
        // automatically set room options to defaults if they are not set
        // this is required to make it so adding new options doesn't break old rooms
        for (const optionName in defaultOptions) {
            if (typeof this.data.options[optionName] === "undefined")
                this.data.options[optionName] = defaultOptions[optionName]
        }

        this.archive = new Archive(`data/rooms/archive-${id}.json`)

        if (this.data.options.webhooksAllowed)
            this.webhooks = new Webhooks(`data/rooms/webhook-${id}.json`, this);

        this.sessions = new SessionManager();

        this.autoMod = new AutoMod({
            room: this, 
            strictLevel: this.data.options.autoMod.strictness,
            warnings: this.data.options.autoMod.warnings
        })

        this.bots = new Bots(this);

        for (const botName of this.data.options.allowedBots) {
            const Bot = BotObjects[botName]
            if (Bot)
                this.bots.register(new Bot())
        }

        this.share = new Share(this.data.id)

        roomsReference[id] = this;

        console.log(`rooms: loaded room "${this.data.name}" (${this.data.id}) from storage`)

    }

    /**
     * Logs text to console
     * @param text Text to log
     */
    protected log(text: string) {
        console.log(`${this.data.id} ("${this.data.name}"): ${text}`)
    }

    addSession(session: Session) {
        
        if (!this.data.members.includes(session.userData.id)) {
            console.warn(`rooms: attempt to add session ("${session.userData.name}" / ${session.userData.id}) to room ("${this.data.name}" / ${this.data.id}) that they are not a member of`);
            return;
        }

        this.sessions.register(session)

        session.socket.join(this.data.id)

        this.broadcastOnlineListToRoom();

    }

    removeSession(session: Session) {

        session.socket.leave(this.data.id)

        this.sessions.deregister(session.sessionId)

        this.broadcastOnlineListToRoom();

    }

    addUser(id: string) {
        this.data.members.push(id)

        if (this.data.invites) this.data.invites = this.data.invites.filter(i => i !== id)

        this.log(`User ${id} added to room`)

        this.infoMessage(`${Users.get(id).name} has joined the room`)

        const session = sessions.getByUserID(id)

        if (session) {
            this.addSession(session)
            session.socket.emit("added to room", this.data)
        }

        io.to(this.data.id).emit("member data", this.data.id, this.getMembers())
    }

    removeUser(id: string) {
        this.data.members = this.data.members.filter(userId => userId !== id)

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

        const updateIds = this.archive.resetReadIconsFor(id)

        io.to(this.data.id).emit("bulk message updates", this.data.id, updateIds.map(i => this.archive.getMessage(i)))

        io.to(this.data.id).emit("member data", this.data.id, this.getMembers())
    }

    /**
     * Gets room members as a UserData array
     * @returns Members as a UserData array
     */
    getMembers(): MemberUserData[] {
        const members = this.data.members
            .map(id => Users.get(id))
            .filter(item => typeof item !== "undefined")
            .map(m => {
                (m as MemberUserData).type = "member"
                return m as MemberUserData; 
            })

        if (!this.data.invites) this.data.invites = []

        const invites = this.data.invites
            .map(id => Users.get(id))
            .filter(item => typeof item !== "undefined")
            .map(m => {
                (m as MemberUserData).type = "invited"
                return m as MemberUserData;
            })

        

        return [...members, ...invites]
    }

    /**
     * Handles a message by saving and dispatching it (saving and dispatching are optional)
     * @param message Message to use
     * @param save Whether or not to add message to archive
     * @param dispatch Whether or not to dispatch message to clients
     */
    message(message: Message, save: boolean = true, dispatch: boolean = true) {

        if (save) 
            this.archive.addMessage(message);
        else
            message.notSaved = true;

        if (dispatch) 
            io.to(this.data.id).emit("incoming-message", this.data.id, message)

        this.log(`Message #${message.id} from ${message.author.name}: ${message.text} (${save && dispatch ? `defaults` : `save: ${save}, dispatch: ${dispatch}`})`)

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
                image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png",
                id: 'bot'
            },
            time: new Date(new Date().toUTCString()),
            tags: [{
                text: 'BOT',
                color: 'white',
                bgColor: 'black'
            }],
            id: this.archive.length,
        }

        this.message(message)

        return message;
    }

    /**
     * Edits a message
     * @param id Id of message to edit
     * @param text Text to set message to
     * @param dispatch Whether or not to dispatch event to clients
     */
    edit(id: number, text: string, dispatch: boolean = true) {

        this.archive.updateMessage(id, text);

        const message = this.archive.getMessage(id)

        if (dispatch)
            io.to(this.data.id).emit("message-edited", this.data.id, message);

        this.log(`${message.author.name} edited message #${message.id} to: ${message.text} ${dispatch ? `` : `(not dispatched)`}`)

    }

    /**
     * Deletes a message
     * @param id Id of message to delete
     * @param dispatch Whether or not to dispatch event to clients
     */
    delete(id: number, dispatch: boolean = true) {

        const message = this.archive.getMessage(id)

        if (!message)
            return;

        // only delete media if it exists and there is only 1 message with that media
        if (message.media && message.media.type === "media" && this.archive.getMessagesWithMedia(message.media.location).length === 1)
            this.share.remove(message.media.location)

        this.archive.deleteMessage(id);

        if (dispatch)
            io.to(this.data.id).emit("message-deleted", this.data.id, id);

        this.log(`${message.author.name} deleted message #${message.id} ${dispatch ? `` : `(not dispatched)`}`)
    }

    addWebhook(name: string, image: string, isPrivate: boolean, creator: UserData) {
        if (!this.webhooks)
            return;

        this.webhooks.create({name, image, isPrivate, owner: creator.id})

        this.infoMessage(`${creator.name} created the${isPrivate ? ' private' : ''} webhook '${name}'`)

        io.to(this.data.id).emit("webhook data", this.data.id, this.webhooks.getWebhooks())

        this.log(`${creator.name} created webhook '${name}' (${isPrivate? 'private' : 'public'})`)
    }

    editWebhook(webhook: Webhook, name: string, image: string, editor: UserData) {    
        if (!this.webhooks)
            return;
        
        this.infoMessage(`${editor.name} updated the${webhook.private ? ' private' : ''} webhook '${webhook.name}' to '${name}'`)

        webhook.update(name, image);

        io.to(this.data.id).emit("webhook data", this.data.id, this.webhooks.getWebhooks())

        this.log(`${editor.name} updated webhook '${webhook.name}' (${webhook.private? 'private' : 'public'})`)
    }

    deleteWebhook(webhook: Webhook, deleter: UserData) {
        if (!this.webhooks)
            return;

        this.infoMessage(`${deleter.name} deleted the${webhook.private ? ' private' : ''} webhook '${webhook.name}'`)

        webhook.remove();

        io.to(this.data.id).emit("webhook data", this.data.id, this.webhooks.getWebhooks())

        this.log(`${deleter.name} deleted webhook '${webhook.name}' (${webhook.private? 'private' : 'public'})`)
    }
    
    /**
     * Creates a custom system poll in this room.
     * @param param0 Options for the poll to add
     * @returns A promise that will resolve with the winner as a string
     */
    createPollInRoom({ message, prompt, option1, option2, option3 }: CreatePollInRoomSettings): Promise<string> {

        const polly = this.bots.bots.find(bot => bot.name === "Polly") as BotObjects.Polly;

        const poll: Poll = {
            type: 'poll',
            finished: false,
            question: prompt,
            options: [
                option1,
                option2
            ]
        }

        if (option3)
            poll.options[2] = option3

        const msg = this.bots.genBotMessage(polly.name, polly.image, {
            text: message,
            poll: poll
        })

        return new Promise<string>(resolve => polly.runTrigger(this, poll, msg.id).then(winner => resolve(winner)))
    }

    /**
     * Sets temporary data specific to this room that can be changed, cleared, and/or retrieved later. Data is not saved when the program closes.
     * @param key Name of the stored data. Used to retrieve it
     * @param data The data itself. Can be any type.
     */
    setTempData<type = any>(key: string, data: type) {
        this.tempData[key] = data;
    }

    /**
     * Gets temporary data stored on this room.
     * @param key Name of data to get.
     * @returns The data itself.
     */
    getTempData<type = any>(key: string): type {
        return this.tempData[key] as type;
    }

    /**
     * Clears temporary data stored on this room.
     * @param key Name of the data to clear.
     */
    clearTempData(key: string) {
        delete this.tempData[key]
    }

    broadcastOnlineListToRoom() {
        const onlineList = this.sessions.getOnlineList();
        io.to(this.data.id).emit("online list", this.data.id, onlineList)
    }

    addRule(rule: string) {
        this.data.rules.push(rule);

        this.log(`Added rule ${rule}`)

        io.to(this.data.id).emit("room details updated", this.data.id, {
            desc: this.data.description,
            rules: this.data.rules
        })

        this.infoMessage(`A new rule has been added: ${rule}`)
    }

    removeRule(rule: string) {
        if (!this.data.rules.includes(rule))
            return;

        this.data.rules = this.data.rules.filter(r => r !== rule);

        this.log(`Deleted rule ${rule}`)

        io.to(this.data.id).emit("room details updated", this.data.id, {
            desc: this.data.description,
            rules: this.data.rules
        })

        this.infoMessage(`The rule '${rule.length > 23 ? rule.slice(0, 20) + "..." : rule}' has been deleted`)
    }

    updateDescription(description: string) {

        this.data.description = description

        this.log(`Description is now ${description}`)

        io.to(this.data.id).emit("room details updated", this.data.id, {
            desc: this.data.description,
            rules: this.data.rules
        })

        this.infoMessage(`The room description has been updated.`)

    }

    updateOptions(options: RoomOptions) {
        
        for (const name in this.data.options)
            this.data.options[name] = options[name]
            // idk why i am doing it like this, it just feels safer

        this.log(`Room options updated`)

        this.infoMessage(`The room options have been updated.`)

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

        newRoom.sessions = this.sessions
        newRoom.autoMod.mutes = this.autoMod.mutes // fixes a bug that i accidentally found while seeing how annoying automod strictness 5 is
        // set data that cannot be reset

        this.log("Server-side hot reload completed")

        io.to(this.data.id).emit("hot reload room", this.data.id, this.data)

    }

    updateName(name: string) {

        this.data.name = name;

        this.log(`Name is now ${name}`)

        this.infoMessage(`The room name is now '${this.data.name}'`)

        this.hotReload();

    }

    updateEmoji(emoji: string) {

        this.data.emoji = emoji;

        this.log(`Emoji is now ${emoji}`)

        this.infoMessage(`The room emoji is now ${this.data.emoji}`)

        this.hotReload();

    }

    addBot(name: keyof typeof BotObjects, displayName: string) {

        this.data.options.allowedBots.push(name);

        this.log(`Added bot ${name}`)

        this.infoMessage(`The bot ${displayName} has been added to the room`)

        this.hotReload();

    }

    removeBot(name: keyof typeof BotObjects, displayName: string) {

        this.data.options.allowedBots = this.data.options.allowedBots.filter(n => n !== name)

        this.log(`Removed bot ${name}`)

        this.infoMessage(`The bot ${displayName} has been removed from the room`)

        this.hotReload();

    }

    inviteUser(to: UserData, from: UserData) {

        if (!this.data.invites)
            this.data.invites = []

        this.data.invites.push(to.id)

        createRoomInvite(to, from, this.data.id, this.data.name)

        this.log(`${from.name} invited ${to.name}`)

        this.infoMessage(`${from.name} invited ${to.name} to the room`)

        io.to(this.data.id).emit("member data", this.data.id, this.getMembers())

    }

    deleteRoom() {

        // remove all members and invites

        this.data.members.forEach(m => this.removeUser(m))
        if (this.data.invites) this.data.invites.forEach(m => this.removeUser(m))

        const id = String(this.data.id) // make a new string, i think, idk if this is necessary 

        // remove from files and reference

        delete roomsReference[id]
        delete rooms.ref[id]

        // remove archive and webhooks

        if (fs.existsSync(`data/rooms/archive-${id}.json`))
            fs.unlinkSync(`data/rooms/archive-${id}.json`)

        if (fs.existsSync(`data/rooms/webhook-${id}.json`))
            fs.unlinkSync(`data/rooms/webhook-${id}.json`)

        // remove media

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
        
        this.data.qualifiedOwner = "" + this.data.owner // make a new string idk if i even need to do this

        this.data.owner = "nobody"

        for (const name in this.data.options.permissions)
            this.data.options.permissions[name] = "anyone"

        this.log(`Owner reset`)

        this.hotReload()

    }

    /**
     * Puts the old owner back in charge
     */
    reinstateOwner() {
        
        if (!this.data.qualifiedOwner)
            return;

        this.data.owner = this.data.qualifiedOwner + "" // make a new string idk if i even need to do this

        delete this.data.qualifiedOwner;

        this.log(`${this.data.owner} now owner`)

        this.hotReload()

    }
}

import DM from './dms'; // has to be down here to prevent an error
import { createRoomInvite, deleteInvite, getInvitesTo, RoomInviteFormat } from './invites';
import { MemberUserData } from '../lib/misc';

export function createRoom(
    { name, emoji, owner, options, members, description }: { name: string, emoji: string, owner: string, options: RoomOptions, members: string[], description: string },
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

    const invites = members.filter(id => id !== owner)

    const data: RoomFormat = {
        name: name,
        emoji: emoji,
        owner: owner,
        options: options,
        members: forced? members : [owner],
        rules: ["The owner has not set rules for this room yet."],
        description: description,
        id: id
    }

    json.write(`data/rooms/archive-${id}.json`, [])
    json.write(`data/rooms/webhook-${id}.json`, [])

    rooms.getDataReference()[id] = data

    console.log(`rooms: ${owner} created room "${name}" (id ${id})`)

    const room = new Room(id)

    if (!forced) {
        const ownerData = Users.get(owner)

        for (const userId of invites)
            room.inviteUser(Users.get(userId), ownerData)
    }

    return room
}

export function getRoomsByUserId(userId: string): (Room | DM)[] {

    const roomIds: string[] = []

    for (const roomId in rooms.getDataReference()) {

        const room = rooms.getDataReference()[roomId]

        if ((room as any).type === "DM")
            continue;

        if (room.members.includes(userId))
            roomIds.push(room.id)

    }

    return roomIds
        .map(id => new Room(id))

}

export function doesRoomExist(id: string) {

    if (!rooms.getDataReference()[id] || !fs.existsSync(`data/rooms/archive-${id}.json`) || !fs.existsSync(`data/rooms/webhook-${id}.json`))
        return false;

    return true;

}

/**
 * Checks if a given room exists, and if a given user is in it
 * @param roomId ID of room to check
 * @param userId ID of user to check
 * @returns False if check failed, room if it succeeded
 */
export function checkRoom(roomId: string, userId: string, allowDMs: boolean = true): false | Room | DM {

    if (!doesRoomExist(roomId)) return false;

    if (!allowDMs && (rooms.getDataReference()[roomId] as any).type === "DM")
        return false

    let room

    if ((rooms.getDataReference()[roomId] as any).type === "DM")
        room = new DM(roomId)
    else 
        room = new Room(roomId)

    if (!room.data.members.includes(userId)) return false;

    return room;

}

export function getUsersIdThatShareRoomsWith(userId: string): string[] {

    const rooms = getRoomsByUserId(userId);

    const userIds: string[] = [];

    for (const room of rooms)
        userIds.push(...room.data.members)

    return [...new Set(userIds)]    // remove duplicates 
        .filter(id => id !== userId)
}