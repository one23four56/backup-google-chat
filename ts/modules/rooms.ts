import * as crypto from 'crypto';
import * as fs from 'fs';
import get from './data';
import * as json from './json';
import Archive from './archive';
import Message from '../lib/msg';
import Webhooks, { Webhook } from './webhooks';
import SessionManager, { Session } from './session';
import { io } from '..';
import { UserData } from '../lib/authdata';

interface RoomOptions {
    webhooksAllowed: boolean
}

export interface RoomFormat {
    name: string;
    emoji: string;
    owner: string;
    members: string[];
    options: RoomOptions
    rules: string;
    id: string;
}

// check to see if it needs to make data folder
// make it if it has to

if (!fs.existsSync('data'))
    fs.mkdirSync('data')

if (!fs.existsSync('data/rooms'))
    fs.mkdirSync('data/rooms')

const rooms = get<{ [key: string]: RoomFormat }>("data/rooms.json")

const roomsReference: {
    [key: string]: Room
} = {}

export function createRoom({ name, emoji, owner, options }: { name: string, emoji: string, owner: string, options: RoomOptions }) {

    // set room id
    // i could use recursion but i am just not feeling it today

    let id: string;
    while (!id) {
        const tempId = crypto.randomBytes(16).toString('hex');
        if (!rooms.getDataReference()[tempId])
            id = tempId
    }

    const data: RoomFormat = {
        name: name,
        emoji: emoji,
        owner: owner,
        options: options,
        members: [ owner ],
        rules: "The owner has not set rules for this room yet.",
        id: id
    }

    json.write(`data/rooms/archive-${id}.json`, [])
    json.write(`data/rooms/webhook-${id}.json`, [])

    rooms.getDataReference()[id] = data

    console.log(`rooms: ${owner} created room "${name}" (id ${id})`)

    return new Room(id)
}

export function getRoomsByUserId(userId: string): Room[] {

    const roomIds: string[] = []

    for (const roomId in rooms.getDataReference()) {

        const room = rooms.getDataReference()[roomId]

        if (room.members.includes(userId))
            roomIds.push(room.id)

    }

    return roomIds.map(id => new Room(id))

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
export function checkRoom(roomId: string, userId: string): false | Room {

    if (!doesRoomExist(roomId)) return false;

    const room = roomsReference[roomId];

    if (!room.data.members.includes(userId)) return false;

    return room;

}

/**
 * @class Room
 * @classdesc Representation of a room on the server. **NOTE:
 * This object is only meant to be used to hold/modify room data. Event handlers should be in their own functions**
 */
export default class Room {

    archive: Archive;
    data: RoomFormat;
    webhooks: Webhooks;
    sessions: SessionManager;

    constructor(id: string) {

        if (!doesRoomExist(id))
            throw `rooms: room with ID "${id}" not found`

        if (roomsReference[id])
            return roomsReference[id];

        this.data = rooms.getDataReference()[id]

        this.archive = new Archive(get<Message[]>(`data/rooms/archive-${id}.json`))

        this.webhooks = new Webhooks(`data/rooms/webhook-${id}.json`, this);

        this.sessions = new SessionManager();

        roomsReference[id] = this;

        console.log(`rooms: loaded room "${this.data.name}" (${this.data.id}) from storage`)

    }

    /**
     * Logs text to console
     * @param text Text to log
     */
    private log(text: string) {
        console.log(`${this.data.id} ("${this.data.name}"): ${text}`)
    }

    addSession(session: Session) {
        
        if (!this.data.members.includes(session.userData.id)) {
            console.warn(`rooms: attempt to add session ("${session.userData.name}" / ${session.userData.id}) to room ("${this.data.name}" / ${this.data.id}) that they are not a member of`);
            return;
        }

        this.sessions.register(session)

        session.socket.join(this.data.id)

    }

    addUser(id: string) {
        this.data.members.push(id)
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
            io.emit("incoming-message", this.data.id, message)

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
            tag: {
                text: 'BOT',
                color: 'white',
                bgColor: 'black'
            },
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

        this.archive.deleteMessage(id);

        if (dispatch)
            io.to(this.data.id).emit("message-deleted", this.data.id, id);

        this.log(`${message.author.name} deleted message #${message.id} ${dispatch ? `` : `(not dispatched)`}`)
    }

    addWebhook(name: string, image: string, isPrivate: boolean, creator: UserData) {
        this.webhooks.create({name, image, isPrivate, owner: creator.id})

        this.infoMessage(`${creator.name} created the${isPrivate ? ' private' : ''} webhook '${name}'`)

        io.to(this.data.id).emit("webhook data", this.data.id, this.webhooks.getWebhooks())

        this.log(`${creator.name} created webhook '${name}' (${isPrivate? 'private' : 'public'})`)
    }

    editWebhook(webhook: Webhook, name: string, image: string, editor: UserData) {        
        this.infoMessage(`${editor.name} updated the${webhook.private ? ' private' : ''} webhook '${webhook.name}' to '${name}'`)

        webhook.update(name, image);

        io.to(this.data.id).emit("webhook data", this.data.id, this.webhooks.getWebhooks())

        this.log(`${editor.name} updated webhook '${webhook.name}' (${webhook.private? 'private' : 'public'})`)
    }

    deleteWebhook(webhook: Webhook, deleter: UserData) {

        this.infoMessage(`${deleter.name} deleted the${webhook.private ? ' private' : ''} webhook '${webhook.name}'`)

        webhook.remove();
        
        io.to(this.data.id).emit("webhook data", this.data.id, this.webhooks.getWebhooks())

        this.log(`${deleter.name} deleted webhook '${webhook.name}' (${webhook.private? 'private' : 'public'})`)
    }
}