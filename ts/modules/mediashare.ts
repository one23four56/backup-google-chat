import * as fs from 'fs'
import * as crypto from 'crypto'
import get, { Data } from './data';
import { AllowedTypes, CompressTypes } from '../lib/socket';
import * as zlib from 'zlib';
import * as path from 'path';

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
    name?: string;
    size?: number;
    encoding?: "br";
    compression?: string;
}

export interface BufferLedgerItem extends LedgerItem {
    buffer: Buffer;
}

export interface UploadData {
    name?: string;
    type: string;
    id?: string;
    keep?: boolean;
}

export interface ShareOptions {
    maxFileSize: number;
    readonly maxShareSize: number;
    canView: boolean | string[];
    canUpload: boolean | string[];
    autoDelete: boolean;
    indexPage: boolean;
}

const defaultOptions: ShareOptions = {
    maxFileSize: 5e6,
    maxShareSize: 2e8,
    canUpload: false,
    canView: false,
    autoDelete: true,
    indexPage: true
}

const shareRef: Record<string, Share> = {};

export default class Share {

    private path: string;
    ledger: Data<Record<string, LedgerItem>>;
    id: string;
    private optionsData: Data<ShareOptions>;


    constructor(id: string, options?: ShareOptions) {

        this.id = id;

        this.path = `data/shares/${id}`

        if (!fs.existsSync(this.path))
            fs.mkdirSync(this.path)

        this.ledger = get(`${this.path}/ledger.json`, true, "{}");
        this.optionsData = get(`${this.path}/options.json`, true, JSON.stringify(defaultOptions))

        if (options)
            this.optionsData.ref = options;

        // // modernize if needed
        // this.modernize();

        shareRef[this.id] = this;

    }

    private _size: number;
    private _sizeChanged: boolean = true;

    get size(): number {

        if (!this._sizeChanged)
            return this._size;

        let size: number = 0;

        for (const id in this.ledger.ref)
            size += this.getItemSize(id);

        this._size = size;
        this._sizeChanged = false;

        return size;
    }

    /**
     * Adds media to the share
     * @param buffer Buffer of media to add
     * @param type Media type
     * @param userId User who is adding the media
     * @returns Media ID
     */
    async add(buffer: Buffer, data: UploadData, userId: string): Promise<string> {

        const { type, name } = data;

        if (!AllowedTypes.includes(type))
            return;

        // create hash

        const hash = Share.computeHash(buffer);

        // check hash

        const duplicate = data.keep ? false : this.matchHash(hash);

        if (duplicate) {
            console.log(`mediashare: duplicate file uploaded (hash ${hash}), sent original file ${duplicate}`)
            return duplicate;
        }

        // generate new id
        const id = data.id ?? this.generateID();

        // create ledger item
        const item: LedgerItem = {
            id, type, hash,
            time: Date.now(),
            user: userId,
        }

        if (name)
            item.name = name;

        this.ledger.ref[id] = item;

        // compress and write bytes to file
        const compress = CompressTypes.includes(type);
        const file = compress ? zlib.brotliCompressSync(buffer) : buffer;

        if (compress) {
            item.encoding = "br";
            item.compression =
                `Brotili, ${Math.round((1 - file.length / buffer.length) * 100)}% size reduction`;
        }

        fs.writeFileSync(`${this.path}/${id}.bgcms`, file)
        // .bgcms = backup google chat media store
        // fancy, i know

        this._sizeChanged = true;

        // remove from upload list
        this.removeFromUploadList(id);

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

        return this.add(buffer, { type: blob.type }, userId)
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

        const buffer = await this.getBuffer(id)

        if (!buffer)
            return false;

        return {
            buffer,
            hash: item.hash,
            id: item.id,
            time: item.time,
            type: item.type,
            user: item.user,
            name: item.name,
            encoding: item.encoding,
            compression: item.compression
        }

    }

    getItemSize(id: string): number {

        if (this.ledger.ref[id].size)
            return this.ledger.ref[id].size;

        if (!fs.existsSync(`${this.path}/${id}.bgcms`))
            return 0;

        const size = fs.statSync(`${this.path}/${id}.bgcms`).size;

        this.ledger.ref[id].size = size;

        return size;
    }

    doesItemExist(id: string): boolean {
        const item = this.ledger.ref[id]

        if (!item || !fs.existsSync(`${this.path}/${id}.bgcms`))
            return false;

        return true;
    }

    remove(id: string) {

        // remove from ledger
        if (this.ledger.ref[id])
            delete this.ledger.ref[id];

        // remove file
        if (fs.existsSync(`${this.path}/${id}.bgcms`))
            fs.unlinkSync(`${this.path}/${id}.bgcms`)

        this._sizeChanged = true;

        console.log(`mediashare: ${id} removed from share ${this.id}`)

    }

    get firstItemId(): string {
        const values = Object.values(this.ledger.ref)

        values.sort((a, b) => a.time - b.time)

        return values[0].id
    }

    /**
     * The largest file in the share
     */
    get largestFile(): LedgerItem | undefined {
        return Object.values(this.ledger.ref)
            .sort((a, b) => this.getItemSize(b.id) - this.getItemSize(a.id))[0]
    }

    get options(): ShareOptions {
        return this.optionsData.ref;
    }

    canView(userId: string): boolean {
        if (Array.isArray(this.options.canView))
            return this.options.canView.includes(userId);

        return this.options.canView;
    }

    canUpload(userId: string): boolean {
        if (Array.isArray(this.options.canUpload))
            return this.options.canUpload.includes(userId);

        return this.options.canUpload;
    }

    /**
     * Remove from global share reference
     */
    dereference() {
        this.ledger.dereference();
        this.optionsData.dereference();
        delete shareRef[this.id];
    }

    /**
     * Get a share by ID
     * @param id ID to get
     * @returns Share or undefined
     */
    static get(id: string) {
        return shareRef[id];
    }

    /**
     * Computes a sha256 hash for a buffer
     * @param buffer Buffer to use
     * @returns sha256 hash
     */
    static computeHash(buffer: Buffer): string {
        const hashSum = crypto.createHash('sha256');
        hashSum.update(buffer);
        return hashSum.digest("hex");
    }

    /**
     * Checks if the share has an item with a given hash
     * @param hash hash to check
     * @returns ID of item w/ same hash, or false if none found
     */
    matchHash(hash: string): string | false {
        for (const id in this.ledger.ref)
            if (this.ledger.ref[id].hash === hash)
                return id;

        return false;
    }

    /**
     * Generates a random, unique ID for media
     * @returns A new, unique ID
     */
    generateID(): string {
        const id = crypto.randomBytes(16).toString('hex');

        if (fs.existsSync(this.path + "/" + id))
            return this.generateID();

        return id;
    }

    static formatName(name: string): string {
        return name.trim().length > 0 ?
            path.parse(name).name // get file name
                .slice(0, 50) // limit max name length to 50 chars
                // clean up the name to make it easier to read, not really necessary but idc
                .replace(/ |_|\/|\(|\)|\.|,/g, "-")
                .toLowerCase()
            : `media`

    }

    private uploadList: Record<string, ReturnType<typeof setTimeout>> = {};

    addToUploadList(id: string) {
        this.uploadList[id] = setTimeout(() => this.removeFromUploadList(id), 5 * 60 * 1000);
    }

    isUploading(id: string) {
        return typeof this.uploadList[id] !== "undefined";
    }

    private removeFromUploadList(id: string) {
        clearTimeout(this.uploadList[id]);
        delete this.uploadList[id];
    }

    private _modernize() {

        // i made this to automatically compress all old files
        // but that ending up using up way too much resources
        // so i ended up not using this, but i don't want
        // to get rid of it just in case it is needed in the future
        // so for now i'll just keep it and put an underscore in front 
        // of the name

        // update this string to something different for each revision that requires modernization
        const current = "rev_1"

        const version = fs.existsSync(`${this.path}/meta_mediashare_version`) ?
            fs.readFileSync(`${this.path}/meta_mediashare_version`, 'utf-8') : "";

        if (version === current)
            return;

        // modernize

        for (const [id, item] of Object.entries(this.ledger.ref)) {
            // do stuff
        }

        // update meta

        fs.writeFileSync(`${this.path}/meta_mediashare_version`, current, 'utf-8')

    }

}