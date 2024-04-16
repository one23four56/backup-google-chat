import { reqHandlerFunction } from ".";
import { Users } from "../../modules/users";
import * as fs from 'fs'
import { UserData } from "../../lib/authdata";
import Share, { LedgerItem } from "../../modules/mediashare";
import { AllowedTypes } from "../../lib/socket";
import * as path from 'path';
import { escape } from "../../modules/functions";
import { OTT } from "../../modules/userAuth";

export const getMedia: reqHandlerFunction = async (req, res) => {

    // validate

    const { id, type, share: shareId } = req.params;

    if (typeof id !== "string" || typeof type !== "string" || typeof shareId !== "string" || (type !== "raw" && type !== "data"))
        return res.sendStatus(400)

    const share = Share.get(shareId);

    if (!share)
        return res.sendStatus(403);

    if (!share.canView(req.userData.id)) return res.sendStatus(403);

    // check type

    if (type === "raw") {

        const item = await share.getData(id)

        if (!item)
            return res.type("image/svg+xml").send(fs.readFileSync("public/mediashare-404.svg"))
        // yeah i know sendFile exists i just really don't want to deal with path.join

        res.type(item.type);
        item.encoding && res.setHeader("Content-Encoding", item.encoding);
        res.send(item.buffer);

    } else if (type === "data") {

        const item = await share.getData(id)

        if (!item)
            return res.sendStatus(404)

        delete item.buffer;

        const output: MediaDataOutput = item as unknown as MediaDataOutput;

        output.user = Users.get(item.user) || false;
        output.size = share.getItemSize(item.id);
        output.totalSize = share.size;

        res.json(output)

    }
}

interface StartUploadData {
    type: string;
    hash: string;
    id: string;
    share: string;
    name: string;
    user: string;
}

export interface StartUploadResponse {
    id: string;
    key?: string;
}

export const startUpload: reqHandlerFunction = async (req, res) => {
    const { share: shareId } = req.params;
    const { type: t, size, hash: h, name: n } = req.body;

    // these are all gonna be stored on the server, so they're shortened just in case
    // someone submits a long ass name/type/hash
    const type = String(t).slice(0, 64);
    const hash = String(h).slice(0, 64);
    const name = Share.formatName(String(n));

    if (
        typeof shareId !== "string" ||
        typeof size !== "number"
    ) return res.sendStatus(400);

    const share = Share.get(shareId)

    if (!share) return res.sendStatus(403);
    if (!share.canUpload(req.userData.id)) return res.sendStatus(403);
    if (!AllowedTypes.includes(type)) return res.status(415).send("File type not supported");

    if (size > share.options.maxFileSize)
        return res.status(413).send(`The file's size is greater than this share's file size limit (${share.options.maxFileSize / 1e6} MB)`);

    if (!share.options.autoDelete && size + share.size > share.options.maxShareSize)
        return res.status(413).send(`The file cannot be uploaded as there is not enough space left.\n\nNote: Enabling auto-delete in the room options will allow you to upload this file.`);

    // check for duplicate

    const duplicate = share.matchHash(hash);

    if (duplicate)
        return res.json({
            id: duplicate
        } as StartUploadResponse);

    // file is good to go past here

    const id = share.generateID();

    // store data on server, generate upload key
    const key = OTT.generate<StartUploadData>({
        hash, id, name, type,
        share: share.id,
        user: req.userData.id
    }, "file upload key", 32);

    res.status(202).json({
        id, key
    } as StartUploadResponse);
}

export interface MediaDataOutput extends Omit<LedgerItem, 'user'> {
    user: UserData | false;
    size: number;
    totalSize: number;
}

export const uploadMedia: reqHandlerFunction = async (req, res) => {

    const { key } = req.params;

    if (
        typeof key !== "string" ||
        !Buffer.isBuffer(req.body)
    ) return res.sendStatus(400);

    const data = OTT.consume<StartUploadData>(key, "file upload key");

    if (data === false)
        return res.sendStatus(401);

    const { share: shareId, hash, id, name, type, user } = data;

    if (user !== req.userData.id)
        return res.sendStatus(403);

    const share = Share.get(shareId);

    // this if is guaranteed
    // if (!AllowedTypes.includes(type)) return res.sendStatus(415);

    // super unlikely edge cases below lol, just in case

    // share could have been deleted in between start upload and actual upload
    if (!share) return res.sendStatus(403);

    // user could have been removed from share in between the start upload and actual upload
    if (!share.canUpload(req.userData.id)) return res.sendStatus(403);

    const bytes = Buffer.from(req.body);

    if (Share.computeHash(bytes) !== hash)
        return res.status(400).send("Upload refused: File does not match key");

    // these checks are still required, as file size is not guaranteed by the key

    if (bytes.byteLength > share.options.maxFileSize)
        return res.sendStatus(413);

    // auto-delete

    if (share.size + bytes.byteLength > share.options.maxShareSize) {
        if (!share.options.autoDelete)
            return res.sendStatus(413);

        const recursiveDelete = () => {
            console.log(`mediashare: auto-delete invoked for file ${share.firstItemId}.bgcms`)
            share.remove(share.firstItemId)

            if (share.size + bytes.byteLength > share.options.maxShareSize)
                recursiveDelete()
        }

        recursiveDelete()
    }

    // add to share 

    await share.add(bytes, { type, name, id }, req.userData.id);

    res.sendStatus(201);

}

export const viewShare: reqHandlerFunction = (req, res) => {

    const { share: shareId, file } = req.params;

    if (typeof shareId !== "string")
        return res.sendStatus(400)

    const share = Share.get(shareId);

    if (!share)
        return res.sendStatus(403);

    if (!share.canView(req.userData.id)) return res.sendStatus(403);

    if (!share.options.indexPage) return res.sendStatus(403)

    if (file && file !== "index.html") {
        if (fs.readdirSync("pages/media").includes(file))
            return res.sendFile(path.join(__dirname, `../`, `pages/media/${file}`))

        return res.sendStatus(404);
    }

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: "America/Chicago",
        timeStyle: "short",
        dateStyle: "medium",
    })

    let out = "";

    const files = Object.values(share.ledger.ref);
    files.sort((a, b) => b.time - a.time);

    const sizeByType: Record<string, number> = {};
    const sizeByAuthor: Record<string, number> = {};

    for (const file of files) {
        const user = Users.get(file.user);
        const size = share.getItemSize(file.id);

        sizeByType[file.type] = typeof sizeByType[file.type] === "undefined" ? size : sizeByType[file.type] + size;
        sizeByAuthor[file.user] = typeof sizeByAuthor[file.user] === "undefined" ? size : sizeByAuthor[file.user] + size;

        out += `\n\t\t<div class="file" data-time="${file.time}" data-size="${size}">`
        out += `<img src="${file.id}/raw" loading="lazy" alt="Icon"/>`
        out += `<span>${file.name ? escape(file.name) : "Unnamed Media"}</span>`
        out += `<span><img src="${user.img}" alt="Profile Picture"/>${escape(user.name)}</span>`
        out += `<span>${file.type}</span>`
        out += `<span>${(size / 1e6).toFixed(2)} MB / ${(100 * size / share.options.maxShareSize).toFixed(2)}%</span>`
        out += `<span>${formatter.format(new Date(file.time))}</span>`
        out += `</div>`
    }

    const used = share.size / 1e6;
    const max = share.options.maxShareSize / 1e6;
    const free = max - used;

    const typeSizes = Object.entries(sizeByType).sort(([_a, a], [_b, b]) => b - a).map(
        ([type, size]) => `<div class="item"><span>${type}</span><b>${(size / 1e6).toFixed(2)} MB</b><div class="percent" style="width:${100 * size / share.size}%"></div></div>`
    );
    const authorSizes = Object.entries(sizeByAuthor).sort(([_a, a], [_b, b]) => b - a).map(
        ([id, size]) => `<div class="item"><span>${Users.get(id).name}</span><b>${(size / 1e6).toFixed(2)} MB</b><div class="percent" style="width:${100 * size / share.size}%"></div></div>`
    );



    res.type("text/html").send(
        fs.readFileSync("pages/media/index.html", "utf-8")
            .replace("{share}", share.id)
            .replace("{files}", files.length as any as string)
            .replace("{freeStyle}", `style="width:${100 * free / max}%"`)
            .replace("{freeSize}", free.toFixed(2))
            .replace("{freePercent}", (100 * free / max).toFixed(2))
            .replace("{usedStyle}", `style="width:${100 * used / max}%"`)
            .replace("{usedSize}", used.toFixed(2))
            .replace("{usedPercent}", (100 * used / max).toFixed(2))
            .replace("{capacity}", max.toFixed(0))
            .replace("<!--files-->", out)
            .replace("<!--size-types-->", typeSizes.join("\n\t\t\t"))
            .replace("<!--size-authors-->", authorSizes.join("\n\t\t\t"))
    );

}