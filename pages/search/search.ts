// Proprietary Message Class for the Search Page 

// This file CANNOT have any imports, as it is used in the Search Page
// The only reason this is written in typescript and is in the ts folder is because I hate javascript and want to avoid using it

const id = <type extends HTMLElement = HTMLElement>(element: string) => document.getElementById(element) as type;

class Message {
    data: any;
    archive: boolean;
    msg: any;

    constructor(data) {
        this.draw(data)
        this.data = data
    }
    draw(data) {
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


        let prev_conditional = false

        if (prev_conditional) b.style.display = 'none'
        holder.appendChild(b)
        holder.appendChild(p)

        let img = document.createElement('img')
        img.src = data.author.img
        if (prev_conditional) {
            img.style.height = '0'
            msg.style.marginTop = '0';
        }

        //I have no clue why, but when I made this a p the alignment broke
        let i = document.createElement('i')
        i.innerText = new Date(data.time).toLocaleString()

        let archive;
        if (data.archive === false) {
            archive = document.createElement('i');
            archive.classList.add('fas', 'fa-user-secret', 'fa-fw');
            archive.title = "Message was not saved to the archive";
            this.archive = false
        } else this.archive = true

        msg.appendChild(img)
        msg.appendChild(holder)
        msg.appendChild(i)
        if (archive) msg.appendChild(archive)
        this.msg = msg
    }
}
