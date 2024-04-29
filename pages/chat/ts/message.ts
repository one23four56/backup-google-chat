
import { UserData } from '../../../ts/lib/authdata';
import MessageData, { MessageMedia } from '../../../ts/lib/msg';
import Channel from './channels';
import { me, socket } from './script';
import { ImageContainerOnClick, showMediaFullScreen } from './imageContainer'
import PollElement from './polls';
import { alert, sideBarAlert } from './popups';
import userDict from './userDict';

export default class Message extends HTMLElement {

    data: MessageData;
    authorItems: {
        [key: string]: HTMLElement
    } = {};
    channel: Channel;

    private holder: HTMLDivElement;
    private reactions: HTMLDivElement;
    private icons: HTMLDivElement;

    private p: HTMLParagraphElement;

    constructor(data: MessageData, channel: Channel) {
        super();

        this.data = data;

        this.channel = channel;
    }

    /**
     * Draws the message  
     * **NOTE:** Append the message before calling this
     */
    draw() {

        this.classList.add('message');

        this.dataset.id = this.data.id.toString();
        this.dataset.room = this.channel.id;
        this.dataset.author = this.data.author.id;

        const
            //* comments after definitions show what to append elements to
            holder = document.createElement('div'), // this
            icons = document.createElement('div'), // this
            b = document.createElement('b'), // holder
            p = document.createElement('p'), // holder
            img = document.createElement('img'), // this
            reactOption = document.createElement('i'); // icons

        icons.className = "icons";
        this.icons = icons;
        this.p = p;
        this.holder = holder;

        // set author data 

        if (this.data.author.webhookData) {
            this.title = "Sent by " + this.data.author.name;
            b.appendChild(document.createTextNode(this.data.author.webhookData.name))
        } else
            b.appendChild(document.createTextNode(this.data.author.name));

        if (this.data.notSaved)
            this.data.tags ?
                this.data.tags.push({ color: 'white', bgColor: '#cc00ff', text: 'NOT SAVED' }) :
                this.data.tags = [{ color: 'white', bgColor: '#cc00ff', text: 'NOT SAVED' }]

        if (this.data.tags) {
            for (const tag of Message.createTags(this.data.tags))
                b.appendChild(tag)
        }

        const daysAgo = Math.floor((Date.now() - Date.parse(this.data.time as unknown as string)) / 1000 / 60 / 60 / 24)

        let format: Intl.DateTimeFormatOptions;
        if (new Date(this.data.time).toLocaleDateString() === new Date().toLocaleDateString())
            format = {
                hour: 'numeric',
                minute: '2-digit'
            }
        else if (daysAgo < 6)
            format = {
                hour: 'numeric',
                minute: '2-digit',
                weekday: 'long'
            }
        else if (new Date().getFullYear() === new Date(this.data.time).getFullYear())
            format = {
                hour: 'numeric',
                minute: '2-digit',
                month: 'short',
                day: 'numeric'
            }
        else format = {
            hour: 'numeric',
            minute: '2-digit',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }

        b.appendChild(document.createElement('span')).innerText = new Date(this.data.time).toLocaleString('en-US', format);

        img.src =
            this.data.author.webhookData ?
                this.data.author.webhookData.image :
                this.data.author.image;

        this.authorItems.b = b;
        this.authorItems.img = img;

        holder.appendChild(b);

        // clicking opens user card if user is in userDict

        if (userDict.has(this.data.author.id)) {
            img.style.cursor = "pointer";
            img.addEventListener("click",
                () => {
                    const data = userDict.getData(this.data.author.id)
                    userDict.generateUserCard(data.userData, data.dm).showModal()
                }
            );
        }

        // set message contents and detect links 

        if (typeof this.data.text !== "string")
            return;
        // accidentally added an object as text and it broke everything so i had to
        // add this lol

        // setting innerText converts \n to <br>
        // this allows line breaks in messages to work
        p.innerText = this.data.text;
        for (const originalNode of p.childNodes) {
            if (originalNode.nodeType !== 3)
                continue;

            let node = originalNode, lastLink = 0;
            const words = originalNode.textContent.split(" ");

            for (const [index, word] of words.entries()) {

                // check to see if it might be a valid url
                if (!word.startsWith("https://") && ![
                    ".com",
                    ".org",
                    ".net",
                    ".gov",
                    ".edu"
                ].map(e => word.endsWith(e)).includes(true))
                    continue;

                // check if valid url
                try {
                    const url = new URL(word.startsWith("https://") ? word : "https://" + word)

                    if (url.protocol !== "https:") // http not allowed 🤬😡 (i don't like http)
                        throw `trigger that catch statement`

                    // any url that gets past this point is treated as valid

                    const a = document.createElement("a")
                    a.href = url.toString()
                    a.innerText = word
                    a.target = "_blank"

                    const pad1 = document.createTextNode(" "), pad2 = document.createTextNode(" ");

                    node.textContent = words.slice(lastLink, index).join(" ");
                    node.after(pad1, a, pad2);
                    node = document.createTextNode(words.slice(index + 1).join(" "));
                    pad2.after(node);

                    lastLink = index + 1;

                    if (!this.data.links)
                        this.data.links = []

                    if (this.data.links.length + (this.data.media?.length ?? 0) + 1 <= 4 && !this.data.links.includes(url.toString()))
                        this.data.links.push(url.toString())

                } catch {
                    // invalid
                    continue;
                }

            }
        }

        if (this.data.notSaved) {
            const span = document.createElement("span")
            span.innerText = "*"
            span.style.color = "#cc00ff"
            p.appendChild(span)
        }

        holder.appendChild(p);

        // add editing and deleting buttons

        let deleteOption, editOption, replyOption, replyDisplay, reactionDisplay: HTMLDivElement;

        if (this.data.author.id === me.id && !this.data.notSaved) {
            deleteOption = document.createElement('i');
            deleteOption.className = "fas fa-trash-alt";
            deleteOption.style.cursor = "pointer";
            deleteOption.dataset.hotkey = "d";

            deleteOption.addEventListener('click', () => this.channel.initiateDelete(this.data.id))

            editOption = document.createElement('i');
            editOption.className = "fas fa-edit";
            editOption.style.cursor = "pointer";
            editOption.dataset.hotkey = "e";

            editOption.addEventListener('click', () => this.channel.initiateEdit(this.data))

            editOption.title = "Edit Message\nShortcut: Select message and press E";
            deleteOption.title = "Delete Message\nShortcut: Select message and press D";
        }

        // handle links

        if (this.data.links)
            for (const link of this.data.links) {

                const url = new URL(link)

                const media: MessageMedia = {
                    clickURL: link,
                    location: '/public/link.svg',
                    type: 'link',
                    icon: {
                        alwaysShowing: false,
                        name: 'fa-up-right-from-square',
                        title: link,
                        text: url.host,
                        isLink: true
                    }
                }

                // handle youtube urls

                if (
                    (url.origin === "https://www.youtube.com"
                        && url.pathname === "/watch"
                        && url.searchParams.has('v'))
                    || (url.origin === "https://youtu.be")
                ) {
                    media.icon.name = 'fa-play';
                    media.icon.alwaysShowing = true;
                    media.icon.title = "Watch video on YouTube";
                    media.icon.outlineColor = "#ff4d4d";
                    media.icon.color = 'white'
                    media.icon.text = undefined;
                }

                // add to media list

                this.data.media = !this.data.media ?
                    [media] :
                    [...this.data.media, media]

            }

        // add image support

        if (this.data.media)
            for (const media of this.data.media) {

                const onclick: ImageContainerOnClick = (data) => {
                    if (data.error)
                        return typeof data.error === "string" ?
                            alert(data.error, "Media Error") :
                            alert(data.error.responseText ?? data.error.statusText, `Media Error (${data.error.statusText})`);

                    if (data.url && !data.data)
                        return window.open(media.clickURL || media.location);

                    if (!data.url || !data.data) return; // just in case idk

                    showMediaFullScreen(this.channel, data.data, data.url);
                };

                if (media.type === "link" && !media.icon)
                    media.icon = {
                        name: "fa-up-right-from-square",
                        alwaysShowing: false,
                        title: "Open in new tab"
                    }
                else if (!media.icon)
                    media.icon = {
                        name: "fa-up-right-and-down-left-from-center",
                        alwaysShowing: false,
                        title: "Show full size"
                    }

                if (!this.holder.querySelector("image-container"))
                    this.holder.appendChild(document.createElement("br"))

                const container = this.holder.appendChild(
                    this.channel.share.imageContainer(media, onclick)
                );

                if (media.type === 'link' && media.icon.isLink)
                    fetch(`/api/thumbnail?url=${media.clickURL}`).then(res => {
                        if (res.ok)
                            res.text().then(text => container.changeImage(text))
                    })

            }

        // add poll support 

        if (this.data.poll)
            holder.appendChild(new PollElement(this.data.poll, this.channel))

        // add reaction support

        reactOption.className = "fa-regular fa-face-grin";
        reactOption.style.cursor = "pointer";
        reactOption.title = "React to Message\nShortcut: Select message and press A";
        reactOption.classList.add("hide-on-mobile");
        reactOption.addEventListener('click', event => this.channel.initiateReaction(this.data.id, event.clientX, event.clientY));
        reactOption.dataset.hotkey = "a"

        if (this.data.reactions && Object.keys(this.data.reactions).length !== 0) {

            reactionDisplay = document.createElement('div');
            reactionDisplay.className = "reaction-display";

            for (const emoji in this.data.reactions) {
                let reaction = document.createElement('p');
                reaction.className = "reaction";
                if (this.data.reactions[emoji].map(user => user.name).includes(globalThis.me.name))
                    reaction.classList.add('mine');
                reaction.innerText = `${emoji} ${this.data.reactions[emoji].length}`;


                reaction.title = this.data.reactions[emoji].map(user => user.name).join(', ')
                    + ` reacted with ${emoji}`;

                reaction.addEventListener('click', _ => socket.emit('react', this.channel.id, this.data.id, emoji));

                reactionDisplay.appendChild(reaction);
            }

            this.reactions = reactionDisplay;

            holder.appendChild(reactionDisplay);

        }

        // add reply support 

        if (!this.data.notSaved) {
            replyOption = document.createElement('i');
            replyOption.title = "Reply to Message\nShortcut: Select message and press R";
            replyOption.className = "fa-solid fa-reply"
            replyOption.classList.add("hide-on-mobile");
            replyOption.style.cursor = "pointer";
            replyOption.dataset.hotkey = "r";

            replyOption.addEventListener("click", () => {
                this.channel.initiateReply(this.data)
            })
        }

        // display og message if this is a reply

        if (this.data.replyTo) {
            this.classList.add("has-reply")
            replyDisplay = document.createElement('div');
            replyDisplay.className = "reply"

            const
                replyIcon = document.createElement('i'),
                replyImage = document.createElement('img'),
                replyName = document.createElement('b'),
                replyText = document.createElement('span');

            replyImage.className = "reply";
            replyName.className = "reply";
            replyText.className = "reply";
            replyIcon.className = "reply fa-solid fa-reply fa-flip-horizontal"

            replyImage.src =
                this.data.replyTo.author.webhookData ?
                    this.data.replyTo.author.webhookData.image :
                    this.data.replyTo.author.image;

            if (this.data.replyTo.author.webhookData)
                replyName.appendChild(document.createTextNode(
                    this.data.replyTo.author.webhookData.name
                ))
            else
                replyName.appendChild(document.createTextNode(
                    this.data.replyTo.author.name
                ))

            const text = this.data.replyTo.text.length > 83 ? this.data.replyTo.text.slice(0, 81) + "..." : this.data.replyTo.text;
            replyText.append(text);
            // append instead of innerText to ignore line breaks

            if (this.data.replyTo.tags) {
                for (const tag of Message.createTags(this.data.replyTo.tags))
                    replyName.appendChild(tag)
            }


            this.appendChild(replyIcon)
            replyDisplay.appendChild(replyImage)
            replyDisplay.appendChild(replyName)
            replyDisplay.appendChild(replyText)

            replyDisplay.addEventListener('click', (ev: MouseEvent) => {
                ev.stopPropagation()
                this.channel.scrollToMessage(this.data.replyTo.id)
            })
        }

        // load read icons

        if (this.data.readIcons)
            this.data.readIcons
                .filter(i => i.id !== me.id)
                .forEach(
                    (item, index) => {

                        if (index === 0)
                            this.holder.appendChild(document.createElement("br"))

                        this.holder.appendChild(Message.createReadIcon(item))

                        if (Math.abs(this.channel.chatView.scrollHeight - this.channel.chatView.scrollTop - this.channel.chatView.clientHeight) <= 50)
                            this.channel.chatView.scrollTop = this.channel.chatView.scrollHeight;

                    }
                )

        if (replyDisplay) this.appendChild(replyDisplay);
        this.appendChild(img);
        this.appendChild(holder);
        if (!this.data.notSaved) icons.appendChild(reactOption);
        if (replyOption) icons.appendChild(replyOption)
        if (deleteOption) icons.appendChild(deleteOption);
        if (editOption) icons.appendChild(editOption);
        this.appendChild(icons);

        this.addEventListener("click", () => this.select());
    }

    clipLines() {
        // automatically clip message after 5 lines
        // to mitigate spam, messages above 5 lines must be manually un-clipped by the user

        if (isNaN(this.lineCount))
            throw new Error(`message ${this.data.id}: line count is NaN. Was draw called before the message was appended?`)

        if (this.lineCount <= 5)
            return;

        const expand = document.createElement("button");
        expand.innerText = `Show full message (${this.lineCount - 5} more line${this.lineCount - 5 === 1 ? "" : "s"})`;
        expand.classList.add("expand");

        this.p.style.maxHeight = (this.lineHeight * 5) + "px";
        this.p.after(document.createElement("br"), expand);

        let expanded = false;

        expand.addEventListener("click", event => {
            event.stopPropagation();

            expanded || (this.p.style.maxHeight = "");

            expand.innerText = !expanded ?
                "Hide full message" :
                `Show full message (${this.lineCount - 5} more line${this.lineCount - 5 === 1 ? "" : "s"})`;

            expanded && (this.p.style.maxHeight = (this.lineHeight * 5) + "px");

            expanded = !expanded;
            this.scrollIntoView();
        })
    }

    /**
     * Updates a message's data, then redraws it
     * @param data Data to set to
     */
    update(data: MessageData) {

        // update data
        this.data = data;

        // reset element properties
        this.innerText = "";
        this.showAuthor();

        // redraw
        this.draw();
        this.clipLines();

        // scroll
        if (this.channel.chatView.scrolledToBottom) {

            this.channel.chatView.style.scrollBehavior = "auto"
            this.channel.chatView.scrollTo({
                top: this.channel.chatView.scrollHeight,
                behavior: 'auto'
            })
            this.channel.chatView.style.scrollBehavior = "smooth"
        }

    }

    /**
     * Hides the author display of a message
     */
    hideAuthor() {
        this.authorItems.b.style.display = "none";
        this.authorItems.img.style.height = "0px";
        this.style.marginTop = "0px";
    }

    /**
     * Shows the author display of a message
     */
    showAuthor() {
        this.authorItems.b.style.display = "inline-flex";
        this.authorItems.img.style.height = "4.5vh";
        this.style.marginTop = "1vh";
    }

    static createTags(tags: MessageData["tags"]) {

        const output = [];

        for (const tag of tags) {
            const p = document.createElement("p")
            p.className = "tag"

            p.style.color = tag.color
            p.style.backgroundColor = tag.bgColor

            p.innerText = tag.text

            output.push(p)
        }

        return output;
    }


    /**
     * Adds an icon showing that a user read this message
     * @param userData UserData of the user
     */
    static createReadIcon(userData: UserData) {

        const icon = document.createElement("img")
        icon.title = userData.name + " read this message";
        icon.classList.add('read-icon')
        icon.src = userData.img

        return icon;

    }

    select() {

        Message.clearSelection()

        selectedMessage = this;

        this.classList.add('highlight', 'manual')

        const copy = this.appendChild(this.icons.cloneNode(true) as HTMLElement);
        copy.classList.add("hotkeys");
        copy.querySelectorAll("i").forEach(i => {
            i.className = "hotkey";
            i.innerText = i.dataset.hotkey;
        })

    }

    static clearSelection() {

        selectedMessage = undefined;

        document.querySelectorAll('message-element.highlight.manual').forEach(
            m => m.classList.remove("highlight", "manual")
        )

        document.querySelectorAll("message-element div.icons.hotkeys").forEach(
            d => d.remove()
        )

    }

    static getSelection(): Message {
        return selectedMessage;
    }

    get lineHeight(): number {
        return Number(getComputedStyle(this.p).getPropertyValue("line-height").replace("px", ""))
    }

    get lineCount(): number {
        return Math.round(this.p.offsetHeight / this.lineHeight)
    }

}

// message selection stuff

let selectedMessage: Message;

document.addEventListener("click",
    event => {

        const target = event.target as HTMLElement;

        if (typeof target.tagName !== "string")
            return;

        if (!target.matches(`message-element ${target.tagName.toLowerCase()}`))
            Message.clearSelection()

    }
)

document.addEventListener('keydown', event => {
    if (
        selectedMessage &&
        (event.key === 'a' || event.key === 'e' || event.key === 'd' || event.key === 'r' || (event.key === 'c' && event.ctrlKey)) &&
        document.activeElement.tagName.toLowerCase() !== "div"
    ) {
        event.preventDefault();

        const message: Message = selectedMessage;

        switch (event.key) {
            case 'a':
                // react
                // this one is the hardest to do since it doesn't work with just click()
                message.channel.initiateReaction(
                    message.data.id,
                    (message.getBoundingClientRect().left + message.getBoundingClientRect().right) / 2,
                    message.getBoundingClientRect().top
                )
                break;

            case 'e':
                // edit
                if (message.data.author.id === me.id)
                    message.channel.initiateEdit(message.data)
                break;

            case 'd':
                // delete
                if (message.data.author.id === me.id)
                    message.channel.initiateDelete(message.data.id)
                break;

            case 'r':
                // reply
                message.channel.initiateReply(message.data)
                break;

            case 'c':
                navigator.clipboard.writeText(message.data.text)
                    .then(() => sideBarAlert({
                        message: "Message copied to clipboard", expires: 3000
                    })).catch();
                break; // break is not needed here but i like it so it's here
        }

        Message.clearSelection()
    }
})