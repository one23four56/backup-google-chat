import { ClientToServerEvents } from "../../lib/socket";
import AutoMod, { autoModResult } from "../../modules/autoMod";
import { checkRoom } from "../../modules/rooms";
import { Session } from "../../modules/session";

export function generateGetWebhooksHandler(session: Session) {
    const handler: ClientToServerEvents["get webhooks"] = (roomId, respond) => {

        // block malformed requests

        if (!roomId || !respond || typeof roomId !== "string" || typeof respond !== "function") 
            return;

        // get room 

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id);
        if (!room) return;

        if (!room.data.options.webhooksAllowed || !room.webhooks) return;

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

        if (room.data.options.webhooksAllowed === false) return;

        // run automod checks

        if (room.isMuted(userData.id)) return;
        if (AutoMod.text(data.name, 50) !== autoModResult.pass) return;

        // create webhook

        room.addWebhook(data.name, data.image, room.data.options.privateWebhooksAllowed ? data.private : false, userData)
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

        if (room.data.options.webhooksAllowed === false) return;

        // run automod checks

        if (room.isMuted(userData.id)) return;
        if (AutoMod.text(data.webhookData.newName, 50) !== autoModResult.pass) return;

        // check webhook

        const webhook = room.webhooks.get(data.id)

        if (!webhook) return;
        if (!webhook.checkIfHasAccess(userData.id)) return;

        // make edit 

        room.editWebhook(webhook, data.webhookData.newName, data.webhookData.newImage, userData)
    }

    return handler;
}

export function generateDeleteWebhookHandler(session: Session) {
    const handler: ClientToServerEvents["delete-webhook"] = (roomId, id) => {

        // block malformed requests 

        if (typeof roomId !== "string" || typeof id !== "string")
            return;

        // get room 

        const userData = session.userData;

        const room = checkRoom(roomId, userData.id);
        if (!room) return;

        if (room.data.options.webhooksAllowed === false) return;

        // run automod check

        if (room.isMuted(userData.id)) return;

        // check webhook

        const webhook = room.webhooks.get(id)

        if (!webhook) return;

        if (!webhook.checkIfHasAccess(userData.id)) {
            // poll

            if (room.getTempData("deleteWebhookPoll")) {
                session.socket.emit("alert", "Webhook Not Deleted", `The webhook ${webhook.name} was not deleted because there is already a delete webhook poll active. Please wait until that ends and try again.`)
                return;
            }

            room.setTempData("deleteWebhookPoll", true)

            room.createPollInRoom({
                message: `${userData.name} wants to delete the webhook ${webhook.name}`,
                prompt: `Delete webhook ${webhook.name}?`,
                options: ['Yes', 'No'],
                defaultOption: 'No'
            })

            .then(winner => {
                room.clearTempData("deleteWebhookPoll")
                if (winner === 'Yes')
                    // delete webhook
                    room.deleteWebhook(webhook, userData)
            })
            
        } else
            // delete webhook
            room.deleteWebhook(webhook, userData)
    }

    return handler;
}