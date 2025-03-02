import { reqHandlerFunction } from '.';
import * as fs from 'fs'
import { escape } from '../../modules/functions'
import { checkRoom } from '../../modules/rooms';
import * as zlib from 'zlib';


export const getLoader: reqHandlerFunction = (req, res) => {

    const roomId = req.params.room;

    if (!roomId)
        return;

    const room = checkRoom(roomId, req.userData.id, false)

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

    const room = checkRoom(roomId, req.userData.id, false)

    if (!room) return res.sendStatus(403);

    if (room.data.options.archiveViewerAllowed === false)
        return res.status(403).send("The owner of this room has disabled the archive loader and viewer.")

    const out = [];

    for (const message of room.archive.messageRef())
        out.push(message);

    res.json(out);

}

const archiveView = fs.readFileSync('pages/archive/view.html', 'utf-8');

export const view: reqHandlerFunction = (req, res) => {

    const startTime = Date.now();

    const roomId = req.params.room;
    if (!roomId)
        return;

    const room = checkRoom(roomId, req.userData.id, false)

    if (!room) {
        res.status(401).send("You are either not a member of this room or the room does not exist.")
        return;
    }

    if (room.data.options.archiveViewerAllowed === false) {
        res.status(401).send("The owner of this room has disabled the archive loader and viewer.")
        return;
    }

    let result = String(archiveView); // copy
    result = result.replace(/ {4}|[\t\n\r]/gm, "") // minify kinda (idk)
    result = result.replace(/\$RoomName\$/g, `${escape(room.data.emoji)} ${escape(room.data.name)}`)
    result = result.replace(/\$title\$/g, `${escape(room.data.name)} Archive Viewer - Backup Google Chat`)
    result = result.replace(/\$time\$/g, startTime.toString())

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: "America/Chicago",
        timeStyle: "long",
        dateStyle: "medium",

    })

    const
        reverse = req.query.reverse === "on",
        rawStart = Number(req.query.start) ? Number(req.query.start) : 0,
        count = Number(req.query.count) ? Number(req.query.count) : Infinity,
        start = reverse ? room.archive.length - rawStart - count : rawStart;

    let startSegment = Math.floor(start / 1000)
    if (startSegment < 0) startSegment = 0;

    let messages = 0;
    for (const message of room.archive.messageRef(false, startSegment)) {
        if (message.id < start) continue;
        if (messages >= count) break;

        if (typeof message.time === "undefined")
            continue;

        messages++;
        result += `<p ${Number(req.query.focus) === message.id && req.query.focus ? `style="background-color: yellow;color: black;" ` : ''
            }>[${message.id}] <i>${formatter.format(new Date(message.time))
            }</i> <b>${escape(message.author.name)
            }${message.author.webhookData ? ` (${escape(message.author.webhookData.name)})` : ''
            }${message.tags ? ` [${escape(message.tags.map(t => t.text).join("] ["))}]` : ''
            }:</b> ${message.replyTo ? `<i>(Reply to <a target="_blank" href="../archive?message=${message.replyTo.id}">message ${message.replyTo.id}</a>)</i> ` : ''
            }${escape(message.text)
            }${message.media ? " " + message.media
                .map(m => m.type === "link" ? m.location : `/media/${room.data.id}/${m.location}`)
                .map(l => `<a href=${l} target="_blank">(View Attached Media)</a>`)
                .join(" ")
                : ''
            }${message.links ? " " + message.links
                .map(l => `<a href="${l}" target="_blank">(View Attached Link)</a>`)
                .join(" ") : ''
            }${message.poll && message.poll.type === "poll" ?
                ` <i>(Poll: ${escape(message.poll.question)} ` + message.poll.options
                    .map(o => `${escape(o.option)} (${o.votes} votes)`)
                    .join("; ") + ")</i>" : ""
            }</p>`

    }

    result += `<hr><p>Generated at ${formatter.format(new Date())}</p><br><p>Settings used:</p>`


    result += `<p>Start: ${req.query.start} / Count: ${req.query.count}</p>`;
    result += `<p>Highlight Message: ${req.query.focus || 'Off'}</p>`;
    result += `<p>Reverse Mode: ${req.query.reverse === 'on' ? 'On' : 'Off'}</p>`;

    result += `<br><p>Total Messages Displayed: ${messages}</p>`;

    const end = Date.now();
    result += `<br><p>Request Processing Time: ${end - startTime}ms</p>`

    result += `<br class="no-print"><p><a href="../archive">Back</a></p>`;
    result += `<hr><p>Backup Google Chat Archive Loader Version 2.5</p>`
    result += `</div></body></html><!--${end}-->`;

    res.send(result);
}