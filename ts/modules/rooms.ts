import * as crypto from 'crypto';
import * as fs from 'fs';
import get from './data';
import * as json from './json';
import Archive from './archive';
import Message, { Poll } from '../lib/msg';
import Webhooks, { Webhook } from './webhooks';
import SessionManager, { Session } from './session';
import { io, sessions } from '..';
import { OnlineStatus, OnlineUserData, UserData } from '../lib/authdata';
import Bots from './bots';
import * as BotObjects from './bots/botsIndex'
import AutoMod from './autoMod';
import { Users } from './users';
import Share from './mediashare';
import { createPoll, PollWatcher } from './polls'

type permission = "owner" | "anyone" | "poll";
interface RoomOptions {
    /**
     * Controls whether or not webhooks are allowed in the room
     */
    webhooksAllowed: boolean;
    /**
     * Controls whether or not private webhooks are allowed
     */
    privateWebhooksAllowed: boolean;
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
        /**
         * Whether or not to block slow spam
         */
        blockSlowSpam: boolean;
        /**
         * Mute duration
         */
        muteDuration: number;
        allowMutes: boolean;
        allowBlocking: boolean;
        blockDuplicates: boolean;
        canDeleteWebhooks: boolean;
    };
    /**
     * Room permissions
     */
    permissions: {
        /**
         * Controls who can invite people
         */
        invitePeople: permission;
        removePeople: permission;
        /**
         * Controls who can add/remove bots from the room
         */
        addBots: permission;
    };
    /**
     * If true and the share size is above 100 mb, old files will be deleted to make way for new ones
     */
    autoDelete: boolean;
    /**
     * Max file upload size
     */
    maxFileSize: number;
}

function validateOptions(options: RoomOptions) {

    for (const name in options.permissions) {

        const permission = options.permissions[name]

        if (permission !== "anyone" && permission !== "owner" && permission !== "poll")
            return false;

    }

    if (options.autoMod.strictness < 1 || options.autoMod.strictness > 5) return false;
    if (options.autoMod.warnings < 1 || options.autoMod.warnings > 5) return false;
    if (options.autoMod.muteDuration < 1 || options.autoMod.muteDuration > 10) return false;

    if (options.maxFileSize < 1 || options.maxFileSize > 10) return false;

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
    privateWebhooksAllowed: false,
    archiveViewerAllowed: true,
    allowedBots: [
        "ArchiveBot",
        "RandomBot",
    ],
    autoMod: {
        strictness: 3,
        warnings: 3,
        allowBlocking: true,
        allowMutes: true,
        blockDuplicates: true,
        blockSlowSpam: true,
        canDeleteWebhooks: true,
        muteDuration: 2
    },
    permissions: {
        invitePeople: "anyone",
        removePeople: "anyone",
        addBots: "owner"
    },
    autoDelete: true,
    maxFileSize: 5,
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
}

interface CreatePollInRoomSettings {
    message: string;
    prompt: string;
    options: string[];
    defaultOption: string;
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

    private typing: [string, ReturnType<typeof setTimeout>][] = [];

    constructor(id: string) {

        if (!doesRoomExist(id))
            throw `rooms: room with ID "${id}" not found`

        if (roomsReference[id])
            return roomsReference[id];

        this.data = rooms.getDataReference()[id];

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

        this.archive = new Archive(`data/rooms/archive-${id}.json`)

        this.startPollWatchers();

        if (this.data.options.webhooksAllowed === true)
            this.webhooks = new Webhooks(`data/rooms/webhook-${id}.json`, this);

        this.sessions = new SessionManager();

        this.autoMod = new AutoMod(this, this.data.options.autoMod)

        this.bots = new Bots(this);

        for (const botName of this.data.options.allowedBots) {
            const Bot = BotObjects[botName]
            if (Bot)
                this.bots.register(new Bot())
        }

        this.share = new Share(this.data.id, {
            autoDelete: this.data.options.autoDelete,
            maxFileSize: this.data.options.maxFileSize * 1e6,
            maxShareSize: 2e8,
            canUpload: this.data.members,
            canView: this.data.members
        });

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

        this.removeTyping(session.userData.name)

        session.socket.leave(this.data.id)

        this.sessions.deregister(session.sessionId)

        this.broadcastOnlineListToRoom();

    }

    addUser(id: string) {
        this.data.members.push(id)

        this.share.options.canUpload = this.data.members;
        this.share.options.canView = this.data.members;

        if (this.data.invites) this.data.invites = this.data.invites.filter(i => i !== id)

        this.log(`User ${id} added to room`)

        this.infoMessage(`${Users.get(id).name} has joined the room`)

        this.archive.readMessage(Users.get(id), this.archive.mostRecentMessageId)

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

        const updateIds = this.archive.resetReadIconsFor(id)

        io.to(this.data.id).emit("bulk message updates", this.data.id, updateIds.map(i => this.archive.getMessage(i)))

        io.to(this.data.id).emit("member data", this.data.id, this.getMembers());
        this.broadcastOnlineListToRoom();
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


        if (message.media)
            for (const { location, type } of message.media)
                if (type === "media" && this.archive.getMessagesWithMedia(location).length === 1)
                    this.share.remove(location);

        if (message.readIcons) {

            const findLatestMessageBefore = (id: number): number => {
                if (this.archive.getMessage(id - 1).deleted === true)
                    return findLatestMessageBefore(id - 1)

                return id - 1
            }

            const index = findLatestMessageBefore(message.id)
            message.readIcons.forEach(user => {
                this.archive.resetReadIconsFor(user.id)
                this.archive.readMessage(user, index)
            })

            io.to(this.data.id).emit("bulk message updates", this.data.id, [this.archive.getMessage(index)])
        }


        this.archive.deleteMessage(message.id);

        if (dispatch)
            io.to(this.data.id).emit("message-deleted", this.data.id, id);

        this.log(`${message.author.name} deleted message #${message.id} ${dispatch ? `` : `(not dispatched)`}`)
    }

    addWebhook(name: string, image: string, isPrivate: boolean, creator: UserData) {
        if (!this.webhooks)
            return;

        this.webhooks.create({ name, image, isPrivate, owner: creator.id })

        this.infoMessage(`${creator.name} created the${isPrivate ? ' private' : ''} webhook '${name}'`)

        io.to(this.data.id).emit("webhook data", this.data.id, this.webhooks.getWebhooks())

        this.log(`${creator.name} created webhook '${name}' (${isPrivate ? 'private' : 'public'})`)
    }

    editWebhook(webhook: Webhook, name: string, image: string, editor: UserData) {
        if (!this.webhooks)
            return;

        this.infoMessage(`${editor.name} updated the${webhook.private ? ' private' : ''} webhook '${webhook.name}' to '${name}'`)

        webhook.update(name, image);

        io.to(this.data.id).emit("webhook data", this.data.id, this.webhooks.getWebhooks())

        this.log(`${editor.name} updated webhook '${webhook.name}' (${webhook.private ? 'private' : 'public'})`)
    }

    deleteWebhook(webhook: Webhook, deleter: UserData) {
        if (!this.webhooks)
            return;

        this.infoMessage(`${deleter.name} deleted the${webhook.private ? ' private' : ''} webhook '${webhook.name}'`)

        webhook.remove();

        io.to(this.data.id).emit("webhook data", this.data.id, this.webhooks.getWebhooks())

        this.log(`${deleter.name} deleted webhook '${webhook.name}' (${webhook.private ? 'private' : 'public'})`)
    }

    /**
     * Creates a custom system poll in this room.
     * @param param0 Options for the poll to add
     * @returns A promise that will resolve with the winner as a string
     */
    createPollInRoom({ message, prompt, options, defaultOption }: CreatePollInRoomSettings): Promise<string> {

        const poll = createPoll("Info", this.archive.length, {
            expires: Date.now() + (1000 * 60 * 5),
            options,
            question: prompt
        })

        const defaultOpt = poll.options.find(o => o.option === defaultOption)
        defaultOpt.voters = ["System"]
        defaultOpt.votes = 1

        const msg: Message = {
            text: message,
            author: {
                name: "Info",
                image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png",
                id: 'bot'
            },
            time: new Date(),
            tags: [{
                text: 'BOT',
                color: 'white',
                bgColor: 'black'
            }],
            id: this.archive.length,
            poll,
        }

        this.message(msg)

        return new Promise<string>(resolve => {
            new PollWatcher(poll, this).addPollEndListener(winner => resolve(winner))
        })
    }

    /**
     * Sets temporary data specific to this room that can be changed, cleared, and retrieved later. Data is not saved when the program closes.
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

    /**
     * Gets the room online lists
     * @returns `[onlineList, offlineList, invitedList]`
     */
    getOnlineLists(): [OnlineUserData[], OnlineUserData[], OnlineUserData[]] {
        const onlineList = this.sessions.getOnlineList();

        const offlineList = this.data.members
            .filter(i => !onlineList.find(j => j.id === i))
            .map(i => {
                return {
                    ...Users.get(i), online: OnlineStatus.offline
                } as OnlineUserData
            })

        const invitedList = (this.data.invites ?? [] as string[])
            .map(i => {
                return {
                    ...Users.get(i), online:
                        sessions.getByUserID(i)?.onlineState || OnlineStatus.offline
                }
            })

        return [onlineList, offlineList, invitedList];
    }

    broadcastOnlineListToRoom() {
        io.to(this.data.id).emit(
            "online list",
            this.data.id,
            ...this.getOnlineLists()
        );
    }

    addRule(rule: string) {
        this.data.rules.push(rule);

        this.log(`Added rule ${rule}`)

        io.to(this.data.id).emit("room details updated", this.data.id, {
            desc: this.data.description,
            rules: this.data.rules
        })

        this.infoMessage(`${Users.get(this.data.owner)?.name} added a new rule: ${rule}`)
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

        this.infoMessage(`${Users.get(this.data.owner)?.name} removed the rule '${rule}'`)
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
        newRoom.muted = this.muted // fixes a bug that i accidentally found while seeing how annoying automod strictness 5 is

        this.mutedCountdowns.forEach(c => clearTimeout(c));
        newRoom.muted.forEach(m => newRoom.addMutedCountdown(m));

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

        if (this.data.options.allowedBots.includes(name))
            return;

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

        delete roomsReference[id]
        delete rooms.ref[id]

        // remove archive and webhooks

        if (fs.existsSync(`data/rooms/archive-${id}.json`))
            fs.unlinkSync(`data/rooms/archive-${id}.json`)

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

    quickBooleanPoll(message: string, question: string): Promise<boolean> {
        return new Promise((resolve, reject) => {

            if (this.getTempData(question) === true)
                return reject("There is already a poll of this type, please wait for it to finish")

            this.setTempData(question, true);

            this.createPollInRoom({
                message: message,
                prompt: question,
                options: ['Yes', 'No'],
                defaultOption: 'No'
            }).then(res => {
                this.clearTempData(question);
                return resolve(res === 'Yes')
            })
        })
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

    /**
     * Adds a user to the room typing list. They will be automatically removed after 1 minute
     * @param name user name to add
     * @returns true if the user was added, false if they were already on the list
     */
    addTyping(name: string): boolean {

        if (this.typing.some(i => i[0] === name))
            return false;

        const timeout = setTimeout(
            () => this.removeTyping(name), 1000 * 60
        );

        this.typing.push([name, timeout]);

        io.to(this.data.id).emit(
            "typing", this.data.id, this.typingUsers
        )

        return true;

    }

    /**
     * Removes a user from the typing list
     * @param name user name to remove
     * @returns true if removed, false if the user was not typing
     */
    removeTyping(name: string): boolean {

        const item = this.typing.find(i => i[0] === name);

        if (!item)
            return false;

        clearTimeout(item[1]);

        this.typing = this.typing.filter(i => i[0] !== name);

        io.to(this.data.id).emit(
            "typing", this.data.id, this.typingUsers
        )

        return true;

    }

    /**
     * An array of everyone in the room who is typing
     */
    get typingUsers(): string[] {
        return this.typing.map(i => i[0])
    }

    private startPollWatchers() {

        // has to be in the room class since the archive class has no access to the room :(
        for (const message of this.archive.data.ref) {

            if (!message.poll || message.poll.type === "result" || message.poll.finished || PollWatcher.getPollWatcher(this.data.id, message.id))
                continue;

            new PollWatcher(message.poll, this)

        }
    }

    /**
     * All the active polls in the room along with the userData of the user who made each poll
     */
    get activePolls(): [UserData, Poll][] {
        return PollWatcher.getActivePolls(this.data.id)
            .map(p => [Users.get(p.creator) ?? {
                name: 'System',
                email: 'n/a',
                id: 'system',
                img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png'
            }, p])
    }

    private muted: [string, number][] = [];
    private mutedCountdowns: ReturnType<typeof setTimeout>[] = [];

    /**
     * Mutes a user
     * @param userData UserData or User ID to mute
     * @param time Time to mute in minutes
     * @param mutedBy Who muted the user
     */
    mute(userId: string, time: number, mutedBy?: string): void;
    mute(userData: UserData, time: number, mutedBy?: string): void;
    mute(userData: string | UserData, time: number, mutedBy: string = "System"): void {

        const
            userId = typeof userData === "string" ? userData : userData.id,
            name = typeof userData === "string" ? Users.get(userId).name : userData.name,
            endTime = Date.now() + (time * 60 * 1000),
            session = this.sessions.getByUserID(userId);

        if (session)
            session.socket.emit("mute", this.data.id, true);

        this.infoMessage(`${name} has been muted for ${time} minute${time === 1 ? '' : 's'} by ${mutedBy}`)
        this.muted.push([userId, endTime]);
        this.removeTyping(name);

        this.addMutedCountdown([userId, endTime]);

    }

    private addMutedCountdown([userId, endTime]: [string, number]) {

        this.mutedCountdowns.push(setTimeout(() => {

            const session = this.sessions.getByUserID(userId);

            if (session)
                session.socket.emit("mute", this.data.id, false)

            this.muted = this.muted.filter(([id]) => id !== userId);

            this.infoMessage(`${Users.get(userId).name} has been unmuted.`)

        }, endTime - Date.now()));

    }

    /**
     * Checks if a user is muted
     * @param userId User ID to check
     * @returns Whether or not the user is muted
     */
    isMuted(userId: string) {
        return this.muted.map(([i]) => i).includes(userId);
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
        members: forced ? members : [owner],
        rules: [],
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