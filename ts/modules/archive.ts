/**
 * @module archive
 * @version 1.4: added queryArchive function
 * 1.3: now compatible with rooms and uses new message format
 * 1.2: added poll support
 * 1.1: added reaction support
 * 1.0: created
 */
import { UserData } from '../lib/authdata';
import get, { Data } from './data';
import Message from '../lib/msg';
import * as fs from 'fs'

/**
 * @classdesc Archive class
 * @since archive v1.0
 */
export default class Archive {

    // data: Data<Message[]>
    segments: Data<Message[]>[] = [];
    private path: string;

    constructor(path: string) {

        if (!path.endsWith("/"))
            throw new Error(`archive: path "${path}" does not end in "/"`)

        let dir = fs.readdirSync(path);
        dir = dir.filter(i => !i.endsWith(".backup"))
        dir = dir.sort((a, b) => Number(a.replace("archive-", "")) - Number(b.replace("archive-", "")));

        for (const item of dir)
            this.segments.push(get(path + item))

        this.path = path;

        if (this.segments.length === 0)
            this.initNewSegment();

        // for (let message of this.data.ref) {
        //     const modernized = modernizeMessage(message)

        //     if (modernized)
        //         message = modernized;

        // }

    }

    private initNewSegment() {
        const segment = get<Message[]>(`${this.path}archive-${this.segments.length}`, true, "[]");
        this.segments.push(segment);
        return segment;
    }

    get lastSegment() {
        return this.lastSegmentData.ref;
    }

    get lastSegmentData() {
        return this.segments[this.segments.length - 1];
    }

    /**
     * Adds a message to the archive (also gives the message an ID if it didn't have one)
     * @param {Message} message The message to add to the archive
     * @since archive v1.0
     */
    addMessage(message: Message) {

        if (this.lastSegment.length >= 1000)
            this.initNewSegment();

        if (message.id === undefined) {
            message.id = this.length;
            console.warn(`archive: message #${message.id} originally had no ID`)
        }

        this.lastSegment.push(message);
    }

    /**
     * get the segment that a message is in from its id
     * @param id message id
     * @returns segment, or null if the segment does not exist
     */
    private getSegmentFromId(id: number): Data<Message[]> | null {
        const segmentNumber = Math.floor(id / 1000);
        return this.segments[segmentNumber] ?? null;
    }

    /**
     * Deletes a message from the archive
     * @param {number} id ID of the message to delete
     * @since archive v1.0
     */
    deleteMessage(id: number): number[] | void {
        const segment = this.getSegmentFromId(id);
        if (!segment) return;

        segment.ref[id % 1000] = {
            text: `Message deleted by author`,
            author: {
                name: 'Deleted',
                id: 'Deleted',
                image: `Deleted`
            },
            time: segment.ref[id % 1000].time,
            id: id,
            tags: [{
                text: 'DELETED',
                color: 'white',
                bgColor: 'red'
            }],
            deleted: true,
        }

    }

    /**
     * Updates a message
     * @param {number} id ID of the message to update
     * @param {string} text Text to replace the message with
     * @since archive v1.0
     */
    updateMessage(id: number, text: string) {
        const segment = this.getSegmentFromId(id);
        if (!segment) return;

        segment.ref[id % 1000].text = text;

        const tag = {
            text: 'EDITED',
            color: 'white',
            bgColor: 'blue'
        }

        if (!segment.ref[id % 1000].tags)
            segment.ref[id % 1000].tags = [tag]
        else if (!segment.ref[id % 1000].tags.find(t => t.text === 'EDITED'))
            segment.ref[id % 1000].tags.push(tag)

    }

    /**
     * Adds a reaction to a message, or remove it if it is already there
     * @param {number} id Message ID to add reaction to
     * @param {string} emoji Reaction to add
     * @param {UserData} user UserData of the user who reacted
     * @returns {boolean} True if reaction was added, false if not
     * @since archive v1.1
     */
    addReaction(id: number, emoji: string, user: UserData) {
        const segment = this.getSegmentFromId(id);
        if (!segment) return;

        if (!segment.ref[id % 1000]) return false;
        if (!segment.ref[id % 1000].reactions) segment.ref[id % 1000].reactions = {};
        if (!segment.ref[id % 1000].reactions[emoji]) segment.ref[id % 1000].reactions[emoji] = [];

        if (segment.ref[id % 1000].reactions[emoji].map(item => item.id).includes(user.id))
            return this.removeReaction(id, emoji, user);

        segment.ref[id % 1000].reactions[emoji].push({ id: user.id, name: user.name })

        return true;

    }

    /**
     * Removes a reaction from a message (called from addReaction)
     * @param {number} id Message ID to remove reaction from
     * @param {string} emoji Reaction to remove
     * @param {UserData} user UserData of the user who reacted
     * @returns {boolean} True if reaction was removed, false if not
     */
    removeReaction(id: number, emoji: string, user: UserData) {
        const segment = this.getSegmentFromId(id);
        if (!segment) return;

        if (!segment.ref[id % 1000]) return false;
        if (!segment.ref[id % 1000].reactions) segment.ref[id % 1000].reactions = {};
        if (!segment.ref[id % 1000].reactions[emoji]) return false;

        segment.ref[id % 1000].reactions[emoji] = segment.ref[id % 1000].reactions[emoji].filter(item => item.id !== user.id);

        if (segment.ref[id % 1000].reactions[emoji].length === 0) delete segment.ref[id % 1000].reactions[emoji];

        return true;
    }

    getMessage(id: number): Message {
        return this.getSegmentFromId(id)?.ref[id % 1000];
    }

    get length(): number {
        return (this.segments.length - 1) * 1000 + this.lastSegment.length;
        // total # of segments - 1 (last segment) times 1000 (max msg per segment) + length of 
        // last segment (not guaranteed to be 1000)
    }

    get size(): number {
        return fs.readdirSync(this.path)
            .filter(m => !m.endsWith(".backup"))
            .map(m => fs.statSync(this.path + m).size)
            .reduce((a, b) => a + b);
    }

    /**
     * Gets messages with a given media
     * @param id ID of media
     */
    getMessagesWithMedia(id: string): Message[] {
        return this.findMessages(m => m.media && m.media.find(e => e.location === id))
    }

    getMessagesWithReadIcon(userId: string): MessageWithReadIcons[] {
        return this.findMessages(m => m.readIcons && m.readIcons
            ?.filter(e => e.id === userId)?.length
            > 0) as MessageWithReadIcons[]
    }

    private getLastReadMessage(userId: string): number | null {
        const messages = this.getMessagesWithReadIcon(userId)

        if (messages.length === 0)
            return null;

        return messages[messages.length - 1].id
    }

    getUnreadInfo(userId: string): UnreadInfo {

        const lastRead = this.getLastReadMessage(userId) ?? -1;

        const time = this.getMessage(this.mostRecentMessageId) ?
            Date.parse(this.getMessage(this.mostRecentMessageId).time.toString()) :
            0

        if (this.mostRecentMessageId > lastRead)
            return {
                unread: true,
                lastRead,
                unreadCount: this.mostRecentMessageId - lastRead,
                time
            }

        return {
            unread: false,
            lastRead,
            unreadCount: 0,
            time
        }
    }

    /**
     * The ID of the most recently sent message
     */
    get mostRecentMessageId(): number {
        for (const message of this.messageRef(true))
            if (!message.deleted) return message.id;

        return -1; // no messages
    }

    /**
     * Resets the read icons for a user
     * @param userId User ID to reset for
     * @returns An array of the IDs of every message that was updated
     */
    resetReadIconsFor(userId: string): number[] {

        const updateIds: number[] = [];

        this.getMessagesWithReadIcon(userId).forEach(m => {

            updateIds.push(m.id)

            m.readIcons = m.readIcons.filter(u => u.id !== userId)

            if (m.readIcons.length <= 0)
                delete m.readIcons

        })

        return updateIds;

    }

    /**
     * Adds a read icon to a message
     * @param userData User who read the message
     * @param messageId Message ID
     * @returns An array of the IDs of every updated message, OR, if the operation failed, a string with the reason for failure
     */
    readMessage(userData: UserData, messageId: number): number[] | string {

        // check id

        if (messageId < this.getLastReadMessage(userData.id))
            return `${messageId} is less than ${userData.name}'s last read message ID`;

        // check message

        const message = this.getMessage(messageId)

        if (!message)
            return `Message ${messageId} does not exist`

        // reset read message icons 

        const updateIds = [...this.resetReadIconsFor(userData.id)]

        // set new read icon

        updateIds.push(message.id)

        if (!message.readIcons)
            message.readIcons = []

        message.readIcons.push(userData)

        return updateIds;

    }

    /**
     * returns an iterable object that iterates over all messages
     * @param reverse whether or not to iterate backwards
     * @param start **segment** number to start at (**not message ID**)
     */
    *messageRef(reverse: boolean = false, start?: number) {
        const time = Date.now(); // for sleep blocking token
        // the below is kinda complicated, so basically:
        // if not reversed: slice(start)
        // if reversed: slice(0, start + 1) (end not included by slice, so + 1)
        // this is b/c reversed makes the start into the end
        const segments = this.segments.slice(reverse ? 0 : start ?? 0, reverse ? start + 1 || undefined : undefined);
        if (reverse) segments.reverse();

        for (const segment of segments) {
            segment.blockSleep(time);

            for (const message of (reverse ? segment.ref.slice().reverse() : segment.ref))
                yield message;

            segment.unblockSleep(time, true);
        }
    }

    *messageCopy() {
        for (const segment of this.segments)
            for (const message of segment.copy)
                yield message;
    }

    findMessages(criteria: (message: Message) => any): Message[] {
        const messages: Message[] = [];

        for (const message of this.messageRef())
            if (criteria(message)) messages.push(message);

        return messages;
    }

}

interface MessageWithReadIcons extends Message {
    readIcons: UserData[]
}

export interface UnreadInfo {
    unread: boolean;
    lastRead: number;
    unreadCount: number;
    time: number;
}

/**
 * Converts a message to the new format
 * @param message message to modernize
 */
function modernizeMessage(message: Message): Message | false {

    let changed = false;

    // media modernizer
    if (message.media && !Array.isArray(message.media)) {
        message.media = [message.media]
        changed = true;
    }

    if (changed)
        return message;

    return false;

}