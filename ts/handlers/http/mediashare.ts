import { reqHandlerFunction } from ".";
import { Users } from "../../modules/users";
import * as fs from 'fs'
import { UserData } from "../../lib/authdata";
import Share, { LedgerItem } from "../../modules/mediashare";
import { AllowedTypes } from "../../lib/socket";
import * as path from 'path';
import { escape } from "../../modules/functions";

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

export interface MediaDataOutput extends Omit<LedgerItem, 'user'> {
    user: UserData | false;
    size: number;
    totalSize: number;
}

export const uploadMedia: reqHandlerFunction = async (req, res) => {

    const { share: shareId } = req.params;
    const { name, type: t } = req.query;

    const type = String(t).slice(0, 50);

    if (
        typeof shareId !== "string" ||
        typeof name !== "string" ||
        !Buffer.isBuffer(req.body)
    ) return res.sendStatus(400);

    const share = Share.get(shareId)
    if (!share) return res.sendStatus(403);

    if (!share.canUpload(req.userData.id)) return res.sendStatus(403);

    if (!AllowedTypes.includes(type)) return res.status(415).send("File type not supported");

    const bytes = Buffer.from(req.body);

    if (bytes.byteLength > share.options.maxFileSize)
        return res.status(413).send("This file is too large.");

    // auto-delete

    if (share.size + bytes.byteLength > share.options.maxShareSize) {
        if (!share.options.autoDelete)
            return res.status(413).send(`The file cannot be uploaded as there is not enough space left.\n\nNote: Enabling auto-delete in the room options will allow you to upload this file.`)

        const recursiveDelete = () => {
            console.log(`mediashare: auto-delete invoked for file ${share.firstItemId}.bgcms`)
            share.remove(share.firstItemId)

            if (share.size + bytes.byteLength > share.options.maxShareSize)
                recursiveDelete()
        }

        recursiveDelete()
    }

    // add to share 

    const id = await share.add(bytes, { type, name }, req.userData.id)

    res.send(id);

}

export const viewShare: reqHandlerFunction = (req, res) => {

    const { share: shareId, file } = req.params;

    if (typeof shareId !== "string")
        return res.sendStatus(400)

    const share = Share.get(shareId);

    if (!share)
        return res.sendStatus(403);

    if (!share.canView(req.userData.id)) return res.sendStatus(403);

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

    for (const file of files) {
        const user = Users.get(file.user);
        const size = share.getItemSize(file.id);

        out += `\n\t\t<div class="file" data-time="${file.time}" data-size="${size}">`
        out += `<img src="${file.id}/raw" loading="lazy" alt="Icon"/>`
        out += `<span>${file.name ? escape(file.name) : "Unnamed Media"}</span>`
        out += `<span><img src="${user.img}" alt="Profile Picture"/>${escape(user.name)}</span>`
        out += `<span>${file.type}</span>`
        out += `<span>${(size / 1e6).toFixed(2)} MB / ${(100 * size / 2e8).toFixed(2)}%</span>`
        out += `<span>${formatter.format(new Date(file.time))}</span>`
        out += `</div>`
    }

    const used = share.size / 1e6;
    const max = share.options.maxShareSize / 1e6;
    const free = max - used;

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
    );

}