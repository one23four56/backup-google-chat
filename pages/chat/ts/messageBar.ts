import { me, socket } from "./script";
import { prompt, confirm, alert, sideBarAlert } from './popups';
import { emojiSelector } from "./functions";
import { AllowedTypes } from "../../../ts/lib/socket";
import type { PollData, SubmitData } from "../../../ts/lib/socket";
import Channel from "./channels";
import type { ProtoWebhook } from "../../../ts/modules/webhooks";
import type { BotData } from "../../../ts/modules/bots";
import Room from "./rooms";
import ImageContainer from "./imageContainer";
import Settings from "./settings";
import { loadSVG } from "./ui";
import { openPollCreator } from './polls';

export interface MessageBarData {
    name: string;
    placeHolder?: string;
    hideWebhooks?: boolean;
}

export class MessageBar extends HTMLElement {

    attachedImagePreview: HTMLDivElement;

    profilePicture: HTMLImageElement;

    webhookOptions: HTMLDivElement;

    formItems: {
        form: HTMLFormElement;
        // archive: HTMLInputElement;
        // archiveLabel: HTMLLabelElement;
        // emoji: HTMLElement;
        submit: HTMLButtonElement;
        buttonHolder: HTMLDivElement;
    };

    container: DynamicTextContainer;

    commandHelpHolder: HTMLDivElement;

    name: string;
    hideWebhooks: boolean;
    placeHolder: string;

    media: string[] = [];
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

    private imagePreviewList: [string, HTMLElement][] = [];

    private typingDiv: HTMLDivElement;

    poll?: PollData;

    links: string[] = [];

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

        this.attachedImagePreview = document.createElement("div")
        this.attachedImagePreview.className = "attached-image-preview-container";

        // create profile picture stuff

        this.profilePicture = document.createElement('img');

        this.profilePicture.alt = "Profile Picture Display";
        this.profilePicture.className = "profile-picture";


        // create webhook options stuff 

        this.webhookOptions = document.createElement('div');

        this.webhookOptions.classList.add('webhook-options', 'hidden');

        // create form stuff

        this.formItems = {
            form: document.createElement('form'),
            // // archive: document.createElement('input'),
            // archiveLabel: document.createElement('label'),
            submit: document.createElement('button'),
            // emoji: document.createElement("i"),
            buttonHolder: document.createElement("div")
        }

        this.container = new DynamicTextContainer();
        this.resetPlaceholder();

        this.formItems.form.classList.add('message-form');
        this.formItems.form.autocomplete = "off";

        // this.formItems.text.type = "text";
        // this.formItems.text.placeholder = this.placeHolder;
        // this.formItems.text.name = "text";
        // this.formItems.text.maxLength = 100;
        // this.formItems.text.spellcheck = true;

        // this.formItems.archive.type = "checkbox";
        // this.formItems.archive.name = this.name + "-archive-checkbox";
        // this.formItems.archive.checked = true;
        // this.formItems.archive.id = this.name + "-archive-checkbox";

        // this.formItems.archiveLabel.htmlFor = this.name + "-archive-checkbox";
        // this.formItems.archiveLabel.innerHTML = `<i class="fas fa-user-secret"></i><i class="fas fa-cloud"></i>`;

        {
            const emoji = document.createElement("i")
            emoji.classList.add("fa-regular", "fa-face-grin")
            emoji.title = "Insert emoji"
            emoji.addEventListener("click", event => {
                emojiSelector(event.clientX, event.clientY).then(emoji => {
                    this.container.insert(emoji)
                })
            })

            const file = document.createElement("i")
            file.title = "Upload a file"
            file.className = "fa-solid fa-arrow-up-from-bracket"
            file.addEventListener("click", () => {
                const upload = document.createElement("input");
                upload.type = "file";
                upload.accept = AllowedTypes.join(",");
                upload.click();

                upload.addEventListener("change", () => loadFiles(upload.files));

                upload.remove();
            })

            const link = document.createElement("i")
            link.title = "Attach a link"
            link.className = "fa-solid fa-paperclip"
            link.addEventListener("click", () => this.promptLinkAttachment())

            this.addEventListener("keydown", event => {
                if (event.key === 's' && event.ctrlKey) {
                    event.preventDefault();
                    this.promptLinkAttachment();
                }
            })

            const poll = document.createElement("i")
            poll.title = "Create a poll"
            poll.className = "fa-solid fa-chart-pie"
            poll.addEventListener("click", () => openPollCreator(this))

            this.formItems.buttonHolder.className = "button-holder"
            this.formItems.buttonHolder.append(
                emoji,
                file,
                poll,
                link,
            )
        }

        this.formItems.submit.type = "submit";
        loadSVG('send').then(element => this.formItems.submit.appendChild(element))

        this.container.append(this.formItems.buttonHolder);
        this.formItems.form.append(
            this.container,
            // this.formItems.archive,
            // this.formItems.archiveLabel,
            this.formItems.submit,
            // this.formItems.emoji,
        )

        // create command helper display

        this.commandHelpHolder = document.createElement("div");
        this.commandHelpHolder.classList.add("command-help");

        this.container.addEventListener("blur", () => this.resetCommandHelp()) // weird scope stuff so i gotta use lambda

        // initialize webhooks

        if (!this.hideWebhooks) {
            this.append(this.webhookOptions, this.profilePicture)
            this.resetImage();
        }

        // append 

        this.append(
            this.attachedImagePreview,
            this.formItems.form,
            this.commandHelpHolder
        )

        // add webhookOptions opener 

        this.profilePicture.onclick = e => {
            if (this.blockWebhookOptions) return;

            this.webhookOptions.classList.toggle("hidden")

            if (this.webhookOptions.classList.contains("hidden"))
                return;

        };

        // set up event listeners/emitters 

        this.formItems.submit.addEventListener("click", () => this.container.triggerText());

        this.container.addEventListener('text', (e) => {
            e.preventDefault();

            const data: SubmitData = {
                text: e.detail,
                archive: true,
                webhook: this.webhook,
                replyTo: this.replyTo,
                media: this.media.length >= 1 ? this.media : undefined,
                poll: this.poll,
                links: this.links.length >= 1 ? this.links : undefined
            }

            if (data.text.trim().length <= 0 && !data.media)
                return;

            this.replyTo = null;
            this.media = [];
            this.resetImagePreview();
            this.resetPlaceholder();
            // this.resetImage();
            this.resetCommandHelp();

            if (this.tempOverrideSubmitHandler) {
                this.tempOverrideSubmitHandler(data);
                this.tempOverrideSubmitHandler = undefined;
            } else if (this.submitHandler)
                this.submitHandler(data);

        })

        this.container.addEventListener("input", event => {
            const text = this.container.text.trim();

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

        // set up media listeners

        const loadFiles = async (files: FileList) => {
            for (const file of files) {

                const max = 5e6; // socket refuses requests above 5mb (5e6 = 5mb), this is to prevent user confusion

                if (!AllowedTypes.includes(file.type))
                    return alert(`File '${file.name}' is of type '${file.type}', which is not allowed.`, `File not Allowed`)

                if (file.size > max)
                    return alert(`The file '${file.name}' has a size of ${(file.size / 1e6).toFixed(2)} MB, which is ${((file.size - max) / 1e6).toFixed(2)} MB over the maximum size of ${max / 1e6} MB.`, `File too Large`)

                if (this.media.length + this.links.length >= 3)
                    return alert(`Sorry, you cannot attach more than 3 files or links to a message`)


                // get bytes

                const bits = await file.arrayBuffer()

                const bytes = new Uint8Array(bits)

                // upload file

                const close = sideBarAlert(`Uploading '${file.name}' (${(file.size / 1e6).toFixed(2)} MB)...`, undefined, `../public/mediashare.png`)

                socket.emit("mediashare upload", this.channel.id, {
                    type: file.type,
                    name: file.name
                }, bytes, id => {

                    close()

                    const link = this.channel.mediaGetter.getUrlFor(id);

                    if (this.imagePreviewList.some(e => e[0] === link))
                        return sideBarAlert(`Duplicate file uploaded`, 4000, `../public/mediashare.png`)

                    sideBarAlert(`Upload completed (${(file.size / 1e6).toFixed(2)} MB)`, 4000, `../public/mediashare.png`)

                    this.addImagePreview(link)

                    this.media.push(id);

                })

            }
        }

        this.container.addEventListener("paste", event => {
            loadFiles(event.clipboardData.files)
        })

        this.container.addEventListener("drop", event => {
            loadFiles(event.dataTransfer.files)
        })

        this.container.addEventListener("dragover", event => {
            event.preventDefault()
            event.dataTransfer.dropEffect = "copy"
        })

        this.typingDiv = this.appendChild(document.createElement("div"))
        this.typingDiv.className = "typing";
    }

    addImagePreview(url: string) {
        const element = this.attachedImagePreview.appendChild(
            new ImageContainer(
                url,
                {
                    name: "fa-xmark",
                    alwaysShowing: true,
                    title: "Remove image"
                },
                () => {
                    this.removeImagePreview(url);
                    this.media = this.media.filter(i => !url.includes(i))
                }
            )
        )

        this.imagePreviewList.push([url, element])
    }

    resetImagePreview() {
        this.attachedImagePreview.innerText = "";
        this.imagePreviewList = [];
        this.poll = undefined;
        this.links = [];
    }

    removeImagePreview(url: string) {
        const item = this.imagePreviewList.find(i => i[0] === url);

        if (!item)
            return;

        item[1].remove();

        this.imagePreviewList = this.imagePreviewList.filter(i => i[0] !== url)
    }

    /**
     * Sets the placeholder text  
     * Can be reset using resetPlaceholder()
     * @param text Text to set the placeholder to
     */
    setPlaceholder(text: string) {
        this.container.placeholder = text;
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
            if (hasAccess)
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

            if (!Settings.get("hide-webhooks") || hasAccess)
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
                        if ((this.channel as Partial<Room>).options?.privateWebhooksAllowed === true)
                            confirm("Do you want the webhook to be public (anyone can use it)?", "Make Public?").then(res => {
                                socket.emit('add-webhook', this.channel.id, {
                                    name: name,
                                    image: avatar,
                                    private: !res
                                });
                            });
                        else
                            socket.emit('add-webhook', this.channel.id, {
                                name: name,
                                image: avatar,
                                private: false
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
        this.commandHelpHolder.style.bottom = this.bottom;
    }

    resetCommandHelp() {
        this.commandHelpHolder.innerText = ""
        this.commandHelpHolder.style.display = "none"
    }

    get bottom() {
        return this.getBoundingClientRect().height + "px"
    }

    get left() {
        return this.getBoundingClientRect().left + "px"
    }

    set typing(names: string[]) {

        const chatView = this.channel.chatView;

        if (names.length >= 1) {

            const scrollDown =
                Math.abs(
                    chatView.scrollHeight -
                    chatView.scrollTop -
                    chatView.clientHeight
                ) <= 3

            this.classList.add("typing")

            if (scrollDown) chatView.scrollTop = chatView.scrollHeight;

            this.typingDiv.innerText = names.length === 1 ?
                `${names[0]} is typing` : names.length === 2 ?
                    `${names[0]} and ${names[1]} are typing` : names.length === 3 ?
                        `${names[0]}, ${names[1]}, and ${names[2]} are typing` :
                        `${names.length} people are typing`
        } else
            this.classList.remove("typing")

    }

    setPoll(poll: PollData) {
        this.poll = poll;

        this.attachedImagePreview.appendChild(
            new ImageContainer(
                '../public/poll.svg',
                {
                    name: 'fa-xmark',
                    alwaysShowing: false,
                    title: 'Remove poll'
                },
                container => {
                    container.remove()
                    this.poll = undefined;
                }
            )
        )
    }

    async promptLinkAttachment() {

        const link = await prompt("Enter a link to attach", "Attach Link", "", 100000)

        if (this.links.includes(link))
            return alert("That link is already attached", "Error");

        if (this.links.length + this.media.length >= 3)
            return alert("You can't attach more than 3 links or files to a message", "Error")

        try {
            new URL(link)
        } catch {
            return alert("The link you entered is invalid", "Invalid Link");
        }

        const container = this.addLink(link, '/public/link.svg')

        const res = await fetch(`/api/thumbnail?url=${link}`)

        if (res.ok)
            container.changeImage(await res.text())
    }

    addLink(link: string, thumbnail: string) {

        this.links.push(link);

        const container = new ImageContainer(
            thumbnail,
            {
                alwaysShowing: true,
                name: 'fa-xmark',
                title: "Remove link",
                text: new URL(link).host,
                isLink: true
            },
            container => {
                container.remove()
                this.links = this.links.filter(l => l !== link)
            }
        )

        this.attachedImagePreview.appendChild(
            container
        )

        return container;

    }

}

class DynamicTextContainer extends HTMLElement {

    private holder: HTMLDivElement;
    private label: HTMLDivElement;
    characterLimit: number = 5000;

    addEventListener(type: "text", listener: (this: DynamicTextContainer, ev: CustomEvent<string>) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener<K extends keyof HTMLElementEventMap>(type: K, listener: (this: DynamicTextContainer, ev: HTMLElementEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
        super.addEventListener(type, listener, options);
    }

    constructor() {
        super();

        this.label = this.appendChild(document.createElement("div"));
        this.label.classList.add("label");
        this.label.innerText = "Enter some text..."

        this.holder = this.appendChild(document.createElement("div"));

        this.holder.contentEditable = "true";
        this.holder.classList.add("holder")
        this.holder.spellcheck = true;

        this.holder.addEventListener("input", () => {
            if (this.holder.innerText !== "\n")
                this.label.style.display = "none";
            else
                this.label.style.display = "block";
        })

        this.holder.addEventListener("keydown", event => {
            if (this.disabled)
                return event.preventDefault();

            if (event.key !== 'Enter' || event.shiftKey)
                return;

            event.preventDefault();
            this.triggerText();
        })

        this.holder.addEventListener("paste", event => {
            event.preventDefault();
            this.insert(
                event.clipboardData.getData("text/plain")
            )
        })

        this.holder.addEventListener("input", () => {
            if (this.text.length >= this.characterLimit)
                this.classList.add("red");
            else
                this.classList.remove("red");
        })
    }

    set placeholder(text: string) {
        this.label.innerText = text;
    }

    get text(): string {
        return this.holder.innerText;
    }

    set text(text: string) {
        this.holder.innerText = text;

        if (text.length !== 0)
            this.label.style.display = "none";
        else
            this.label.style.display = "block";
    }

    disabled: boolean;

    insert(text: string) {

        if (this.disabled)
            return;

        // this is deprecated, but i don't care
        // honestly fuck whoever decided to deprecate this without adding ANY alternative
        // like seriously i tried using the selection api which worked until i tried doing 
        // it with multiple lines and then it stopped working, so i had to read about the
        // selection api which literally makes no fucking sense, and after THREE HOURS of 
        // researching and testing, i finally wrote some code that worked. then it stopped
        // working and i realized that i should have been using whatever the fuck ranges
        // are the entire time. after that i decided that having a line through a function 
        // isn't that bad after all. i fucking hate javascript
        document.execCommand("insertText", false, text);
        // if there is ever a non-deprecated way to do this, update this function

        if (this.text.length >= this.characterLimit)
            this.classList.add("red");
        else
            this.classList.remove("red");
    }

    triggerText() {
        if (this.text.length >= this.characterLimit)
            return;

        this.dispatchEvent(new CustomEvent<string>("text", {
            detail: this.holder.innerText.trimEnd(),
            bubbles: true
        }))

        this.holder.innerText = "";
        this.label.style.display = "block";
    }

    focus(options?: FocusOptions): void {
        // move selection to end of holder
        // https://stackoverflow.com/q/13513329/
        const selection = getSelection(), range = document.createRange();
        range.setStart(this.holder, 1);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);

        this.holder.focus(options);
    }
}

window.customElements.define("dynamic-text-container", DynamicTextContainer);