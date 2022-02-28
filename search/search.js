const searchBar = document.getElementById("search-bar");
const content = document.getElementById("content");

class Message {
    /**
     * Generates a new message
     * @param {Object} data Data to generate message from 
     * @param {string} channel Channel to preform message sensing in 
     */
    constructor(data) {
        this.draw(data)
        this.data = data
    }
    draw(data) {
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

        holder.appendChild(b)
        holder.appendChild(p)

        if (data.image) {
            holder.innerHTML += "<br>";
            holder.innerHTML += `<img src="${data.image}" alt="Attached Image" class="attached-image" />`;
        }

        let img = document.createElement('img')
        img.src = data.author.img

        //I have no clue why, but when I made this a p the alignment broke
        let i = document.createElement('i')
        i.innerText = new Date(data.time).toLocaleString()

        let archive = document.createElement('i')
        if (data.archive === false) { archive.classList.add('fas', 'fa-user-secret', 'fa-fw'); this.archive = false }
        else { archive.classList.add('fas', 'fa-cloud', 'fa-fw'); archive.style.visibility = "hidden"; this.archive = true }

        msg.appendChild(img)
        msg.appendChild(holder)
        msg.appendChild(i)
        msg.appendChild(archive)

        msg.addEventListener("mouseenter", () => {
            archive.style.visibility = "initial"
            i.style.visibility = "initial"
        })

        msg.addEventListener("mouseleave", () => {
            archive.style.visibility = this.archive ? 'hidden' : 'initial'
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


searchBar.addEventListener('keyup', async e => {
    if (!searchBar.value) return;

    let res = await fetch(`${location.origin}/searchmessages?query=${encodeURI(searchBar.value)}`);
    let messages = await res.json();

    content.innerHTML = "";

    for (let message of messages) {
        let msg = new Message(message);
        let elmt = msg.msg;
        elmt.onclick = function() {
            location.href = `${location.origin}/?messageIndex=${message.index}`
        }
        content.appendChild(elmt);
    }
});