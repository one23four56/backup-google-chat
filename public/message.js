class Message {
    /**
     * Generates a new message
     * @param {Object} data Data to generate message from 
     * @param {string} channel Channel to preform message sensing in 
     */
    constructor(data, channel = "content", addedAtBottom = true) {
        this.channel = channel
        if (addedAtBottom) globalThis.channels[channel].messages.push(data);
        else globalThis.channels[channel].messages.unshift(data);
        this.draw(data)
        this.data = data
    }
    draw(data) {
        let prev_message = globalThis.channels[this.channel].messages[globalThis.channels[this.channel].messages.indexOf(data) - 1]
        let msg = document.createElement('div')
        msg.classList.add('message')
        if (data.id) msg.setAttribute('data-message-id', data.id);
        msg.setAttribute("data-message-author", data.author.name);

        let holder = document.createElement('div')

        let b = document.createElement('b');
        b.innerText = data.author.name
        if (data.tag) b.innerHTML += ` <p style="padding:2px;margin:0;font-size:x-small;color:${data.tag.color};background-color:${data.tag.bg_color};border-radius:5px;">${data.tag.text}</p>`

        if (data.isWebhook) {
            msg.title = "Sent by " + data.sentBy;
            data.author.name += ` (${data.sentBy})`;
        }

        let p = document.createElement('p');
        p.innerText = `${data.text}`

        let prev_conditional = (prev_message && prev_message?.author?.name === data.author.name && JSON.stringify(prev_message?.tag) === JSON.stringify(data?.tag) && prev_message?.channel?.to === data?.channel?.to)

        if (prev_conditional) b.style.display = 'none'
        holder.appendChild(b)
        holder.appendChild(p)

        if (data.image) {
            holder.innerHTML += "<br>";
            holder.innerHTML += `<img src="${data.image}" alt="Attached Image" class="attached-image" />`;
        }

        let img = document.createElement('img')
        img.src = data.author.img
        if (prev_conditional) {
            img.height = 0;
            msg.style.marginTop = '0';
        }

        //I have no clue why, but when I made this a p the alignment broke
        let i = document.createElement('i')
        i.innerText = new Date(data.time).toLocaleString()
        i.style.visibility = "hidden"

        let archive = document.createElement('i')
        if (data.archive === false) { archive.classList.add('fas', 'fa-user-secret', 'fa-fw'); this.archive = false }
        else { archive.classList.add('fas', 'fa-cloud', 'fa-fw'); archive.style.visibility = "hidden"; this.archive = true }

        let deleteOption;
        let editOption;
        if (document.cookie.includes(data.author.name) && data.archive !== false) {
            deleteOption = document.createElement('i');
            deleteOption.classList.add('fas', 'fa-trash-alt');
            deleteOption.style.visibility = "hidden";
            deleteOption.style.cursor = "pointer";
            deleteOption.addEventListener('click', _ => {
                confirm('Delete message?', 'Delete Message?', (res) => {
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
                document.getElementById('text').value = data.text
                document.getElementById('profile-pic-display').setAttribute("data-old-src", document.getElementById('profile-pic-display').src)
                document.getElementById('profile-pic-display').src = 'https://img.icons8.com/material-outlined/48/000000/edit--v1.png'
                document.getElementById('text').focus()
            });
        }

        msg.appendChild(img)
        msg.appendChild(holder)
        msg.appendChild(i)
        msg.appendChild(archive)
        if (deleteOption) msg.appendChild(deleteOption)
        if (editOption) msg.appendChild(editOption)

        msg.addEventListener("mouseenter", () => {
            archive.style.visibility = "initial"
            i.style.visibility = "initial"
            if (editOption && deleteOption) {
                deleteOption.style.visibility = "initial"
                editOption.style.visibility = "initial"
            }
        })

        msg.addEventListener("mouseleave", () => {
            archive.style.visibility = this.archive ? 'hidden' : 'initial'
            i.style.visibility = "hidden"
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
