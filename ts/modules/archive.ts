/**
 * @module archive
 * @version 1.3: now compatible with rooms and uses new message format
 * 1.2: added poll support
 * 1.1: added reaction support
 * 1.0: created
 */
import { Poll } from '../lib/msg';
import { UserData } from '../lib/authdata';
import get, { Data } from './data';
import Message from '../lib/msg';

/**
 * @classdesc Archive class
 * @since archive v1.0
 */
export default class Archive {
    
    data: Data<Message[]>

    constructor(data: Data<Message[]>) {
        this.data = data
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
    deleteMessage(id: number) {
        const data = this.data
        const archive = data.getDataReference();
        archive[id] = {
            text: `Message deleted by author`,
            author: {
                name: 'Deleted',
                id: 'Deleted',
                image: `Deleted`
            },
            time: archive[id].time,
            id: id,
            tag: {
                text: 'DELETED',
                color: 'white',
                bgColor: 'red'
            }
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
        archive[id].tag = {
            text: 'EDITED',
            color: 'white',
            bgColor: 'blue'
        }

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
}