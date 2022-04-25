/**
 * @module data 
 * @version 1.0: created
 * a faster way for interacting with data
 */

import * as json from './json';
import * as fs from 'fs/promises'

const dataReference: {
    [key: string]: Data
} = {}

export class Data<type = any> {
    name: string;
    private data: Object | Object[];
    private oldData: string;

    constructor(name: string, data: Object | Object[]) {
        this.name = name;
        this.data = JSON.parse(JSON.stringify(data));

        if (dataReference[name] !== undefined)
            throw `data: ${name} already exists`;

        dataReference[name] = this;

        setInterval(
            ()=>this.writeToJSON(), // for some reason just passing this.writeToJSON as an arg doesn't work
        5000)

    }

    /**
     * Gets a reference to the data. Changing the reference changes the data
     * @returns A reference to the data
     */
    getDataReference(): type {
        return this.data as type;
    }

    /**
     * Gets a fresh copy of the data, not linked to the original
     * @returns A deep copy of the data
     */
    getDataCopy(): type {
        return JSON.parse(JSON.stringify(this.data)) as type;
    }

    private async writeToJSON(): Promise<boolean> {
        try {
            const dataString = JSON.stringify(this.data);
            if (this.oldData === dataString) return false;

            await fs.writeFile(this.name, dataString, 'utf-8');
            this.oldData = dataString;
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Reads a JSON file
 * @param path Path of the file to read
 * @param safe If true, the file will be created if it is not found
 * @param fill If safe is true, this is what will be inserted into the file upon creation
 * @returns The JSON file parsed into a Data object
 */
export default function get<type>(path: string, safe: boolean = true, fill: string = "{}"): Data<type> {
    if (dataReference[path] !== undefined)
        return dataReference[path];

    const data = json.read(path, safe, fill);
    return new Data(path, data);
}
