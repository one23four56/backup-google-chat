/**
 * @module archive
 * @version 1.0: created
 */
import * as json from './json';
import Message from '../lib/msg';

/**
 * @classdesc Archive class
 * @hideconstructor
 * @since archive v1.0
 */
export class Archive {
    /**
     * Gets the archive json
     * @returns {Message[]} The archive json
     * @since archive v1.0
     */
    static getArchive(): Message[] {
        return json.read('messages.json');
    }

    /**
     * Adds a message to the archive (also gives the message an ID if it didn't have one)
     * @param {Message} message The message to add to the archive
     * @since archive v1.0
     */
    static addMessage(message: Message) {
        const archive = Archive.getArchive();

        if (message.id === undefined) 
            message.id = archive.length;

        archive.push(message);
        json.write('messages.json', archive);
    }

    /**
     * Deletes a message from the archive
     * @param {number} id ID of the message to delete
     * @since archive v1.0
     */
    static deleteMessage(id: number) {
        let archive = Archive.getArchive();
        archive[id] = {
            text: `Message deleted by author`,
            author: {
                name: 'Deleted',
                img: `Deleted`
            },
            time: archive[id].time,
            id: id,
            tag: {
                text: 'DELETED',
                color: 'white',
                bg_color: 'red'
            }
        }
        json.write('messages.json', archive);
    }

    /**
     * Updates a message
     * @param {number} id ID of the message to update
     * @param {string} text Text to replace the message with
     * @since archive v1.0
     */
    static updateMessage(id: number, text: string) {
        let archive = Archive.getArchive();
        archive[id].text = text;
        archive[id].tag = {
            text: 'EDITED',
            color: 'white',
            bg_color: 'blue'
        }
        json.write('messages.json', archive);
    }
}