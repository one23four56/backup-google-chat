
import MessageData from '../../../ts/lib/msg';
import Channel from './channels';
import { me } from './script';

export default class Message extends HTMLElement {

    data: MessageData;
    authorItems: {
        [key: string]: HTMLElement
    } = {};
    channel?: Channel;

    constructor(data: MessageData) {
        super();

        this.data = data;
    }

    draw() {

        this.classList.add('message');

        this.dataset.id = this.data.id.toString();
        this.dataset.author = this.data.author.id;

        const 
            //* comments after definitions show what to append elements to
            holder = document.createElement('div'), // this
            b = document.createElement('b'), // holder
            p = document.createElement('p'), // holder
            img = document.createElement('img'), // this
            i = document.createElement('i'), // this
            reactOption = document.createElement('i'); // this

        
        // set author data 

        if (this.data.author.webhookData) {
            this.title = "Sent by " + this.data.author.name;
            b.innerText = this.data.author.webhookData.name;
        } else 
            b.innerText = this.data.author.name;

        if (this.data.tag) 
            b.innerHTML += 
                ` <p style="padding:2px;margin:0;font-size:x-small;color:${this.data.tag.color};background-color:${this.data.tag.bgColor};border-radius:5px;">${this.data.tag.text}</p>`;

        img.src = this.data.author.image;

        this.authorItems.b = b;
        this.authorItems.img = img;

        holder.appendChild(b);
        
        // set message contents 

        p.innerText = this.data.text;

        holder.appendChild(p);

        i.innerText = new Date(this.data.time).toLocaleString();

        // add editing and deleting buttons

        let deleteOption, editOption, replyOption, replyDisplay, pollDisplay;

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

        // add reaction support

        reactOption.className = "fa-regular fa-face-grin";
        reactOption.style.cursor = "pointer";
        reactOption.title = "React to Message";
        reactOption.addEventListener('click', event => this.channel.initiateReaction(this.data.id, event.clientX, event.clientY))

        //TODO add image support 
        //! requires new message format to support images

        //TODO add poll support 

        //add reply support 

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

            replyImage.src = this.data.replyTo.author.image;
            replyName.innerText = this.data.replyTo.author.name;
            replyText.innerText = this.data.replyTo.text;

            if (this.data.replyTo.tag) 
                replyName.innerHTML += 
                ` <p style="padding:2px;margin:0;font-size:x-small;color:${this.data.replyTo.tag.color};background-color:${this.data.replyTo.tag.bgColor};border-radius:5px;">${this.data.replyTo.tag.text}</p>`
            

            replyDisplay.appendChild(replyIcon)
            replyDisplay.appendChild(replyImage)
            replyDisplay.appendChild(replyName)
            replyDisplay.appendChild(replyText)

            replyDisplay.addEventListener('click', _ => {
                const originalMessage = document.querySelector('[data-id="' + this.data.replyTo.id + '"]')
                if (originalMessage) {
                    originalMessage.scrollIntoView({ behavior: 'smooth' })
                    originalMessage.classList.add('highlight')
                    setTimeout(() => originalMessage.classList.remove('highlight'), 5000);
                } else {
                    //todo: update this to work with new archives
                    // window.open(`${location.origin}/archive?message=${this.data.replyTo.id}`)
                    // // open in archive loader if not loaded in
                }
            })
        }

        if (replyDisplay) this.appendChild(replyDisplay);
        this.appendChild(img);
        this.appendChild(holder);
        this.appendChild(i);
        this.appendChild(reactOption);
        if (replyOption) this.appendChild(replyOption)
        if (deleteOption) this.appendChild(deleteOption);
        if (editOption) this.appendChild(editOption);

    }

    update(data: MessageData) {
        this.data = data;
        this.draw()
    }

    hideAuthor() {
        this.authorItems.b.style.display = "none";
        this.authorItems.img.style.height = "0px";
        this.style.marginTop = "0px";
    }

    showAuthor() {
        this.authorItems.b.style.display = "block";
        this.authorItems.img.style.height = "4.5vh";
        this.style.marginTop = "1vh";
    }

}