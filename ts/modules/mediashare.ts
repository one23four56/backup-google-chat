import * as fs from 'fs'
import * as crypto from 'crypto'
import get, { Data } from './data';
import { AllowedTypes } from '../lib/socket';

// check to see if it needs to make data folder
// make it if it has to

if (!fs.existsSync('data'))
    fs.mkdirSync('data')

if (!fs.existsSync('data/shares'))
    fs.mkdirSync('data/shares')

export interface LedgerItem {
    time: number;
    user: string;
    id: string;
    type: string;
    hash: string;
}

export interface BufferLedgerItem extends LedgerItem {
    buffer: Buffer;
}

export default class Share {

    private path: string;
    ledger: Data<Record<string, LedgerItem>>
    id: string;
    

    constructor(id: string) {

        this.id = id;

        this.path = `data/shares/${id}`

        if (!fs.existsSync(this.path))
            fs.mkdirSync(this.path)

        this.ledger = get(`${this.path}/ledger.json`, true, "{}")

    }

    get size(): number {

        let size: number = 0;
        
        for (const id in this.ledger.ref) {

            if (fs.existsSync(`${this.path}/${id}.bgcms`))
                size += fs.statSync(`${this.path}/${id}.bgcms`).size

        }

        size += fs.statSync(`${this.path}/ledger.json`).size

        return size;
    }

    /**
     * Adds media to the share
     * @param buffer Buffer of media to add
     * @param type Media type
     * @param userId User who is adding the media
     * @returns Media ID
     */
    async add(buffer: Buffer, type: string, userId: string): Promise<string> {

        if (!AllowedTypes.includes(type))
            return;

        // create hash

        const hashSum = crypto.createHash('sha256')

        hashSum.update(buffer)

        const hash = hashSum.digest("base64")

        // check hash

        for (const checkId in this.ledger.ref) {

            if (this.ledger.ref[checkId].hash === hash) {
                console.log(`mediashare: duplicate file uploaded (hash ${hash}), sent original file ${checkId}`)
                return checkId;
            }

        }

        // generate new id

        const id = await new Promise<string>((resolve, reject) => {
            let noId = true;
            while (noId) {
                const tempId = crypto.randomBytes(16).toString('hex');
                if (!fs.existsSync(this.path + "/" + tempId)) {
                    noId = false;
                    resolve(tempId)
                }
            }
        })

        // create ledger item

        const item: LedgerItem = {
            id, type, hash,
            time: Date.now(),
            user: userId
        }

        this.ledger.ref[id] = item;

        // write bytes to file

        fs.writeFileSync(`${this.path}/${id}.bgcms`, buffer)
        // .bgcms = backup google chat media store
        // fancy, i know

        console.log(`mediashare: file ${id}.bgcms with hash '${hash}' added to share ${this.id}`)

        return id;


    }

    /**
     * Adds a blob to the share
     * @param blob Blob to add
     * @param userId User who is adding it
     * @returns A promise containing the added media's id
     */
    async addFromBlob(blob: Blob, userId: string): Promise<string> {
        const rawBytes = await blob.arrayBuffer();
        const buffer = Buffer.from(rawBytes)

        return this.add(buffer, blob.type, userId)
    }

    /**
     * Gets an item from the share as a buffer
     * @param id ID of item to get
     * @returns The item, as a buffer
     */
    async getBuffer(id: string): Promise<Buffer | false> {

        // check file

        const item = this.ledger.ref[id]

        if (!item || !fs.existsSync(`${this.path}/${id}.bgcms`))
            return false;

        // read into buffer

        const buffer = fs.readFileSync(`${this.path}/${id}.bgcms`)

        return buffer;

    }

    /**
     * Gets the data and buffer of an item in the share in BufferLedgerItem format
     * @param id ID of item to get
     * @returns The item data and buffer in a BufferLedgerItem format
     */
    async getData(id: string): Promise<BufferLedgerItem | false> {

        // check file

        const item = this.ledger.ref[id]

        if (!item || !fs.existsSync(`${this.path}/${id}.bgcms`))
            return false;

        const buffer =await this.getBuffer(id)

        if (!buffer)
            return false;

        return {
            buffer,
            hash: item.hash,
            id: item.id,
            time: item.time,
            type: item.type,
            user: item.user
        }

    }

    getItemSize(id: string): number {
        if (!fs.existsSync(`${this.path}/${id}.bgcms`))
            return 0;

        return fs.statSync(`${this.path}/${id}.bgcms`).size
    }

    doesItemExist(id: string): boolean {
        const item = this.ledger.ref[id]

        if (!item || !fs.existsSync(`${this.path}/${id}.bgcms`))
            return false;

        return true;
    }

}