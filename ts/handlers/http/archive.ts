import { reqHandlerFunction } from '.';
import Message from '../../lib/msg'
import * as fs from 'fs'
import { escape } from '../../modules/functions'
import { checkRoom } from '../../modules/rooms';


export const getLoader: reqHandlerFunction = (req, res) => {

    const roomId = req.params.room;

    if (!roomId)
        return;

    const room = checkRoom(roomId, req.userData.id)

    if (!room) {
        res.status(401).send("You are either not a member of this room or the room does not exist.")
        return;
    }

    if (room.data.options.archiveViewerAllowed === false) {
        res.status(401).send("The owner of this room has disabled the archive loader and viewer.")
        return;
    }

    res.send(
        fs.readFileSync("pages/archive/index.html", 'utf-8')
            .replace(/\$RoomName\$/g, `${escape(room.data.emoji)} ${escape(room.data.name)}`)
    )

}

export const getJson: reqHandlerFunction = (req, res) => {

    const roomId = req.params.room;

    if (!roomId)
        return;

    const room = checkRoom(roomId, req.userData.id)

    if (!room) {
        res.status(401).send("You are either not a member of this room or the room does not exist.")
        return;
    }

    if (room.data.options.archiveViewerAllowed === false) {
        res.status(401).send("The owner of this room has disabled the archive loader and viewer.")
        return;
    }

    let archive: Message[] = room.archive.data.getDataCopy()

    // if (req.query.images === 'none') for (let message of archive) if (message.image) delete message.image
    if (req.query.reverse === 'true') archive = archive.reverse()

    if (req.query.start && req.query.count) archive = archive.filter((_, index) => !(index < Number(req.query.start) || index >= (Number(req.query.count) + Number(req.query.start))))

    res.send(JSON.stringify(archive))
}

export const view: reqHandlerFunction = (req, res) => {

    const start = Date.now();

    const roomId = req.params.room;
    if (!roomId)
        return;

    const room = checkRoom(roomId, req.userData.id)

    if (!room) {
        res.status(401).send("You are either not a member of this room or the room does not exist.")
        return;
    }

    if (room.data.options.archiveViewerAllowed === false) {
        res.status(401).send("The owner of this room has disabled the archive loader and viewer.")
        return;
    }

    let archive: Message[] = room.archive.data.getDataCopy()
    archive = archive.filter(v => typeof v !== "undefined")

    if (req.query.reverse === 'on') archive = archive.reverse()
    if (req.query.start && req.query.count) archive = archive.filter((_, index) => !(index < Number(req.query.start) || index >= (Number(req.query.count) + Number(req.query.start))))
    if (req.query.reverse === 'on') archive = archive.reverse() // intentional

    let result: string = fs.readFileSync('pages/archive/view.html', 'utf-8');
    result = result.replace(/ {4}|[\t\n\r]/gm, "") // minify kinda (idk)
    result = result.replace(/\$RoomName\$/g, `${escape(room.data.emoji)} ${escape(room.data.name)}`)
    result = result.replace(/\$title\$/g, `${escape(room.data.name)} Archive Viewer - Backup Google Chat`)
    result = result.replace(/\$time\$/g, start.toString())

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: "America/Chicago",
        timeStyle: "long",
        dateStyle: "medium",

    })

    for (const [index, message] of archive.entries()) {

        if (typeof message.time === "undefined")
            continue;

        result += `<p ${Number(req.query.focus) === message.id && req.query.focus ? `style="background-color: yellow;color: black;" ` : ''
            }>[${message.id}] <i>${formatter.format(new Date(message.time))
            }</i> <b>${escape(message.author.name)
            }${message.author.webhookData ? ` (${escape(message.author.webhookData.name)})` : ''
            }${message.tags ? ` [${escape(message.tags.map(t => t.text).join("] ["))}]` : ''
            }:</b> ${
                message.replyTo ? `<i>(Reply to message ${message.replyTo.id})</i> ` : ''
            }${escape(message.text)
            }${message.media ? " " + message.media
                .map(m => m.type === "link" ? m.location : `/media/${room.data.id}/${m.location}/raw`)
                .map(l => `<a href=${l} target="_blank">(View Attached Media)</a>`)
                .join(" ")
                : ''
            }${
                message.links ? " " + message.links
                    .map(l => `<a href="${l}" target="_blank">(View Attached Link)</a>`)
                    .join(" ") : ''
            }${
                message.poll && message.poll.type === "poll" ? 
                    ` <i>(Poll: ${escape(message.poll.question)} ` + message.poll.options
                        .map(o => `${escape(o.option)} (${o.votes} votes)`)
                        .join("; ") + ")</i>" : ""
            }</p>`

    }

    result += `<hr><p>Generated at ${formatter.format(new Date())}</p><br><p>Settings used:</p>`


    result += `<p>Start: ${req.query.start} / Count: ${req.query.count}</p>`;
    result += `<p>Highlight Message: ${req.query.focus || 'Off'}</p>`;
    result += `<p>Reverse Mode: ${req.query.reverse === 'on' ? 'On' : 'Off'}</p>`;

    result += `<br><p>Total Messages Displayed: ${archive.length}</p>`;

    const end = Date.now();
    result += `<br><p>Request Processing Time: ${end - start}ms</p>`

    result += `<br class="no-print"><p><a href="../archive">Back</a></p>`;
    result += `<hr><p>Backup Google Chat Archive Loader Version 2.4</p>`
    result += `</div></body></html><!--${end}-->`;

    res.send(result)
}

export const stats: reqHandlerFunction = (req, res) => {

    const roomId = req.params.room;

    if (!roomId)
        return;

    const room = checkRoom(roomId, req.userData.id)

    if (!room) {
        res.status(401).send("You are either not a member of this room or the room does not exist.")
        return;
    }

    if (room.data.options.archiveViewerAllowed === false) {
        res.status(401).send("The owner of this room has disabled the archive loader and viewer.")
        return;
    }

    const size: number = room.archive.size + room.share.size;

    const myMessages = room.archive.data.getDataCopy().filter(message => message.author.name === req.userData.name).length;

    res.json({
        size: size,
        myMessages: myMessages,
        totalMessages: room.archive.data.getDataReference().length
    })

}