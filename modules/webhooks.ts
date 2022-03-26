/**
 * @module webhooks
 * @version 1.0: created
 */
import { Users } from "./users";
import * as uuid from "uuid";
import Message from "../lib/msg";
import * as json from './json';

interface ProtoWebhook {
    name: string;
    image: string;
    id: string;
    ids: {
        [key: string]: string;
    };
}

/**
 * @classdesc Webhooks class
 */
export default class Webhook {
    name: string;
    image: string;
    id: string;
    ids: {
        [key: string]: string;
    };

    /**
     * Gets the webhook json
     * @returns {ProtoWebhook[]} An array of ProtoWebhooks
     * @since webhooks v1.0
     */
    static getWebhooks(): ProtoWebhook[] {
        return json.read('webhooks.json');
    }

    /**
     * Creates a new webhook
     * @param {string} name The name of the webhook
     * @param {string} image The image of the webhook
     * @param {Object?} ids The ids of the webhook (used when generating from ProtoWebhook)
     * @param {string?} id The id of the webhook (used when generating from ProtoWebhook)
     * @since webhooks v1.0
     */
    constructor(name: string, image: string, ids?: { [key: string]: string }, id?: string) {
            this.name = name;
            this.image = image;
            this.ids = ids? ids : {};
            this.id = id? id : uuid.v4();

            for (const user in Users.getUsers())
                this.ids[Users.getUsers()[user].name] = uuid.v4();
             
            const webhooks = Webhook.getWebhooks();
            webhooks.push(this);
            json.write('webhooks.json', webhooks);
    }

    /**
     * Generates a message indicating a webhook's creation
     * @param creator The creator of the webhook
     * @returns {Message} A message indicating the webhook's creation
     * @since webhooks v1.0
     */
    generateCreatedMessage(creator: string): Message {
        return {
            text: `${creator} created webhook ${this.name}. `,
            author: {
                name: "Info",
                img:
                    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png",
            },
            time: new Date(new Date().toUTCString()),
            tag: {
                text: 'BOT',
                color: 'white',
                bg_color: 'black'
            }
        }
    }

    /**
     * Generates a message indicating a webhook's deletion
     * @param deleted The user who deleted the webhook
     * @returns {Message} A message indicating the webhook's deletion
     * @since webhooks v1.0
     */
    generateDeletedMessage(deleted: string): Message {
        return {
            text:
                `${deleted} deleted the webhook ${this.name}. `,
            author: {
                name: "Info",
                img:
                    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png",
            },
            time: new Date(new Date().toUTCString()),
            tag: {
                text: 'BOT',
                color: 'white',
                bg_color: 'black'
            }
        }
    }

    /**
     * Generates a message indicating a webhook's update
     * @param updater The user who updated the webhook
     * @returns {Message} A message indicating the webhook's update
     * @since webhooks v1.0
     */
    generateUpdatedMessage(updater: string): Message {
        return {
            text:
                `${updater} edited the webhook ${this.name}. `,
            author: {
                name: "Info",
                img:
                    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png",
            },
            time: new Date(new Date().toUTCString()),
            tag: {
                text: 'BOT',
                color: 'white',
                bg_color: 'black'
            }
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
    update(name: string, image: string, updater: string): Message {
        const msg = this.generateUpdatedMessage(updater);
        this.name = name;
        this.image = image;

        let webhooks = Webhook.getWebhooks();
        webhooks = webhooks.filter(webhook => webhook.id !== this.id);

        webhooks.push(this)

        json.write('webhooks.json', webhooks);

        return msg;
    }

    /**
     * Deletes a webhook
     * @param {string} deleted The user who deleted the webhook
     * @returns {Message} A message indicating the webhook's deletion
     * @since webhooks v1.0
     */
    remove(deleted: string): Message {
        let webhooks = Webhook.getWebhooks();
        webhooks = webhooks.filter(webhook => webhook.id !== this.id);
        json.write('webhooks.json', webhooks);

        return this.generateDeletedMessage(deleted);
    }

    /**
     * Gets a webhook
     * @param {string} id The id of the webhook to get
     * @returns {Webhook} The webhook with the given id
     * @since webhooks v1.0
     */
    static get(id: string): Webhook {
        const webhooks = Webhook.getWebhooks();
        for (const webhook of webhooks)
            if (webhook.id === id)
                return new Webhook(webhook.name, webhook.image, webhook.ids, webhook.id);

        return null;
    }

    /**
     * Generates webhook data for the onload data
     * @param {string} userName The name of the user to generate the webhook data for
     * @returns {Array} The webhook data for the given user
     * @since webhooks v1.0
     */
    static getWebhooksData(userName: string) {
        const res = [];
        const webhooks = Webhook.getWebhooks();
        for (const webhook of webhooks) {
            res.push({
                name: webhook.name,
                image: webhook.image,
                id: webhook.ids[userName],
                globalId: webhook.id
            })
        }
        return res;
    }


}