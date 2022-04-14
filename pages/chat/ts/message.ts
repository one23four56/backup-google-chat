import { confirm } from './popups';
import msg from '../../../ts/lib/msg'
import { socket } from './script';
import { openReactPicker, addReaction } from './functions';

const id = <type extends HTMLElement = HTMLElement>(element: string) => document.getElementById(element) as type;

export default class Message {
    channel: string;
    data: msg;
    archive: boolean;
    msg: any;

    /**
     * Generates a new message
     * @param {Object} data Data to generate message from 
     * @param {string} channel Channel to preform message sensing in 
     */
    constructor(data: msg, channel = "content", addedAtBottom = true) {
        this.channel = channel
        if (addedAtBottom) globalThis.channels[channel].messages.push(data);
        else globalThis.channels[channel].messages.unshift(data);
        this.draw(data)
        this.data = data
    }
    draw(data: msg) {
        let prev_message = globalThis.channels[this.channel].messages[globalThis.channels[this.channel].messages.indexOf(data) - 1]
        let msg = document.createElement('div')
        msg.classList.add('message')
        if (data.id) msg.setAttribute('data-message-id', data.id.toString());
        msg.setAttribute("data-message-author", data.author.name);

        let holder = document.createElement('div')

        let b = document.createElement('b');
        b.innerText = data.author.name
        if (data.tag) b.innerHTML += ` <p style="padding:2px;margin:0;font-size:x-small;color:${data.tag.color};background-color:${data.tag.bg_color};border-radius:5px;">${data.tag.text}</p>`

        if (data.isWebhook)
            msg.title = "Sent by " + data.sentBy;

        let p = document.createElement('p');
        p.innerText = `${data.text}`

        const checkIfURL = string => {
            var res = string.match(/(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g);
            return (res !== null)
        }

        let prev_conditional = (
            prev_message && 
            prev_message?.author?.name === data.author.name && 
            JSON.stringify(prev_message?.tag) === JSON.stringify(data?.tag) && 
            prev_message?.channel?.to === data?.channel?.to &&
            prev_message?.sentBy === data?.sentBy &&
            (new Date(data.time).getTime() - new Date(prev_message.time).getTime()) / 1000 < 300
        )
        
        let isThumbnail = false;
        let thumbnailURL = null;
        if (data.text.includes("http")) {
            let words = data.text.split(" ");
            let finalElmt = document.createElement('p');
            for (let word of words) {
                let isURL = checkIfURL(word);
                let elmt = document.createElement(isURL ? 'a' : 'span');
                elmt.innerText = word + " ";
                if (isURL && 'href' in elmt) {
                    elmt.href = word;
                    elmt.target = "_blank";

                    let urlObject = new URL(word);
                    if (urlObject.origin == 'https://www.youtube.com' && !data.image) {
                        let videoID = new URLSearchParams(urlObject.searchParams).get('v');
                        data.image = `https://img.youtube.com/vi/${videoID}/0.jpg`;
                        isThumbnail = true;
                        thumbnailURL = word;
                    }
                }
                finalElmt.appendChild(elmt);
            }
            p = finalElmt
        }

        if (prev_conditional) b.style.display = 'none'
        holder.appendChild(b)
        holder.appendChild(p)

        if (data.image) {
            holder.innerHTML += "<br>";
            let imgElmt = document.createElement('img');
            imgElmt.src = data.image;
            imgElmt.alt = "Attached Image"
            imgElmt.classList.add('attached-image');
            if (isThumbnail) {
                imgElmt.classList.add('video-thumbnail');
                imgElmt.onclick = _ => window.open(thumbnailURL);
            }
            holder.appendChild(imgElmt)
        }

        let img = document.createElement('img')
        img.src = data.author.img
        if (prev_conditional) {
            img.style.height = '0'
            msg.style.marginTop = '0';
        }

        //I have no clue why, but when I made this a p the alignment broke
        let i = document.createElement('i')
        i.innerText = new Date(data.time).toLocaleString()
        i.style.visibility = "hidden"

        let archive;
        if (data.archive === false) { 
            archive = document.createElement('i'); 
            archive.classList.add('fas', 'fa-user-secret', 'fa-fw'); 
            this.archive = false 
        } else this.archive = true

        let deleteOption, editOption, sentByMe = false;

        if (data.isWebhook) { // brackets HAVE to be here, otherwise it breaks
            if (data.sentBy === globalThis.me.name) sentByMe = true;
        } else {
            if (data.author.name === globalThis.me.name) sentByMe = true;
        }

        if (sentByMe && data.archive !== false) {
            deleteOption = document.createElement('i');
            deleteOption.classList.add('fas', 'fa-trash-alt');
            deleteOption.style.visibility = "hidden";
            deleteOption.style.cursor = "pointer";
            deleteOption.addEventListener('click', _ => {
                confirm('Delete message?', 'Delete Message?').then(res => {
                        if (res) {
                            socket.emit("delete-message", msg.getAttribute("data-message-id"), globalThis.session_id);
                            globalThis.channels[this.channel].messages = globalThis.channels[this.channel].messages.filter(item => item !== data)
                            globalThis.channels[this.channel].messageObjects = globalThis.channels[this.channel].messageObjects.filter(item => item.data !== data)
                            globalThis.channels[this.channel].messageObjects.forEach(message => message.update())
                    }
                })
            });

            editOption = document.createElement('i');
            editOption.classList.add('fas', 'fa-edit');
            editOption.style.visibility = "hidden";
            editOption.style.cursor = "pointer";
            editOption.addEventListener('click', _ => {
                globalThis.messageToEdit = data.id
                id<HTMLInputElement>('text').value = data.text
                document.getElementById('profile-pic-display').setAttribute("data-old-src", id<HTMLImageElement>('profile-pic-display').src)
                id<HTMLImageElement>('profile-pic-display').src = 'https://img.icons8.com/material-outlined/48/000000/edit--v1.png'
                document.getElementById('text').focus()
            });
        }

        let reactOption = document.createElement('i');
        reactOption.className = "fa-regular fa-face-grin";
        reactOption.style.visibility = "hidden";
        reactOption.style.cursor = "pointer";

        
        reactOption.addEventListener('click', event => 
        openReactPicker(event.clientX, event.clientY, data.id))

        let reactionDisplay;
        if (data.reactions) {

            reactionDisplay = document.createElement('div');
            reactionDisplay.className = "reaction-display";

            for (const emoji in data.reactions) {
                let reaction = document.createElement('p');
                reaction.className = "reaction";
                reaction.innerText = `${emoji} ${data.reactions[emoji].length}`;


                reaction.title = data.reactions[emoji].map(user => user.name).join(', ')
                + ` reacted with ${emoji}`;

                reaction.addEventListener('click', _ => addReaction(emoji, data.id));

                reactionDisplay.appendChild(reaction);
            }

            holder.appendChild(reactionDisplay);

        }

        msg.appendChild(img)
        msg.appendChild(holder)
        msg.appendChild(i)
        if (data.id && data.archive && this.channel == 'content') msg.appendChild(reactOption)
        if (archive) msg.appendChild(archive)
        if (deleteOption && this.channel == 'content') msg.appendChild(deleteOption)
        if (editOption && this.channel == 'content') msg.appendChild(editOption)

        msg.addEventListener("mouseenter", () => {
            i.style.visibility = "initial"
            reactOption.style.visibility = "initial"
            if (editOption && deleteOption) {
                deleteOption.style.visibility = "initial"
                editOption.style.visibility = "initial"
            }
        })

        msg.addEventListener("mouseleave", () => {
            i.style.visibility = "hidden"
            reactOption.style.visibility = "hidden"
            if (editOption && deleteOption) {
                deleteOption.style.visibility = "hidden"
                editOption.style.visibility = "hidden"
            }
        })
        this.msg = msg
    }
    update() {
        if (this.data.id) {
        this.draw(this.data)
        this.msg.style.opacity = '1'
        document.querySelector(`[data-message-id="${this.data.id}"]`).replaceWith(this.msg)
        }
    }
}
