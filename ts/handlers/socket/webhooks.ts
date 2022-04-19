import { Socket } from "socket.io";
import { io } from "../..";
import { UserData } from "../../lib/authdata";
import { Archive } from "../../modules/archive";
import { autoModResult, autoModText, isMuted } from "../../modules/autoMod";
import { sendMessage, sendWebhookMessage } from "../../modules/functions";
import Webhook from "../../modules/webhooks";

export function registerWebhookHandler(socket: Socket, userData: UserData) {

    socket.on("send-webhook-message", data => sendWebhookMessage(data.data));

    socket.on("delete-webhook", id => {
        if (isMuted(userData.name)) return;
        const webhook = Webhook.get(id);
        if (!webhook) return;
        if (!webhook.checkIfHasAccess(userData.name)) return;
        const msg = webhook.remove(userData.name)
        sendMessage(msg);
        Archive.addMessage(msg);
        io.emit('load data updated')
    });

    socket.on("edit-webhook", data => {
        if (isMuted(userData.name)) return;
        if (autoModText(data.webhookData.newName, 50) !== autoModResult.pass) return;
        const webhook = Webhook.get(data.id);
        if (!webhook) return;
        if (!webhook.checkIfHasAccess(userData.name)) return;
        const msg = webhook.update(data.webhookData.newName, data.webhookData.newImage, userData.name);
        sendMessage(msg);
        Archive.addMessage(msg);
        io.emit('load data updated')
    });

    socket.on("add-webhook", data => {
        if (isMuted(userData.name)) return;
        if (autoModText(data.name, 50) !== autoModResult.pass) return;
        const webhook = new Webhook(data.name, data.image, data.private, userData.name)
        const msg = webhook.generateCreatedMessage(userData.name);
        sendMessage(msg);
        Archive.addMessage(msg);
        io.emit("load data updated")
    });

}