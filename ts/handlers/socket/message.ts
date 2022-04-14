import Message from "../../lib/msg"
import { UserData } from "../../lib/authdata"
import { Archive } from "../../modules/archive"
import { autoMod, autoModResult, mute } from "../../modules/autoMod"
import { sendMessage } from "../../modules/functions"
import Bots from "../../modules/bots"
import { Socket } from "socket.io"

export function registerMessageHandler(socket: Socket, userData: UserData) {

    const message = (data, respond) => {
        if (data.recipient !== "chat") data.archive = false
        let replyTo: Message | undefined = undefined;
        if (data.replyTo && Archive.getArchive()[data.replyTo]) {
            replyTo = Archive.getArchive()[data.replyTo]
            replyTo.replyTo = undefined;
            // avoid a nasty reply chain that takes up a lot of space
        }
        const msg: Message = {
            text: data.text,
            author: {
                name: userData.name,
                img: userData.img
            },
            time: new Date(new Date().toUTCString()),
            archive: data.archive,
            image: data.image,
            id: Archive.getArchive().length,
            channel: {
                to: data.recipient,
                origin: userData.name
            },
            replyTo: replyTo,
        }
        let autoModRes = autoMod(msg, userData.hooligan ? true : false) // cant just use hooligan because it can be undefined
        switch (autoModRes) {
            case autoModResult.pass:
                respond(sendMessage(msg, data.recipient, socket))
                if (data.archive === true) Archive.addMessage(msg)
                if (data.recipient === 'chat') Bots.runBotsOnMessage(msg);
                if (data.recipient === 'chat') console.log(`Message from ${userData.name}: ${data.text} (${data.archive})`);
                break
            case autoModResult.kick:
                socket.emit("auto-mod-update", autoModRes.toString())
                mute(userData.name, 120000)
                const autoModMsg: Message = {
                    text:
                        `${userData.name} has been muted for 2 minutes due to spam.`,
                    author: {
                        name: "Auto Moderator",
                        img:
                            "https://jason-mayer.com/hosted/mod.png",
                    },
                    time: new Date(new Date().toUTCString()),
                    tag: {
                        text: 'BOT',
                        color: 'white',
                        bg_color: 'black'
                    }
                }
                sendMessage(autoModMsg);
                Archive.addMessage(autoModMsg);
                break
            default:
                socket.emit("auto-mod-update", autoModRes.toString())
                break
        }
    }

    socket.on('message', message)
}