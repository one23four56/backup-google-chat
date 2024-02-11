import { reqHandlerFunction } from ".";
import { Users } from "../../modules/users";
import * as fs from 'fs'
import { UserData } from "../../lib/authdata";
import Share, { LedgerItem } from "../../modules/mediashare";
import { AllowedTypes } from "../../lib/socket";
import * as path from 'path';

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
        out += `\n\t\t<div class="file" data-time="${file.time}" data-size="${share.getItemSize(file.id)}">`
        out += `<img src="${file.id}/raw" loading="lazy" alt="Icon"/>`
        out += `<span>${file.name ?? "Unnamed Media"}</span>`
        out += `<span>${Users.get(file.user).name}</span>`
        out += `<span>${file.type}</span>`
        out += `<span>${(share.getItemSize(file.id) / 1e6).toFixed(2)} MB / ${((share.getItemSize(file.id) / 2e8) * 100).toFixed(2)}%</span>`
        out += `<span>${formatter.format(new Date(file.time))}</span>`
        out += `</div>`
    }

    res.type("text/html").send(
        fs.readFileSync("pages/media/index.html", "utf-8")
            .replace("{share}", share.id)
            .replace("{files}", files.length as any as string)
            .replace("<!--files-->", out)
    );

}