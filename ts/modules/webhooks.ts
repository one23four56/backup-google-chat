/**
 * @module webhooks
 * @version 1.0: created
 */
import { Users } from "./users";
import * as uuid from "uuid";
import Message from "../lib/msg";
import { WebhookData } from "../lib/misc";
import * as json from './json';

export interface ProtoWebhook {
    name: string;
    image: string;
    id: string;
    private?: boolean;
    owner?: string
    ids: {
        [key: string]: string;
    };
}


export class Webhooks {

    private path: string;

    constructor(path: string) {
        this.path = path;
    }

    getWebhooks(): ProtoWebhook[] {
        return json.read(this.path, true, "[]")
    }

    setWebhooks(webhooks: ProtoWebhook[]) {
        json.write(this.path, webhooks)
    }
}

/**
 * @classdesc Webhooks class
 */
export default class Webhook {
    name: string;
    image: string;
    id: string;
    private: boolean;
    owner: string;
    ids: {
        [key: string]: string;
    };

    /**
     * Creates a new webhook
     * @param {string} name The name of the webhook
     * @param {string} image The image of the webhook
     * @param {Object?} ids The ids of the webhook (used when generating from ProtoWebhook)
     * @param {string?} id The id of the webhook (used when generating from ProtoWebhook)
     * @since webhooks v1.0
     */
    constructor(name: string, image: string, isPrivate?: boolean, owner?: string, ids?: { [key: string]: string }, id?: string) {
            this.name = name;
            this.image = image;
            this.private = isPrivate
            this.ids = ids? ids : {};
            this.owner = owner
            this.id = id? id : uuid.v4();

            for (const user in Users.getUsers())
                this.ids[Users.getUsers()[user].name] = uuid.v4();
             
            // if (!id) { // only add to json when not creating from ProtoWebhook
            //     const webhooks = room.webhooks.getWebhooks();
            //     webhooks.push(this);
            //     json.write('webhooks.json', webhooks);
            // }
    }

    checkIfHasAccess(name: string): boolean {
        return ((name == this.owner) || !this.private);
    }

    /**
     * Generates a message indicating a webhook's creation
     * @param creator The creator of the webhook
     * @returns {Message} A message indicating the webhook's creation
     * @since webhooks v1.0
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
            id: 0, //room.archive.data.getDataReference().length
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
            id: 0, // room.archive.data.getDataReference().length
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
            id: 0, //room.archive.data.getDataReference().length
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

        // let webhooks = room.webhooks.getWebhooks();
        // webhooks = webhooks.filter(webhook => webhook.id !== this.id);

        // webhooks.push(this)

        // json.write('webhooks.json', webhooks);

        return msg;
    }

    /**
     * Deletes a webhook
     * @param {string} deleted The user who deleted the webhook
     * @returns {Message} A message indicating the webhook's deletion
     * @since webhooks v1.0
     */
    remove(deleted: string): Message {
        // let webhooks = room.webhooks.getWebhooks();
        // webhooks = webhooks.filter(webhook => webhook.id !== this.id);
        // json.write('webhooks.json', webhooks);

        return this.generateDeletedMessage(deleted);
    }

    /**
     * Gets a webhook
     * @param {string} id The id of the webhook to get
     * @returns {Webhook|void} The webhook with the given id, or nothing if it doesn't exist
     * @since webhooks v1.0
     */
    static get(id: string): Webhook | void {
        // const webhooks = room.webhooks.getWebhooks();
        // for (const webhook of webhooks)
        //     if (webhook.id === id)
        //         return new Webhook(webhook.name, webhook.image, webhook.private, webhook.owner, webhook.ids, webhook.id);
    }

    /**
     * Generates webhook data for the onload data
     * @param {string} userName The name of the user to generate the webhook data for
     * @returns {Array<WebhookData>} The webhook data for the given user
     * @since webhooks v1.0
     */
    static getWebhooksData(userName: string) {
        // const res: WebhookData[] = [];
        // const webhooks = room.webhooks.getWebhooks();
        // for (const webhook of webhooks) {
        //     res.push({
        //         name: webhook.name,
        //         image: webhook.image,
        //         id: webhook.ids[userName],
        //         globalId: webhook.id,
        //         private: webhook.private,
        //         owner: webhook.owner
        //     })
        // }
        // return res;
    }


}