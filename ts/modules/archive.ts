/**
 * @module archive
 * @version 1.4: added queryArchive function
 * 1.3: now compatible with rooms and uses new message format
 * 1.2: added poll support
 * 1.1: added reaction support
 * 1.0: created
 */
import { Poll } from '../lib/msg';
import { UserData } from '../lib/authdata';
import get, { Data } from './data';
import Message from '../lib/msg';
import * as fs from 'fs'

/**
 * @classdesc Archive class
 * @since archive v1.0
 */
export default class Archive {
    
    data: Data<Message[]>
    private path: string;

    constructor(path: string) {
        this.data = get<Message[]>(path)
        this.path = path;
    }

    /**
     * Adds a message to the archive (also gives the message an ID if it didn't have one)
     * @param {Message} message The message to add to the archive
     * @since archive v1.0
     */
    addMessage(message: Message) {
        const data = this.data
        const archive = data.getDataReference();

        if (message.id === undefined) {
            message.id = archive.length;
            console.warn(`archive: message #${message.id} originally had no ID`)
        }

        archive.push(message);
    }

    /**
     * Deletes a message from the archive
     * @param {number} id ID of the message to delete
     * @since archive v1.0
     */
    deleteMessage(id: number): number[] | void {
        const archive = this.data.getDataReference();
        archive[id] = {
            text: `Message deleted by author`,
            author: {
                name: 'Deleted',
                id: 'Deleted',
                image: `Deleted`
            },
            time: archive[id].time,
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
        const data = this.data
        const archive = data.getDataReference();

        archive[id].text = text;

        const tag = {
            text: 'EDITED',
            color: 'white',
            bgColor: 'blue'
        }

        if (!archive[id].tags)
            archive[id].tags = [tag]
        else if (!archive[id].tags.find(t => t.text === 'EDITED'))
            archive[id].tags.push(tag)

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
        const data = this.data;
        const archive = data.getDataReference();

        if (!archive[id]) return false;
        if (!archive[id].reactions) archive[id].reactions = {};
        if (!archive[id].reactions[emoji]) archive[id].reactions[emoji] = [];

        if (archive[id].reactions[emoji].map(item => item.id).includes(user.id))
            return this.removeReaction(id, emoji, user);

        archive[id].reactions[emoji].push({ id: user.id, name: user.name })

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
        const data = this.data;
        const archive = data.getDataReference();

        if (!archive[id]) return false;
        if (!archive[id].reactions) archive[id].reactions = {};
        if (!archive[id].reactions[emoji]) return false;

        archive[id].reactions[emoji] = archive[id].reactions[emoji].filter(item => item.id !== user.id);

        if (archive[id].reactions[emoji].length === 0) delete archive[id].reactions[emoji];

        return true;
    }

    /**
     * Updates a message's poll
     * @param id ID of the message to update
     * @param poll Poll to change the message's poll to
     * @returns False if error, true if successful
     * @since archive v1.2
     */
    updatePoll(id: number, poll: Poll) {
        const data = this.data
        const archive = data.getDataReference();

        if (!archive[id]) return false;
        if (!archive[id].poll) return false;

        archive[id].poll = poll;

        return true;
    }

    getMessage(id: number): Message {

        return this.data.getDataReference()[id]

    }

    get length(): number {
        return this.data.getDataReference().length
    }

    get size(): number {
        return fs.statSync(this.path).size;
    }

    /**
     * Creates a copy of the archive matching certain criteria
     * @param start Message ID to start at (0 is 1st message sent, 1 is 2nd, etc)
     * @param count How many messages after start to include
     * @param reverse If true, a start value of 0 is last message sent, 1 is 2nd to last, etc **(DOES NOT REVERSE FINAL RESULT!!!)**
     * @returns An array of messages matching the query
     * @since archive v1.4
     */
    queryArchive(start?: number, count?: number, reverse?: boolean): Message[] {
        let archive = this.data.getDataCopy();

        if (reverse) archive = archive.reverse();
        if (typeof start !== "undefined" && count) archive = archive.filter((_, index) => !(index < start || index >= (count + start)))
        if (reverse) archive = archive.reverse() // intentional

        return archive
    }

    /**
     * Gets messages with a given media
     * @param id ID of media
     */
    getMessagesWithMedia(id: string): Message[] {
        return this.data.ref.filter(m => m.media?.location === id)
    }

    getMessagesWithReadIcon(userId: string): MessageWithReadIcons[] {
        return this.data.ref
            .filter(m => m.readIcons && m.readIcons
                ?.filter(e => e.id === userId)?.length 
            > 0) as MessageWithReadIcons[]
    }

    getLastReadMessage(userId: string): number | null {
        const messages = this.getMessagesWithReadIcon(userId)

        if (messages.length === 0)
            return null;

        return messages[messages.length - 1].id
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

        const updateIds = [ ...this.resetReadIconsFor(userData.id) ]

        // set new read icon

        updateIds.push(message.id)

        if (!message.readIcons)
            message.readIcons =  []

        message.readIcons.push(userData)

        return updateIds;

    }

}

interface MessageWithReadIcons extends Message {
    readIcons: UserData[]
}