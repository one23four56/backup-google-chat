/**
 * @module archive
 * @version 1.0: created
 */
import * as json from './json';
import Message from '../lib/msg';

export class Archive {
    /**
     * Gets the archive json
     * @returns {Message[]} The archive json
     * @since archive v1.0
     */
    static getArchive(): Message[] {
        return json.read('messages.json');
    }

    static addMessage(message: Message) {
        const archive = Archive.getArchive();
        archive.push(message);
        json.write('messages.json', archive);
    }

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