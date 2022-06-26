import { HandlerSocket } from ".";
import { io, room } from "../..";
import { UserData } from "../../lib/authdata";
import { autoModResult, autoModText, isMuted } from "../../modules/autoMod";
import { sendMessage, sendWebhookMessage } from "../../modules/functions";
import Webhook from "../../modules/webhooks";

export function registerWebhookHandler(socket: HandlerSocket, userData: UserData) {

    socket.on("send-webhook-message", data => data? sendWebhookMessage(data.data) : null);

    socket.on("delete-webhook", id => {
        if (!id) return;
        
        if (isMuted(userData.name)) return;
        const webhook = Webhook.get(id);
        if (!webhook) return;
        if (!webhook.checkIfHasAccess(userData.name)) return;
        const msg = webhook.remove(userData.name)
        sendMessage(msg);
        room.archive.addMessage(msg);
        io.emit('load data updated')
    });

    socket.on("edit-webhook", data => {
        if (!data.id) return;
        if (!data.webhookData.newImage || !data.webhookData.newName) return;

        if (isMuted(userData.name)) return;
        if (autoModText(data.webhookData.newName, 50) !== autoModResult.pass) return;
        const webhook = Webhook.get(data.id);
        if (!webhook) return;
        if (!webhook.checkIfHasAccess(userData.name)) return;
        const msg = webhook.update(data.webhookData.newName, data.webhookData.newImage, userData.name);
        sendMessage(msg);
        room.archive.addMessage(msg);
        io.emit('load data updated')
    });

    socket.on("add-webhook", data => {
        if (!data.name || !data.image) return;
        if (typeof data.private !== "boolean") return;

        if (isMuted(userData.name)) return;
        if (autoModText(data.name, 50) !== autoModResult.pass) return;
        const webhook = new Webhook(data.name, data.image, data.private, userData.name)
        const msg = webhook.generateCreatedMessage(userData.name);
        sendMessage(msg);
        room.archive.addMessage(msg);
        io.emit("load data updated")
    });

}