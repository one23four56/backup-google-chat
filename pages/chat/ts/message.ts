
import { UserData } from '../../../ts/lib/authdata';
import MessageData from '../../../ts/lib/msg';
import Channel from './channels';
import { getSetting } from './functions';
import { me, socket } from './script';

export default class Message extends HTMLElement {

    data: MessageData;
    authorItems: {
        [key: string]: HTMLElement
    } = {};
    channel: Channel;

    image?: HTMLImageElement;
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

        if (this.data.tags) {
            for (const tag of Message.createTags(this.data.tags))
                b.appendChild(tag)
        }

        img.src = 
            this.data.author.webhookData? 
                this.data.author.webhookData.image : 
                this.data.author.image;

        this.authorItems.b = b;
        this.authorItems.img = img;

        holder.appendChild(b);
        
        // set message contents 

        p.innerText = this.data.text;

        holder.appendChild(p);

        i.innerText = new Date(this.data.time).toLocaleString();

        // add editing and deleting buttons

        let deleteOption, editOption, replyOption, replyDisplay, pollDisplay, reactionDisplay: HTMLDivElement;

        if (this.data.author.id === me.id && !this.data.notSaved) {
            deleteOption = document.createElement('i');
            deleteOption.className = "fas fa-trash-alt";
            deleteOption.style.cursor = "pointer";

            deleteOption.addEventListener('click', () => this.channel.initiateDelete(this.data.id))

            editOption = document.createElement('i');
            editOption.className = "fas fa-edit";
            editOption.style.cursor = "pointer";

            editOption.addEventListener('click', () => this.channel.initiateEdit(this.data))

            editOption.title = "Edit Message";
            deleteOption.title = "Delete Message";
        }

        // add image support
        
        if (this.data.media) {

            if (!this.image) {


                const image = document.createElement("img")
                image.alt = `Attached Image`
                image.className = "attached-image"

                image.title = "Open in new tab"
                image.addEventListener("click",
                    () => window.open(this.channel.mediaGetter.getUrlFor(this.data.media, true))
                )

                this.image = image;

            } else this.holder.append(document.createElement("br"), this.image)

        }

        // add poll support 

        if (this.data.poll) {
            pollDisplay = document.createElement('div');
            pollDisplay.className = "poll";

            const question = document.createElement('p');

            question.innerText = this.data.poll.question;
            question.className = "question";

            pollDisplay.appendChild(question);

            if (this.data.poll.type === 'poll') {

                const
                    option1 = document.createElement('p'),
                    option2 = document.createElement('p'),
                    option3 = document.createElement('p');


                option1.className = "option";
                option2.className = "option";
                option3.className = "option";


                option1.innerText = this.data.poll.options[0].option;
                option2.innerText = this.data.poll.options[1].option;
                if (this.data.poll.options[2]) option3.innerText = this.data.poll.options[2].option;

                option1.innerText += ` (${this.data.poll.options[0].votes}) `;
                option2.innerText += ` (${this.data.poll.options[1].votes}) `;
                if (this.data.poll.options[2]) option3.innerText += ` (${this.data.poll.options[2].votes}) `;

                if (!this.data.poll.finished) {
                    option1.addEventListener('click', () =>
                        socket.emit(`vote in poll`, this.channel.id, this.data.id, (this.data.poll as any).options[0].option))

                    option2.addEventListener('click', () =>
                        socket.emit(`vote in poll`, this.channel.id, this.data.id, (this.data.poll as any).options[1].option))

                    if (this.data.poll.options[2]) option3.addEventListener('click', () =>
                        socket.emit(`vote in poll`, this.channel.id, this.data.id, (this.data.poll as any).options[2].option))
                } else
                    pollDisplay.classList.add('ended')

                this.data.poll.options.forEach((item, index) => {
                    let element: HTMLElement;

                    switch (index) {
                        case 0:
                            element = option1
                            break;
                        case 1: 
                            element = option2
                            break;
                        case 2:
                            element = option3
                            break;
                    }

                    item.voters.forEach(voter => {
                        if (voter === me.id) {
                            element.innerText += '🟢'
                            element.classList.add('voted')
                        } else
                            element.innerText += '🔵'
                    })
                })

                pollDisplay.appendChild(option1);
                pollDisplay.appendChild(option2);
                if (this.data.poll.options[2]) pollDisplay.appendChild(option3);
            }

            if (this.data.poll.type === 'result') {
                const winner = document.createElement('p');
                winner.innerText = this.data.poll.winner;

                pollDisplay.classList.add("results")

                pollDisplay.addEventListener('click', _ => {
                    const originalMessage = document.querySelector('[data-id="' + (this.data.poll as any).originId + '"]')
                    if (originalMessage) {
                        originalMessage.scrollIntoView({ behavior: 'smooth' })
                        originalMessage.classList.add('highlight')
                        setTimeout(() => originalMessage.classList.remove('highlight'), 5000);
                    } else {
                        window.open(`${location.origin}/archive?message=${(this.data.poll as any).originId}`)
                        // open in archive loader if not loaded in
                    }
                })

                pollDisplay.appendChild(winner);
            }

            holder.appendChild(pollDisplay);

        }

        // add reaction support

        reactOption.className = "fa-regular fa-face-grin";
        reactOption.style.cursor = "pointer";
        reactOption.title = "React to Message";
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
                this.data.replyTo.author.webhookData?
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

            replyDisplay.addEventListener('click', _ => {
                const originalMessage = this.channel.messages.find(m => m.data.id === this.data.replyTo.id)
                if (originalMessage) {
                    originalMessage.scrollIntoView({ behavior: 'smooth' })
                    originalMessage.classList.add('highlight')
                    setTimeout(() => originalMessage.classList.remove('highlight'), 5000);
                } else {
                    window.open(`${location.origin}/${this.channel.id}/archive?message=${this.data.replyTo.id}`)
                    // open in archive loader if not loaded in
                }
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
        this.appendChild(i);
        if (!this.data.notSaved) this.appendChild(reactOption);
        if (replyOption) this.appendChild(replyOption)
        if (deleteOption) this.appendChild(deleteOption);
        if (editOption) this.appendChild(editOption);

        this.addEventListener("click", () => {



            this.select()

        })

    }

    /**
     * Updates a message's data, then redraws it
     * @param data Data to set to
     */
    update(data: MessageData) {

        let loadNewImage = false;

        if (this.data.media?.location !== data.media?.location) {
            this.image = undefined
            loadNewImage = true;
        }

        this.data = data; // update data

        // reset element properties
        this.innerText = "";
        this.showAuthor();

        if (this.channel.chatView.scrolledToBottom) {
            this.draw(); // redraw

            this.channel.chatView.style.scrollBehavior = "auto"
            this.channel.chatView.scrollTo({
                top: this.channel.chatView.scrollHeight,
                behavior: 'auto'
            })
            this.channel.chatView.style.scrollBehavior = "smooth"
        } else this.draw();


        // load image
        if (this.image && loadNewImage) {
            this.image.addEventListener("load", () => {

                this.holder.append(document.createElement("br"), this.image), { once: true }

                if (this.data.id === this.channel.messages[this.channel.messages.length - 1].data.id && this.channel.chatView.scrolledToBottom) {

                    this.channel.chatView.scrollTo({
                        top: this.channel.chatView.scrollHeight
                    })

                }

            }, { once: true })
            
            this.loadImage()
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

    loadImage() {
        if (!this.image || !this.data.media)
            return;

        this.image.src = this.channel.mediaGetter.getUrlFor(this.data.media)
    }

    addImage() {
        if (this.reactions)
            this.holder.insertBefore(this.image, this.reactions)
        else 
            this.holder.insertBefore(this.image, this.querySelector("br:first-of-type"))

        this.holder.insertBefore(document.createElement("br"), this.image)
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