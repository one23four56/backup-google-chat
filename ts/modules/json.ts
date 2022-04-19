/**
 * @module json
 */
import * as fs from 'fs';
//------------------------------------------------

/**
 * Reads a JSON file
 * @param path Path of the file to read
 * @param safe If true, the file will be created if it is not found
 * @param fill If safe is true, this is what will be inserted into the file upon creation
 * @returns The JSON file parsed into an object
 */
export function read(path: string, safe: boolean = true, fill: string = "{}") {
    if (fs.existsSync(path))
        return JSON.parse(fs.readFileSync(path, "utf-8"));
    else if (safe) {
        fs.writeFileSync(path, fill, "utf-8")
        return JSON.parse(fs.readFileSync(path, "utf-8"));
    } else throw "json: file does not exist and safe is disabled"
}

/**
 * Writes to a json file
 * @param path Path of file to write to
 * @param data Data to write to file
 */
export function write(path: string, data: any) {
    fs.writeFileSync(path, JSON.stringify(data), 'utf-8')
}