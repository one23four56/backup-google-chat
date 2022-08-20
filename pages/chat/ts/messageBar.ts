import { me, socket } from "./script";
import { prompt, confirm } from './popups';
import { emojiSelector, getSetting } from "./functions";
import { SubmitData } from "../../../ts/lib/socket";
import Channel from "./channels";
import { ProtoWebhook } from "../../../ts/modules/webhooks";
import { BotData } from "../../../ts/modules/bots";

export interface MessageBarData {
    name: string;
    placeHolder?: string;
    hideWebhooks?: boolean;
}

export class MessageBar extends HTMLElement {

    attachedImagePreview: {
        container: HTMLDivElement;
        image: HTMLImageElement;
        cancel: HTMLElement; // idk the type for <i>
    };

    profilePicture: HTMLImageElement;

    webhookOptions: HTMLDivElement;

    formItems: {
        form: HTMLFormElement;
        text: HTMLInputElement;
        archive: HTMLInputElement;
        archiveLabel: HTMLLabelElement;
        emoji: HTMLElement;
        submit: HTMLButtonElement;
    };

    commandHelpHolder: HTMLDivElement;

    name: string;
    hideWebhooks: boolean;
    placeHolder: string;

    image?: string;
    //TODO media?: any // tbd
    replyTo?: number;
    webhook?: {
        name: string;
        id: string;
        image: string;
    };

    blockWebhookOptions?: boolean;

    channel?: Channel;
    isMain: boolean;

    commands?: string[];
    botData?: BotData[];

    /**
     * Called every time the input form is submitted
     * @param data Data from the form
     * @see tempOverrideSubmitHandler
     *  */
    submitHandler?: (data: SubmitData) => void;
    /**
    * Called one time when the input form is next submitted, then deleted. Overrides submitHandler.
    * @param data Data from the form
    * @see submitHandler
    *  */
    tempOverrideSubmitHandler?: (data: SubmitData) => void;

    constructor(data: MessageBarData) {
        super();

        this.style.display = 'none';


        // save data

        this.name = data.name;
        this.hideWebhooks = data.hideWebhooks || false;
        this.placeHolder = data.placeHolder || 'Enter a message...';
        
        // create attached image preview stuff

        this.attachedImagePreview = {
            container: document.createElement('div'),
            image: document.createElement('img'),
            cancel: document.createElement('i')
        }

        this.attachedImagePreview.container.style.display = 'none';
        this.attachedImagePreview.image.hidden = true;
        this.attachedImagePreview.image.ariaHidden = "true";
        this.attachedImagePreview.cancel.innerText = "&#xf00d;";
        this.attachedImagePreview.cancel.classList.add('fa');
        this.attachedImagePreview.container.className = "attached-image-preview";

        this.attachedImagePreview.container.append(
            this.attachedImagePreview.image,
            this.attachedImagePreview.cancel
        )

        // create profile picture stuff

        this.profilePicture = document.createElement('img');

        this.profilePicture.alt = "Profile Picture Display";
        this.profilePicture.className = "profile-picture";

        // create webhook options stuff 

        this.webhookOptions = document.createElement('div');

        this.webhookOptions.style.display = "none";
        this.webhookOptions.classList.add('webhook-options');

        // create form stuff

        this.formItems = {
            form: document.createElement('form'),
            text: document.createElement('input'),
            archive: document.createElement('input'),
            archiveLabel: document.createElement('label'),
            submit: document.createElement('button'),
            emoji: document.createElement("i")
        }

        this.formItems.form.classList.add('message-form');
        this.formItems.form.autocomplete = "off";

        this.formItems.text.type = "text";
        this.formItems.text.placeholder = this.placeHolder;
        this.formItems.text.name = "text";
        this.formItems.text.maxLength = 100;
        this.formItems.text.spellcheck = true;

        this.formItems.archive.type = "checkbox";
        this.formItems.archive.name = this.name + "-archive-checkbox";
        this.formItems.archive.checked = true;
        this.formItems.archive.id = this.name + "-archive-checkbox";

        this.formItems.archiveLabel.htmlFor = this.name + "-archive-checkbox";
        this.formItems.archiveLabel.innerHTML = `<i class="fas fa-user-secret"></i><i class="fas fa-cloud"></i>`;

        this.formItems.emoji.classList.add("emoji", "fa-regular", "fa-face-grin")
        this.formItems.emoji.addEventListener("click", event => {
            emojiSelector(event.clientX, event.clientY).then(emoji => {
                this.formItems.text.value += emoji
            })
        })

        this.formItems.submit.type = "submit";
        this.formItems.submit.innerHTML = `<i class="fas fa-paper-plane"></i>`;

        this.formItems.form.append(
            this.formItems.text,
            this.formItems.archive,
            this.formItems.archiveLabel,
            this.formItems.submit,
            this.formItems.emoji
        )

        // create command helper display

        this.commandHelpHolder = document.createElement("div");
        this.commandHelpHolder.classList.add("command-help");

        this.formItems.text.addEventListener("blur", () => this.resetCommandHelp()) // weird scope stuff so i gotta use lambda

        // initialize webhooks

        if (!this.hideWebhooks) {
            this.append(this.webhookOptions, this.profilePicture)
            this.resetImage();
        }

        // append 

        this.append(
            this.attachedImagePreview.container,

            this.formItems.form,
            this.commandHelpHolder
        )

        // add webhookOptions opener 

        this.profilePicture.onclick = e => {
            if (this.blockWebhookOptions) return;

            this.webhookOptions.style.display = this.webhookOptions.style.display == "block" ? "none" : "block";
        };

        // set up event listeners/emitters 


        this.formItems.form.addEventListener('submit', (e) => {
            e.preventDefault();

            const data: SubmitData = {
                text: this.formItems.text.value,
                archive: this.formItems.archive.checked,
                image: this.image,
                webhook: this.webhook,
                replyTo: this.replyTo
            }

            this.formItems.text.value = '';
            this.replyTo = null;
            this.resetImagePreview();
            this.resetPlaceholder();
            this.resetImage();
            this.resetCommandHelp();

            if (this.tempOverrideSubmitHandler) {
                this.tempOverrideSubmitHandler(data);
                this.tempOverrideSubmitHandler = undefined;
            } else if (this.submitHandler)
                this.submitHandler(data);

        })

        this.formItems.text.addEventListener("input", event => {

            const text = this.formItems.text.value

            if (!text.includes("/") || !this.commands || !this.botData) {
                this.resetCommandHelp();
                return;
            }

            const list: string[] = this.commands.filter(command => {

                const fullCommand = `/${command} `
                    .slice(0, text.length)

                if (text.includes(fullCommand)) return true;
                
                return false;

            })


            if (list.length === 0) 
                this.resetCommandHelp();

            else if (list.length > 1)
                this.setCommandHelp(
                    list.map(item => "/" + item), 
                    this.formItems.form.getBoundingClientRect().left + "px")
            
            else if (list.length === 1) {

                const command = list[0]

                for (const botData of this.botData) {

                    const commandData = botData.commands.find(data => command === data.command)

                    if (!commandData)
                        continue;

                    this.setCommandHelp(
                        [`/${command} ${commandData.args.join(" ")}`],
                        this.formItems.form.getBoundingClientRect().left + "px"
                    )
                    
                }
            } 
            
        })

    }

    setImagePreview(image: string) {

    }

    resetImagePreview() {

    }

    /**
     * Sets the placeholder text  
     * Can be reset using resetPlaceholder()
     * @param text Text to set the placeholder to
     */
    setPlaceholder(text: string) {
        this.formItems.text.placeholder = text;
    }

    /**
     * Resets the placeholder to the default value  
     * If a webhook is selected, it will be reset to the webhook default placeholder
     */
    resetPlaceholder() {
        if (!this.webhook) this.setPlaceholder(this.placeHolder);
        else this.setPlaceholder(`Send a message as ${this.webhook.name}...`);
    }

    /**
     * Loads the webhooks
     * @returns True if successful, void if not
     */
    loadWebhooks(webhooks: ProtoWebhook[]) {
        // copy webhook stuff from dataHandler.ts over to here

        this.webhookOptions.innerHTML = "";

        // add user's name display

        {
            const holder = document.createElement("div");
            holder.classList.add("webhook-option");
            holder.dataset.type = "user";

            const image = document.createElement("img");
            image.src = me.img;
            image.alt = me.name + " (Icon)";

            const name = document.createElement("h2");
            name.innerText = me.name;

            holder.append(image, name);

            holder.addEventListener("click", () => {
                this.resetWebhook();
                this.resetPlaceholder();
                this.resetImage();

                this.webhookOptions.style.display = "none"
            })

            this.webhookOptions.appendChild(holder)
        }

        // create webhook displays

        if (webhooks.length >= 5) this.webhookOptions.style["overflow-y"] = "scroll";

        if (this.webhook && !webhooks.find(check => check.id === this.webhook.id))
            this.resetWebhook();

        for (const webhook of webhooks) {

            if (this.webhook && this.webhook.id === webhook.id) 
                this.webhook = {
                    id: webhook.id,
                    name: webhook.name,
                    image: webhook.image
                }

            const hasAccess = ((me.id === webhook.owner) || !webhook.isPrivate);

            const holder = document.createElement("div");
            holder.classList.add("webhook-option");
            holder.dataset.type = "webhook";
            holder.dataset.id = webhook.id;
            holder.dataset.image = webhook.image;
            holder.dataset.name = webhook.name;

            const image = document.createElement("img");
            image.src = webhook.image;
            image.alt = webhook.name + " (Icon)";

            const name = document.createElement("h2");
            name.innerText = webhook.name;
            if (!hasAccess) name.innerHTML += ` <i class="fa fa-lock"></i>`;

            const options = document.createElement("div");
            options.classList.add("options");

            const editOption = document.createElement("i");
            editOption.className = "far fa-edit fa-fw";

            editOption.onclick = _ => {
                prompt('What do you want to rename the webhook to?', 'Rename Webhook', webhook.name, 50).then(name => {
                    prompt('What do you want to change the webhook avatar to?', 'Change Avatar', webhook.image, 9999999).then(avatar => {
                        const webhookData = {
                            newName: name,
                            newImage: avatar,
                        };
                        socket.emit('edit-webhook', this.channel.id, {
                            webhookData: webhookData,
                            id: webhook.id
                        });
                    })
                        .catch()
                })
                    .catch()
            }

            // let copyOption = document.createElement("i");
            // copyOption.className = "far fa-copy fa-fw"
            // copyOption.onclick = _ => {
            //     navigator.clipboard.writeText(`${location.origin}/webhookmessage/${elmt.getAttribute("data-webhook-id")}`)
            //         .then(_ => alert('The link to programmatically send webhook messages has been copied to your clipboard.\nPlease do not share this link with anyone, including members of this chat.', 'Link Copied'))
            //         .catch(_ => alert(`The link to programmatically send webhook messages could not be copied. It is:\n${`${location.origin}/webhookmessage/${elmt.getAttribute("data-webhook-id")}`}\nPlease do not share this link with anyone, including members of this chat.`, 'Link not Copied'))
            // }

            const deleteOption = document.createElement("i");
            deleteOption.className = "far fa-trash-alt fa-fw";

            deleteOption.onclick = _ => {
                confirm(`Are you sure you want to delete webhook ${webhook.name}?`, 'Delete Webhook?')
                    .then(res => {
                        if (res) socket.emit('delete-webhook', this.channel.id, webhook.id);
                    })
            }

            if (hasAccess) options.appendChild(editOption);
            // if (hasAccess) options.appendChild(copyOption);
            options.appendChild(deleteOption);

            holder.append(
                image,
                name,
                options
            );

            holder.addEventListener("click", () => {
                if (!hasAccess) return;

                this.webhook = {
                    name: webhook.name,
                    id: webhook.id,
                    image: webhook.image
                }

                this.setPlaceholder(`Send message as ${webhook.name}...`)
                this.setImage(webhook.image)

                this.webhookOptions.style.display = "none"
            })

            if (!getSetting("misc", "hide-private-webhooks") || hasAccess) 
                this.webhookOptions.appendChild(holder);

        }

        // create add webhook display

        {
            const holder = document.createElement("div");
            holder.classList.add("webhook-option");

            const image = document.createElement("img");
            image.src = "https://img.icons8.com/ios-filled/50/000000/plus.png";
            image.alt = "Add Webhook (Icon)"

            const name = document.createElement("h2");
            name.innerText = "Add Webhook";

            holder.append(image, name);

            holder.onclick = _ => {
                prompt("What do you want to name this webhook?", "Name Webhook", "unnamed webhook", 50).then(name => {
                    prompt("What do you want the webhook avatar to be?", "Set Avatar", "https://img.icons8.com/ios-glyphs/30/000000/webcam.png", 9999999).then(avatar => {
                        confirm("Do you want the webhook to be public (anyone can use it)?", "Make Public?").then(res => {
                            socket.emit('add-webhook', this.channel.id, {
                                name: name,
                                image: avatar,
                                private: !res
                            });
                        });
                    })
                        .catch()
                })
                    .catch()
            }

            this.webhookOptions.appendChild(holder);
        }

        // webhooks are loaded
        return true; // let hypothetical function awaiting this know that it is done
    }

    resetWebhook() {
        this.webhook = undefined;
    }

    setImage(src: string) {
        this.profilePicture.src = src
    }

    resetImage() {
        if (!this.webhook) 
            this.profilePicture.src = globalThis.me.img;
        else 
            this.profilePicture.src = this.webhook.image
    }

    makeMain() {
        MessageBar.resetMain();

        this.isMain = true;
        this.style.display = "flex"
    }

    static resetMain() {
        document.querySelectorAll<MessageBar>("message-bar").forEach(bar => {
            bar.isMain = false;
            bar.style.display = "none";
        })
    }

    setCommandHelp(list: string[], left: string) {
        this.commandHelpHolder.innerText = ""

        for (const command of list) {

            const span = document.createElement("span")
            span.innerText = command;

            this.commandHelpHolder.appendChild(span)

        }

        this.commandHelpHolder.style.display = "block"
        this.commandHelpHolder.style.left = left;
    }

    resetCommandHelp() {
        this.commandHelpHolder.innerText = ""
        this.commandHelpHolder.style.display = "none"
    }
}