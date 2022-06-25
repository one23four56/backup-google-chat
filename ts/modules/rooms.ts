import * as crypto from 'crypto';
import * as fs from 'fs';
import get, { Data } from './data';
import * as json from './json';
import Archive from './archive';
import Message from '../lib/message';

interface RoomOptions {
    webhooksAllowed: boolean
}

interface RoomFormat {
    name: string;
    emoji: string;
    owner: string;
    members: string[];
    options: RoomOptions
    rules: string;
    id: string;
}

const rooms = get<{ [key: string]: RoomFormat }>("data/rooms.json", true, "{}")

export function createRoom({ name, emoji, owner, options }: { name: string, emoji: string, owner: string, options: RoomOptions }) {

    // check to see if it needs to make data folder
    // make it if it has to

    if (!fs.existsSync('data'))
        fs.mkdirSync('data')
    
    if (!fs.existsSync('data/rooms'))
        fs.mkdirSync('data/rooms')

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

    json.write(`data/rooms/${id}.json`, [])

    rooms.getDataReference()[id] = data

    console.log(`${owner} created room "${name}" (id ${id})`)

    return new Room(id)
}

export default class Room {

    archive: Archive;
    data: RoomFormat;

    constructor(id: string) {

        if (!rooms.getDataReference()[id] || !fs.existsSync(`data/rooms/${id}.json`))
            throw `rooms: Room with ID "${id}" not found`

        this.data = rooms.getDataReference()[id]

        this.archive = new Archive(get<Message[]>(`data/rooms/${id}.json`))

    }
}