import Message from "../../lib/msg"
import { UserData } from "../../lib/authdata"
import { Archive } from "../../modules/archive"
import { autoMod, autoModResult, mute } from "../../modules/autoMod"
import { sendMessage } from "../../modules/functions"
import Bots from "../../modules/bots"
import { HandlerSocket } from "."
import { ClientToServerMessageData } from "../../lib/socket"

export function registerMessageHandler(socket: HandlerSocket, userData: UserData) {

    const message = (data: ClientToServerMessageData, respond: (message: Message) => void) => {

        if (
            typeof data.text === "undefined"
            || typeof data.recipient === "undefined"
            || typeof data.archive === "undefined"
            ) return;

        if (data.recipient !== "chat") data.archive = false
        let replyTo: Message = undefined;
        if (data.replyTo && Archive.getData().getDataReference()[data.replyTo]) {
            replyTo = JSON.parse(JSON.stringify(Archive.getData().getDataReference()[data.replyTo]))
            // only deep copy the message to save time
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
            image: data.image ? data.image : undefined,
            id: Archive.getData().getDataReference().length,
            channel: {
                to: data.recipient,
                origin: userData.name
            },
            replyTo: replyTo,
        }
        const autoModRes = autoMod(msg)
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