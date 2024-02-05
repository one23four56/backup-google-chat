/**
 * @module data
 * @version 1.3.2: added data dereferencing
 * 1.3.1: added sleep blocking
 * 1.3: added data states, sleeping 
 * 1.2: added backups, optimized memory usage
 * 1.1: added aliases for data functions
 * 1.0: created
 * @description a faster way to interact with data
 */

import * as json from "./json";
import * as fs from "fs/promises";
import * as crypto from "crypto";
import { transporter } from "..";

export enum DataState {
    active,
    pending,
    sleeping,
}

const dataReference: Record<string, Data> = {};

export class Data<type = any> {
    name: string;
    private data: Object | Object[];
    previousHash: string;
    private dataState: DataState;
    private sleepTimeout: ReturnType<typeof setTimeout>;

    private sleepBlockers: any[] = [];

    constructor(name: string, data: Object | Object[]) {
        this.name = name;

        this.dataState = DataState.active;

        // deep copy
        const stringified = JSON.stringify(data);
        this.data = JSON.parse(stringified);

        // set hash
        this.previousHash = (() => {
            const hashSum = crypto.createHash("md5");
            hashSum.update(stringified);

            return hashSum.digest("hex");
        })();

        if (dataReference[name] !== undefined)
            throw `data: ${name} already exists`;

        dataReference[name] = this;

        this.autoSleep();
    }

    /**
     * Gets a reference to the data. Changing the reference changes the data
     * @returns A reference to the data
     */
    getDataReference(): type {
        return this.ref
    }

    /**
     * Gets a fresh copy of the data, not linked to the original
     * @returns A deep copy of the data
     */
    getDataCopy(): type {
        if (this.dataState === DataState.sleeping)
            this.load();

        return structuredClone(this.data) as type;
    }

    /**
     * Get a reference to the data
     */
    get ref(): type {

        if (this.dataState === DataState.pending)
            this.dataState = DataState.active;

        if (this.dataState === DataState.sleeping)
            this.load();

        this.autoSleep();
        return this.data as type;
    }

    set ref(data: type) {
        this.autoSleep();
        this.dataState = DataState.active;
        this.data = data;
    }

    /**
     * Equivalent to calling getDataCopy()
     */
    get copy() {
        return this.getDataCopy();
    }

    get state(): DataState {
        return this.dataState;
    }

    private load() {
        const data = json.read(this.name);
        this.data = data;
        this.dataState = DataState.active;
        this.autoSleep();
        // console.log(`data: ${this.name} awake`)
    }

    /**
     * Sets data state to sleep, committing data to storage and removing it from memory  
     * **Note:** This is not permanent, the data will awake itself when needed again
     */
    sleep() {

        if (this.sleepBlockers.length !== 0)
            return;

        if (this.dataState !== DataState.active)
            return;

        if (typeof this.data === "undefined")
            return;

        // pending state tells data writer to put this data to sleep after saving it
        this.dataState = DataState.pending;

        // console.log(`data: ${this.name} pending`)

        // to be called by data writer function when data is committed to storage
        this["finalize"] = () => {
            this.dataState = DataState.sleeping;
            this.data = undefined;
            this["finalize"] = undefined;
            // console.log(`data: ${this.name} sleeping`)
        }
    }

    private autoSleep() {
        if (this.sleepBlockers.length !== 0)
            return; 
        
        if (this.dataState !== DataState.active)
            return;

        clearTimeout(this.sleepTimeout);
        this.sleepTimeout = setTimeout(
            () => this.sleep(), 1000 * 10
        )
    }

    /**
     * block sleep until this specific token is unblocked
     * @param token anything
     */
    blockSleep(token: any) {
        this.sleepBlockers.push(token);
    }

    /**
     * unblock sleep that was previously blocked using a specific token
     * @param token anything
     * @param sleep whether or not to go straight to sleep
     */
    unblockSleep(token: any, sleep?: true) {
        this.sleepBlockers = this.sleepBlockers.filter(t => t !== token);
        if (sleep) return this.sleep();
        this.autoSleep();
    }

    dereference() {
        delete dataReference[this.name];
    }
}

/**
 * Reads a JSON file
 * @param path Path of the file to read
 * @param safe If true, the file will be created if it is not found
 * @param fill If safe is true, this is what will be inserted into the file upon creation
 * @returns The JSON file parsed into a Data object
 */
export default function get<type>(
    path: string,
    safe: boolean = true,
    fill: string = "{}"
): Data<type> {
    if (dataReference[path] !== undefined) return dataReference[path];

    try {
        const data = json.read(path, safe, fill);
        return new Data(path, data);
    } catch (err) {
        // json file is corrupted, try backup

        try {
            const data = json.read(path + ".backup", safe, fill);

            // alert to info email

            if (process.env.INFO)
                transporter.sendMail({
                    to: process.env.INFO,
                    subject: `Data Error`,
                    from: "Info Logging",
                    html:
                        `A JSON file was corrupted and had to be loaded from a backup.<br>` +
                        `File path: ${path}<br>Time: ${Date.now()}`,
                });

            return new Data(path, data);
        } catch {
            // alert to info email
            if (process.env.INFO)
                transporter.sendMail({
                    to: process.env.INFO,
                    subject: `Unrecoverable Data Error`,
                    from: "Info Logging",
                    html:
                        `A JSON file was corrupted and <b>could not</b> be loaded from a backup.<br>` +
                        `File path: ${path}<br>Time: ${Date.now()}`,
                });

            throw new Error(
                `File at '${path}' is corrupted and a backup is not available'`
            );
            // seems counterproductive to catch an error an then throw it, but this
            // is to make a friendlier error message that is easier to debug
        }
    }
}

setInterval(async () => {
    // save data to files

    for (const data of Object.values(dataReference)) {
        if (data.state === DataState.sleeping)
            continue;

        const string = JSON.stringify(data.copy);

        const hash = (() => {
            const hashSum = crypto.createHash("md5");
            hashSum.update(string);

            return hashSum.digest("hex");
        })();

        if (data.previousHash && hash === data.previousHash && data.state !== DataState.pending)
            continue;

        // write data to file

        if (string === "" || !string)
            throw new Error(`data write: file loss prevention auto-stopped blank data write to ${data.name}`)

        await fs.writeFile(data.name, string, 'utf-8')
        await fs.writeFile(data.name + ".backup", string, 'utf-8')

        // put pending data to sleep
        if (data.state === DataState.pending && typeof data["finalize"] === "function")
            data["finalize"]();

        /**
         * here is the idea:
         *  the data corruption occurs when a write to a file suddenly gets interrupted.
         *  since these data objects are constantly being written to files, they are at a high 
         *  risk of being corrupted, especially when the server is running on a bad device.
         * 
         *  by writing the data twice, more storage is used, but this means that the data will
         *  still be there if a write is corrupted, and can be loaded from the backup. they are
         *  executed one after the other, so unless somehow both writes fail, the data should not
         *  be affected
         * 
         *  this is all working under the assumption that when the write fails the program crashes.
         *  that seems to be the case, but it might not be. either way the data is definitely safer
         *  now.
         */

        data.previousHash = hash;

    }

}, 5000);
