import { HandlerSocket } from ".";
import { io } from "../..";
import { UserData } from "../../lib/authdata";
import { ClientToServerEvents } from "../../lib/socket";
import { autoModResult, autoModText, isMuted } from "../../modules/autoMod";
import { sendWebhookMessage } from "../../modules/functions";
import { checkRoom } from "../../modules/rooms";
import { Session } from "../../modules/session";
import Webhook from "../../modules/webhooks";

export function generateGetWebhooksHandler(session: Session) {
    const handler: ClientToServerEvents["get webhooks"] = (roomId, respond) => {

        // block malformed requests

        if (!roomId || !respond || typeof roomId !== "string" || typeof respond !== "function") 
            return;

        // get room 

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id);
        if (!room) return;

        // send webhooks

        respond(room.webhooks.getWebhooks())

    }

    return handler;
}

export function generateAddWebhookHandler(session: Session) {
    const handler: ClientToServerEvents["add-webhook"] = (roomId, data) => {

        // block malformed requests

        if (
            typeof roomId !==       "string" || 
            typeof data !==         "object" || 
            typeof data.name !==    "string" ||
            typeof data.image !==   "string" ||
            typeof data.private !== "boolean"
        )
            return

        // get room 
        const userData = session.userData;

        const room = checkRoom(roomId, userData.id);
        if (!room) return;

        // run automod checks

        if (isMuted(userData.name)) return;
        if (autoModText(data.name, 50) !== autoModResult.pass) return;

        // create webhook

        room.addWebhook(data.name, data.image, data.private, userData)
    }

    return handler;
}

export function generateEditWebhookHandler(session: Session) {
    const handler: ClientToServerEvents["edit-webhook"] = (roomId, data) => {

        // block malformed requests

        if (
            typeof roomId !== "string" ||
            typeof data !== "object" ||
            typeof data.id !== "string" ||
            typeof data.webhookData !== "object" ||
            typeof data.webhookData.newName !== "string" ||
            typeof data.webhookData.newImage !== "string"
        )
            return;

        // get room 

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id);
        if (!room) return;

        // run automod checks

        if (isMuted(userData.name)) return;
        if (autoModText(data.webhookData.newName, 50) !== autoModResult.pass) return;

        // check webhook

        const webhook = room.webhooks.get(data.id)

        if (!webhook) return;
        if (!webhook.checkIfHasAccess(userData.id)) return;

        // make edit 

        room.editWebhook(webhook, data.webhookData.newName, data.webhookData.newImage, userData)
    }

    return handler;
}

export function registerWebhookHandler(socket: HandlerSocket, userData: UserData) {

    // socket.on("send-webhook-message", data => data? sendWebhookMessage(data.data) : null);

    // socket.on("delete-webhook", id => {
    //     if (!id) return;
        
    //     if (isMuted(userData.name)) return;
    //     const webhook = Webhook.get(id);
    //     if (!webhook) return;
    //     if (!webhook.checkIfHasAccess(userData.name)) return;
    //     const msg = webhook.remove(userData.name)
    //     sendMessage(msg);
    //     room.archive.addMessage(msg);
    //     io.emit('load data updated')
    // });

    // socket.on("edit-webhook", data => {
    //     if (!data.id) return;
    //     if (!data.webhookData.newImage || !data.webhookData.newName) return;

    //     if (isMuted(userData.name)) return;
    //     if (autoModText(data.webhookData.newName, 50) !== autoModResult.pass) return;
    //     const webhook = Webhook.get(data.id);
    //     if (!webhook) return;
    //     if (!webhook.checkIfHasAccess(userData.name)) return;
    //     const msg = webhook.update(data.webhookData.newName, data.webhookData.newImage, userData.name);
    //     sendMessage(msg);
    //     room.archive.addMessage(msg);
    //     io.emit('load data updated')
    // });



}