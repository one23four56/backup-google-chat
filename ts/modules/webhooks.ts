/**
 * @module webhooks
 * @version 1.1: now compatible with rooms
 * 1.0: created
 */

import * as uuid from "uuid";
import Message from "../lib/msg";
import { WebhookData } from "../lib/misc";
import * as json from './json';
import Room from "./rooms";

export interface ProtoWebhook {
    name: string;
    image: string;
    id: string;
    isPrivate: boolean;
    owner: string
}

interface CreateWebhookData {
    name: string; 
    image: string; 
    owner: string;
    isPrivate?: boolean; 
} 

export default class Webhooks {

    private path: string;
    room: Room;

    constructor(path: string, room: Room) {
        this.path = path;
        this.room = room;
    }

    getWebhooks(): ProtoWebhook[] {
        return json.read(this.path, true, "[]")
    }

    setWebhooks(webhooks: ProtoWebhook[]) {
        json.write(this.path, webhooks)
    }

    create({ name, image, owner, isPrivate }: CreateWebhookData): Webhook {

        const webhook: ProtoWebhook = {
            id: uuid.v4(),
            name,
            image,
            owner,
            isPrivate: isPrivate || false,
        }

        const webhooks = this.getWebhooks();

        webhooks.push(webhook);

        this.setWebhooks(webhooks);

        return new Webhook(this, webhook)

    }

    get(id: string): Webhook | false {

        const webhooks = this.getWebhooks();

        const protoWebhook = webhooks.find(webhook => webhook.id === id)

        if (!protoWebhook) return false;

        return new Webhook(this, protoWebhook);

    }
}

/**
 * @classdesc Webhooks class
 */
export class Webhook {
    name: string;
    image: string;
    id: string;
    private: boolean;
    owner: string;
    webhooks: Webhooks;

    /**
     * Creates a webhook object
     * @param {Webhooks} Webhooks The webhooks object that created this webhook
     * @param {ProtoWebhook} WebhookData Data for the webhook
     */
    constructor(webhooks: Webhooks, {name, image, isPrivate, owner, id}: ProtoWebhook) {
            this.name = name;
            this.image = image;
            this.private = isPrivate;
            this.owner = owner;
            this.id = id;
            this.webhooks = webhooks;
    }

    /**
     * Checks if a user has access to a webhook (can edit/delete/send messages with it)
     * @param id ID of user to check
     * @returns True if has access, false if not
     */
    checkIfHasAccess(id: string): boolean {
        return ((id == this.owner) || !this.private);
    }

    /**
     * Generates a message indicating a webhook's creation
     * @param creator The creator of the webhook
     * @returns {Message} A message indicating the webhook's creation
     * @since webhooks v1.0
     * @deprecated no longer needed
     */
    generateCreatedMessage(creator: string): Message {
        return {
            text: `${creator} created ${this.private? 'private ': ''}webhook ${this.name}. `,
            author: {
                name: "Info",
                image:
                    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png",
                id: 'bot'
            },
            time: new Date(new Date().toUTCString()),
            tag: {
                text: 'BOT',
                color: 'white',
                bgColor: 'black'
            },
            id: this.webhooks.room.archive.length
        }
    }

    /**
     * Generates a message indicating a webhook's deletion
     * @param deleted The user who deleted the webhook
     * @returns {Message} A message indicating the webhook's deletion
     * @since webhooks v1.0
     * @deprecated no longer needed
     */
    generateDeletedMessage(deleted: string): Message {
        return {
            text:
                `${deleted} deleted the webhook ${this.name}. `,
            author: {
                name: "Info",
                image:
                    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png",
                id: 'bot'
            },
            time: new Date(new Date().toUTCString()),
            tag: {
                text: 'BOT',
                color: 'white',
                bgColor: 'black'
            },
            id: this.webhooks.room.archive.length
        }
    }

    /**
     * Generates a message indicating a webhook's update
     * @param updater The user who updated the webhook
     * @returns {Message} A message indicating the webhook's update
     * @since webhooks v1.0
     * @deprecated no longer needed
     */
    generateUpdatedMessage(updater: string): Message {
        return {
            text:
                `${updater} edited the webhook ${this.name}. `,
            author: {
                name: "Info",
                image:
                    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png",
                id: 'bot'
            },
            time: new Date(new Date().toUTCString()),
            tag: {
                text: 'BOT',
                color: 'white',
                bgColor: 'black'
            },
            id: this.webhooks.room.archive.length
        }
    }

    /**
     * Updates a webhook
     * @param {string} name The new name of the webhook
     * @param {string} image The new image of the webhook
     * @param {string} updater The user who updated the webhook
     * @returns {Message} A message indicating the webhook's update
     * @since webhooks v1.0
     */
    update(name: string, image: string) {
        this.name = name;
        this.image = image;

        let webhooks = this.webhooks.getWebhooks();
        webhooks = webhooks.filter(webhook => webhook.id !== this.id);

        webhooks.push({
            name: this.name,
            id: this.id,
            image: this.image,
            isPrivate: this.private,
            owner: this.owner
        })

        this.webhooks.setWebhooks(webhooks)
    }

    /**
     * Deletes a webhook
     * @param {string} deleted The user who deleted the webhook
     * @returns {Message} A message indicating the webhook's deletion
     * @since webhooks v1.0
     */
    remove(deleted: string): Message {
        let webhooks = this.webhooks.getWebhooks();
        webhooks = webhooks.filter(webhook => webhook.id !== this.id);
        this.webhooks.setWebhooks(webhooks)

        return this.generateDeletedMessage(deleted);
    }


}