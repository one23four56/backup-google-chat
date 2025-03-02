import * as fs from 'fs';
import get, { Data } from './data';
import Archive, { UnreadInfo } from './archive';
import SessionManager, { Session } from './session';
import AutoMod from './autoMod';
import Share from './mediashare';
import { Users } from './users';
import { MemberUserData } from '../lib/misc';
import Message, { Poll } from '../lib/msg';
import { io } from '..';
import { createPoll, PollWatcher } from './polls';
import { OnlineUserData, UserData } from '../lib/authdata';
import * as json from './json';
import { RoomOptions } from '../lib/options';

// check to see if it needs to make data folder
// make it if it has to

if (!fs.existsSync('data'))
    fs.mkdirSync('data')

if (!fs.existsSync('data/rooms'))
    fs.mkdirSync('data/rooms')

export interface ChannelFormat {
    members: string[];
    id: string;
    type?: string;
}

export const channels = get<Record<string, ChannelFormat>>("data/rooms.json")
channels.blockSleep(1); // token doesn't matter

export const channelReference: Record<string, Channel> = {}

export function doesChannelExist(id: string) {

    if (!channels.ref[id]) return false;

    if (
        (!fs.existsSync(`data/rooms/${id}`) || !fs.existsSync(`data/rooms/${id}/archive`))
        && !fs.existsSync(`data/rooms/archive-${id}.json`)
    )
        return false;

    return true;

}

interface CreatePollInRoomSettings {
    message: string;
    prompt: string;
    options: string[];
    defaultOption: string;
    time?: number;
}

export default abstract class Channel {

    archive: Archive;
    data: ChannelFormat;
    sessions: SessionManager;
    abstract autoMod: AutoMod;
    abstract share: Share;    
    abstract options: RoomOptions;

    private tempData: {
        [key: string]: any;
    } = {};

    private typing: [string, ReturnType<typeof setTimeout>][] = [];

    protected readData: Data<Record<string, number>>;

    constructor(id: string) {

        if (!doesChannelExist(id))
            throw `channels: channels with ID "${id}" not found`

        if (channelReference[id])
            return channelReference[id];

        this.data = channels.ref[id];

        if (fs.existsSync(`data/rooms/archive-${id}.json`) &&
            !fs.existsSync(`data/rooms/${id}/archive`))
            this.convertToSegmentedArchive();

        this.archive = new Archive(`data/rooms/${id}/archive/`)

        this.startPollWatchers();

        this.sessions = new SessionManager();

        this.readData = get(`data/rooms/${id}/lastRead.json`);

        channelReference[id] = this;

        console.log(`channels: loaded channel ${this.data.id} (${this.data.type ?? "unknown"}) from storage`)

    }

    /**
     * Logs text to console
     * @param text Text to log
     */
    protected log(text: string) {
        console.log(`channels: ${this.data.id}: ${text}`)
    }

    addSession(session: Session) {

        if (!this.data.members.includes(session.userData.id)) {
            console.warn(`rooms: attempt to add session ("${session.userData.name}" / ${session.userData.id}) to channel (${this.data.id}) that they are not a member of`);
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

    abstract isMember(id: string): boolean 

    /**
     * Gets room members as a UserData array
     * @returns Members as a UserData array
     */
    abstract getMembers(): MemberUserData[];

    abstract isMuted(id: string): boolean;

    /**
     * Handles a message by saving and dispatching it (saving and dispatching are optional)
     * @param message Message to use
     * @param save Whether or not to add message to archive
     * @param dispatch Whether or not to dispatch message to clients
     * @returns id of sent message
     */
    message(message: Message, save: boolean = true, dispatch: boolean = true): number {

        message.id = this.archive.length;

        if (save)
            this.archive.addMessage(message);
        else
            message.notSaved = true;

        if (dispatch)
            io.to(this.data.id).emit("incoming-message", this.data.id, message)

        this.log(`Message #${message.id} from ${message.author.name}: ${message.text} (${save && dispatch ? `defaults` : `save: ${save}, dispatch: ${dispatch}`})`)

        return message.id;
    }

    /**
     * Shorthand function for sending a message as the info bot
     * @param text Message text
     * @param [send=true] Whether or not to send the message
     */
    infoMessage(text: string, send: boolean = true) {
        const message: Message = {
            text: text,
            author: {
                name: "Info",
                image: "/public/info.svg",
                id: 'bot'
            },
            time: new Date(new Date().toUTCString()),
            tags: [{
                text: "BOT",
                color: 'white',
                bgColor: 'black',
                icon: 'fa-solid fa-gear'
            }],
            id: this.archive.length,
        }

        if (send) this.message(message);
        
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

            const index = findLatestMessageBefore(message.id);
            message.readIcons.forEach(u => this.readMessage(u, index));

            io.to(this.data.id).emit("bulk message updates", this.data.id, [this.archive.getMessage(index)])
        }


        this.archive.deleteMessage(message.id);

        if (dispatch)
            io.to(this.data.id).emit("message-deleted", this.data.id, id);

        this.log(`${message.author.name} deleted message #${message.id} ${dispatch ? `` : `(not dispatched)`}`)
    }

    /**
     * Creates a custom system poll in this room.
     * @param param0 Options for the poll to add
     * @returns A promise that will resolve with the winner as a string
     */
    createPollInRoom({ message, prompt, options, defaultOption, time }: CreatePollInRoomSettings): Promise<string> {

        const poll = createPoll("Info", this.archive.length, {
            expires: Date.now() + (time ?? (1000 * 60 * 5)),
            options,
            question: prompt
        })

        const defaultOpt = poll.options.find(o => o.option === defaultOption)

        if (defaultOpt) {
            defaultOpt.voters = ["System"];
            defaultOpt.votes = 1;
        }

        const msg = this.infoMessage(message, false);
        msg.poll = poll;

        return new Promise<string>(resolve => {
            new PollWatcher(this.message(msg), this).addPollEndListener(winner => resolve(winner))
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
    abstract getOnlineLists(): [OnlineUserData[], OnlineUserData[], OnlineUserData[]]

    broadcastOnlineListToRoom() {
        io.to(this.data.id).emit(
            "online list",
            this.data.id,
            ...this.getOnlineLists()
        );
    }

    quickBooleanPoll(message: string, question: string, time?: number): Promise<boolean> {
        return new Promise((resolve, reject) => {

            if (this.getTempData(question) === true)
                return reject("There is already a poll of this type, please wait for it to finish")

            this.setTempData(question, true);

            this.createPollInRoom({
                message, time,
                prompt: question,
                options: ['Yes', 'No'],
                defaultOption: 'No',
            }).then(res => {
                this.clearTempData(question);
                return resolve(res === 'Yes')
            })
        })
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
        for (const message of this.archive.messageRef()) {

            if (!message.poll || message.poll.type === "result" || message.poll.finished || PollWatcher.getPollWatcher(this.data.id, message.id))
                continue;

            new PollWatcher(message.id, this)

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
                img: '/public/info.svg'
            }, p])
    }

    get historicPolls(): [UserData, Poll, number][] {
        const out: [UserData, Poll, number][] = [];

        for (const message of this.archive.messageRef(true)) {
            if (!message.poll) continue;
            if (message.poll.type === "result") continue;
            if (!message.poll.finished) continue;

            out.push([Users.get(message.author.id) ?? {
                name: 'System',
                email: 'n/a',
                id: 'system',
                img: '/public/info.svg'
            }, message.poll, Date.parse(message.time as any)])

            if (out.length >= 10) break;
        }

        return out;
    }

    private convertToSegmentedArchive() {

        const path = `data/rooms/${this.data.id}/archive/`

        if (!fs.existsSync(`data/rooms/${this.data.id}`))
            fs.mkdirSync(`data/rooms/${this.data.id}`);

        if (!fs.existsSync(path))
            fs.mkdirSync(path);

        const archive: Message[] = json.read(`data/rooms/archive-${this.data.id}.json`)

        let segments = 0
        let messages: Message[] = [];
        for (const [index, message] of archive.entries()) {
            messages.push(message);

            if ((index + 1) % 1000 !== 0) continue;

            json.write(`${path}archive-${segments}`, messages)
            messages = [];
            segments++;
        }

        json.write(`${path}archive-${segments}`, messages)

    }

    /**
     * Marks a message as read for a user
     * @param userData User Data of user who read message
     * @param id Message ID to read
     * @param newUser Specify `true` if the user is new to the room
     * @returns Array of messages to update, or string if there was an error
     */
    readMessage(userData: UserData, id: number) {
        const old = this.readData.ref[userData.id];
        this.readData.ref[userData.id] = id;

        return this.archive.readMessage(userData, id, old);
    }

    getLastRead(userId: string) {
        const read = this.readData.ref[userId];
        if (typeof read === "number") return read;

        const lastRead = this.archive.getLastReadMessage(userId);
        if (typeof lastRead === "number") this.readMessage(Users.get(userId), lastRead);
        else this.readData.ref[userId] = -1;

        return this.getLastRead(userId);
    }

    getUnreadInfo(id: string): UnreadInfo {
        const lastRead = this.getLastRead(id) ?? -1;
        const recent = this.archive.mostRecentMessageId;
        const recentMessage = this.archive.getMessage(recent);
        const time = recentMessage ? Date.parse(recentMessage.time.toString()) : 0;

        return {
            unread: recent > lastRead,
            unreadCount: recent - lastRead,
            lastRead, time
        }

    }
}