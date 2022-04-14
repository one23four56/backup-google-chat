import { reqHandlerFunction } from '.';
import { Archive } from '../../modules/archive'
import Message from '../../lib/msg'
import * as fs from 'fs'
import { escape } from '../../modules/functions' 
import authUser from '../../modules/userAuth'

export const getJson: reqHandlerFunction = (req, res) => {
    let archive: Message[] = Archive.getArchive();
    if (req.query.images === 'none') for (let message of archive) if (message.image) delete message.image
    if (req.query.reverse === 'true') archive = archive.reverse()
    if (req.query.start && req.query.count) archive = archive.filter((_, index) => !(index < Number(req.query.start) || index >= (Number(req.query.count) + Number(req.query.start))))
    res.send(JSON.stringify(archive))
}

export const view: reqHandlerFunction = (req, res) => {
    let archive: Message[] = Archive.getArchive();

    for (const [index, message] of archive.entries())
        message.index = index;

    if (req.query.noImages === 'on') for (let message of archive) if (message.image) delete message.image
    if (req.query.reverse === 'on') archive = archive.reverse()
    if (req.query.start && req.query.count) archive = archive.filter((_, index) => !(index < Number(req.query.start) || index >= (Number(req.query.count) + Number(req.query.start))))
    if (req.query.reverse === 'on') archive = archive.reverse() // intentional

    let result: string = fs.readFileSync('pages/archive/view.html', 'utf-8');
    for (const [index, message] of archive.entries())
        result += `<p ${Number(req.query.focus) === message.index && req.query.focus ? `style="background-color: yellow" ` : ''
            }title="${message.id
            }">[${index + ' / ' + message.index
            }] <i>${new Date(message.time).toLocaleString()
            }</i> <b>${escape(message.author.name)
            }${message.isWebhook ? ` (${message.sentBy})` : ''
            }${message.tag ? ` [${message.tag.text}]` : ''
            }:</b> ${escape(message.text)
            }${message.image ? ` (<a href="${message.image}" target="_blank">View Attached Image</a>)` : ''
            }</p>`

    result += `<hr><p>Backup Google Chat Archive Viewer v2</p><p>Generated at ${new Date().toUTCString()}</p><br><p>Settings used:</p>`

    result += `<p>Start: ${req.query.start} / Count: ${req.query.count}</p>`;
    result += `<p>Focus: ${req.query.focus || 'Off'}</p>`;
    result += `<p>Hide Images: ${req.query.noImages === 'on' ? 'On' : 'Off'}</p>`;
    result += `<p>Reverse Mode: ${req.query.reverse === 'on' ? 'On' : 'Off'}</p>`;

    result += `<br><p>Total Messages Displayed: ${archive.length}</p>`;

    result += `<br><p><a href="../archive">Back</a></p><br>`;

    result += `</div></body></html>`;


    res.send(result)
}

export const stats: reqHandlerFunction = (req, res) => {
    const size: number = fs.statSync('messages.json').size;
    const data = authUser.bool(req.headers.cookie);

    if (typeof data !== 'object') {
        res.status(401).send('You are not authorized');
        return;
    } // should never happen, just here to please typescript

    const myMessages = Archive.getArchive().filter(message => message.author.name === data.name || message.sentBy === data.name).length;

    res.json({
        size: size,
        myMessages: myMessages,
        totalMessages: Archive.getArchive().length
    })

}