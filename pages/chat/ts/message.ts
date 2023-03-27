
import { UserData } from '../../../ts/lib/authdata';
import MessageData, { MessageMedia } from '../../../ts/lib/msg';
import Channel from './channels';
import { me, socket } from './script';
import ImageContainer, { showMediaFullScreen } from './imageContainer'
import PollElement from './polls';

export default class Message extends HTMLElement {

    data: MessageData;
    authorItems: {
        [key: string]: HTMLElement
    } = {};
    channel: Channel;

    private holder: HTMLDivElement;
    private reactions: HTMLDivElement;

    constructor(data: MessageData, channel: Channel) {
        super();

        this.data = data;

        this.channel = channel;
    }

    draw() {

        this.classList.add('message');

        this.dataset.id = this.data.id.toString();
        this.dataset.room = this.channel.id;
        this.dataset.author = this.data.author.id;

        const
            //* comments after definitions show what to append elements to
            holder = document.createElement('div'), // this
            b = document.createElement('b'), // holder
            p = document.createElement('p'), // holder
            img = document.createElement('img'), // this
            i = document.createElement('i'), // this
            reactOption = document.createElement('i'); // this


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

        img.src =
            this.data.author.webhookData ?
                this.data.author.webhookData.image :
                this.data.author.image;

        this.authorItems.b = b;
        this.authorItems.img = img;

        holder.appendChild(b);

        // set message contents and add link support and youtube thumbnail support

        for (const word of this.data.text.split(" ")) {

            // check to see if it might be a valid url
            if (!word.startsWith("https://") && ![
                ".com",
                ".org",
                ".net",
                ".gov",
                ".edu"
            ].map(e => word.endsWith(e)).includes(true)) {
                p.append(`${word} `)
                continue;
            }

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

                p.append(a, ' ')

                // handle youtube urls

                if (
                    (!this.data.media || this.data.media.length < 4) &&
                    (!this.data.media || !this.data.media.some(i => i.clickURL && i.clickURL === url.toString())) &&
                    (
                        (url.origin === "https://www.youtube.com"
                            && url.pathname === "/watch"
                            && url.searchParams.has('v')) 
                        || (url.origin === "https://youtu.be")
                    )
                ) {
                    const media: MessageMedia = {
                        type: 'link',
                        location: url.searchParams.has('v') ?
                            `https://img.youtube.com/vi/${url.searchParams.get('v')}/0.jpg` :
                            `https://img.youtube.com/vi/${url.pathname.split('/')[1]}/0.jpg`,
                        clickURL: url.toString(),
                        icon: {
                            name: 'fa-play',
                            alwaysShowing: true,
                            title: "Watch video on YouTube",
                            outlineColor: '#ff4d4d',
                            color: 'white'
                        }
                    };

                    this.data.media = !this.data.media ?
                        [media] :
                        [...this.data.media, media]
                }


            } catch {
                // invalid
                p.append(`${word} `)
                continue;
            }

        }

        if (this.data.notSaved) {
            const span = document.createElement("span")
            span.innerText = "*"
            span.style.color = "#cc00ff"
            p.appendChild(span)
        }

        holder.appendChild(p);

        i.innerText = new Date(this.data.time).toLocaleString();

        // add editing and deleting buttons

        let deleteOption, editOption, replyOption, replyDisplay, reactionDisplay: HTMLDivElement;

        if (this.data.author.id === me.id && !this.data.notSaved) {
            deleteOption = document.createElement('i');
            deleteOption.className = "fas fa-trash-alt";
            deleteOption.style.cursor = "pointer";
            deleteOption.classList.add("hide-on-mobile");

            deleteOption.addEventListener('click', () => this.channel.initiateDelete(this.data.id))

            editOption = document.createElement('i');
            editOption.className = "fas fa-edit";
            editOption.style.cursor = "pointer";
            editOption.classList.add("hide-on-mobile");

            editOption.addEventListener('click', () => this.channel.initiateEdit(this.data))

            editOption.title = "Edit Message";
            deleteOption.title = "Delete Message";
        }

        // add image support

        if (this.data.media)
            for (const media of this.data.media) {

                const onclick =
                    media.type === "media" ?
                        () => showMediaFullScreen(
                            this.channel.mediaGetter.getUrlFor(media, true),
                            this.channel.mediaGetter.getUrlFor(media, false)
                        )
                        :
                        () => window.open(
                            media.clickURL ?
                                media.clickURL :
                                this.channel.mediaGetter.getUrlFor(media, true)
                        )

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

                this.holder.append(
                    new ImageContainer(
                        this.channel.mediaGetter.getUrlFor(media),
                        media.icon,
                        onclick
                    )
                )
            }

        // add poll support 

        if (this.data.poll)
            holder.appendChild(new PollElement(this.data.poll, this.channel))

        // add reaction support

        reactOption.className = "fa-regular fa-face-grin";
        reactOption.style.cursor = "pointer";
        reactOption.title = "React to Message";
        reactOption.classList.add("hide-on-mobile");
        reactOption.addEventListener('click', event => this.channel.initiateReaction(this.data.id, event.clientX, event.clientY))

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
            replyOption.title = "Reply to Message";
            replyOption.className = "fa-solid fa-reply"
            replyOption.classList.add("hide-on-mobile");
            replyOption.style.cursor = "pointer";

            replyOption.addEventListener("click", () => {
                this.channel.initiateReply(this.data)
            })
        }

        // display og message if this is a reply

        if (this.data.replyTo) {
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
            replyIcon.className = "fa-solid fa-reply fa-flip-horizontal"

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

            replyText.innerText = this.data.replyTo.text;

            if (this.data.replyTo.tags) {
                for (const tag of Message.createTags(this.data.replyTo.tags))
                    replyName.appendChild(tag)
            }


            replyDisplay.appendChild(replyIcon)
            replyDisplay.appendChild(replyImage)
            replyDisplay.appendChild(replyName)
            replyDisplay.appendChild(replyText)

            replyDisplay.addEventListener('click', () => this.channel.scrollToMessage(
                this.data.replyTo.id
            ))
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
        this.appendChild(i);
        if (!this.data.notSaved) this.appendChild(reactOption);
        if (replyOption) this.appendChild(replyOption)
        if (deleteOption) this.appendChild(deleteOption);
        if (editOption) this.appendChild(editOption);

        this.addEventListener("click", () => this.select())

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
        this.authorItems.b.style.display = "block";
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

    }

    static clearSelection() {

        selectedMessage = undefined;

        document.querySelectorAll('message-element.highlight.manual').forEach(
            m => m.classList.remove("highlight", "manual")
        )

    }

    static getSelection(): Message {
        return selectedMessage;
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
        (event.key === 'a' || event.key === 'e' || event.key === 'd' || event.key === 'r') &&
        document.activeElement.tagName.toLowerCase() !== "input"
    ) {
        event.preventDefault();

        const message = selectedMessage; // so i can just copy and paste 😶

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
                break; // break is not needed but i like it so it is here
        }

        Message.clearSelection()
    }
})