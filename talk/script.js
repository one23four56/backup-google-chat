const socket = io();

if (Notification.permission !== 'granted' && Notification.permission !== 'blocked') {
    Notification.requestPermission()
}

window.alert = (content, title) => {
    let alert = document.querySelector("div.alert-holder[style='display:none;']").cloneNode(true)
    let h1 = document.createElement("h1")
    h1.innerText = title || "Alert"
    let p = document.createElement("p")
    p.innerText = content
    let button = document.createElement("button")
    button.innerText = "OK"
    button.onclick = () => alert.remove()
    alert.firstElementChild.appendChild(h1)
    alert.firstElementChild.appendChild(p)
    alert.firstElementChild.appendChild(button)
    alert.style.display = "flex"
    document.body.appendChild(alert)
}

window.confirm = (content, title, result) => {
    let alert = document.querySelector("div.alert-holder[style='display:none;']").cloneNode(true)
    let h1 = document.createElement("h1")
    h1.innerText = title || "Confirm"
    let p = document.createElement("p")
    p.innerText = content
    let yes = document.createElement("button")
    yes.innerText = "YES"
    yes.style = "width:50%;border-bottom-right-radius:0px;background-color:#97f597;"
    let no = document.createElement("button")
    no.innerText = "NO"
    no.style = "width:50%;margin-left:50%;border-bottom-left-radius:0px;background-color:#f78686;"
    yes.onclick = () => {alert.remove();result(true)}
    no.onclick = () => {alert.remove();result(false)}
    alert.firstElementChild.appendChild(h1)
    alert.firstElementChild.appendChild(p)
    alert.firstElementChild.appendChild(yes)
    alert.firstElementChild.appendChild(no)
    alert.style.display = "flex"
    document.body.appendChild(alert)
}

fetch("/archive.json?reverse=true&start=0&count=50", {
    headers: {
        'cookie': document.cookie
    }
}).then(res=>{
    if (!res.ok) {alert("Error loading previous messages");return}
    res.json().then(messages=>{
        for (let data of messages.reverse()) {
            if (data?.tag?.text==="DELETED") continue
            let message = new Message(data)
            let msg = message.msg
            document.getElementById('content').appendChild(msg)
            if (document.getElementById("autoscroll").checked) document.getElementById('content').scrollTop = document.getElementById('content').scrollHeight
            msg.style.opacity = 1
            delete message
        }
        document.getElementById("connectbutton").innerText = "Connect"
        document.getElementById("connectbutton").addEventListener('click', _ => {
            socket.emit('connected-to-chat', document.cookie, (data)=>{
                if (data.created) {
                    document.getElementById("connectdiv-holder").removeEventListener('click', this)
                    document.getElementById("connectdiv-holder").remove()
                    globalThis.session_id = data.id
                } else {
                    alert(`Could not create session. The server provided this reason: \n${data.reason}`, "Session not Created")
                }
            })
            
        })
    }).catch(_=>alert("Error loading previous messages"))
}).catch(_=>alert("Error loading previous messages"))

document.getElementById("attach-image").addEventListener('click', _ => {
    document.querySelector("#image-box").style.display = "block";
});

document.getElementById("send").addEventListener('submit', event => {
    event.preventDefault()
    const formdata = new FormData(document.getElementById("send"))
    if (formdata.get("text").trim() == "") return;
    document.getElementById("text").value = ""
    if (sessionStorage.getItem("selected-webhook-id")&&sessionStorage.getItem("selected-webhook-id")!=="pm") {
        socket.emit('send-webhook-message', {
            cookie: globalThis.session_id,
            data: {
                id: sessionStorage.getItem("selected-webhook-id"),
                text: formdata.get('text'),
                archive: document.getElementById('save-to-archive').checked,
                image: sessionStorage.getItem("attached-image-url")
            }
        });
    } else if (sessionStorage.getItem("selected-webhook-id")==='pm') {
        socket.emit('message', {
            cookie: globalThis.session_id,
            text: formdata.get('text'),
            archive: false,
            image: sessionStorage.getItem("attached-image-url"),
            pm: globalThis.pm_id
        })
    } else {
        socket.emit('message', {
            cookie: globalThis.session_id,
            text: formdata.get('text'),
            archive: document.getElementById('save-to-archive').checked,
            image: sessionStorage.getItem("attached-image-url")
        })
    }
    sessionStorage.removeItem("attached-image-url");
    document.getElementById("attach-image").setAttribute("data-image-attached", false);
    document.getElementById("attach-image").style["background-color"] = "transparent";
    document.getElementById("image-box-display").src = "";
    document.querySelector("#image-box > input").value = "";
})

let prev_message;
class Message {
    constructor(data) {
        let msg = document.createElement('div')
        msg.classList.add('message')
        if (data.id) msg.setAttribute('data-message-id', data.id);
        msg.setAttribute("data-message-author", data.author.name);

        if (data.isWebhook) msg.title = "Sent by " + data.sentBy; 
    
        // let words = data.text.split(" ")
        // let links = []
        // words.forEach(item => {
        //     var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
        //         '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
        //         '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
        //         '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
        //         '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
        //         '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
        //     if (pattern.test(item)) links.push(item)
        // })
        let holder = document.createElement('div')

        let b = document.createElement('b');
        b.innerText = data.author.name
        if (data.tag) b.innerHTML += ` <p style="padding:2px;margin:0;font-size:x-small;color:${data.tag.color};background-color:${data.tag.bg_color};border-radius:5px;">${data.tag.text}</p>`

        let p = document.createElement('p');
        p.innerText = `${data.text}`

        if (data.isWebhook) data.author.name += ` (${data.sentBy})`
        if (!(prev_message?.author?.name===data.author.name&&prev_message?.tag?.text===data?.tag?.text)) holder.appendChild(b)
        holder.appendChild(p)

        if (data.image) {
            holder.innerHTML += "<br>";
            holder.innerHTML += `<img src="${data.image}" alt="Attached Image" class="attached-image" />`;
        }
    
        // if (links.length!==0) {
        //     p.innerText += `\nLinks in this message: `
        //     links.forEach((item, index)=>{
        //         let link = document.createElement('a')
        //         link.innerText += ` ${item}, `
        //         link.href = item.indexOf("https://")!==-1?item:`https://${item}`
        //         link.target = "_blank"
        //         p.appendChild(link)
        //     })
        // }
        let img = document.createElement('img')
        img.src = data.author.img
        if (prev_message?.author?.name===data.author.name&&prev_message?.tag?.text===data?.tag?.text) {
            img.height = 0;
            prev_message.msg.style.marginBottom=0;
            msg.style.marginTop = 0;
        }
    
        //I have no clue why, but when I made this a p the alignment broke
        let i = document.createElement('i')
        i.innerText = new Date(data.time).toLocaleString()
        i.style.visibility = "hidden"
    
        let archive = document.createElement('i')
        if (data.archive === false) {archive.classList.add('fas', 'fa-user-secret', 'fa-fw');this.archive=false}
        else {archive.classList.add('fas', 'fa-cloud', 'fa-fw');archive.style.visibility = "hidden";this.archive=true}

        let deleteOption;
        let editOption;
        if (document.cookie.includes(data.author.name)) {
            deleteOption = document.createElement('i');
            deleteOption.classList.add('fas', 'fa-trash-alt');
            deleteOption.style.visibility = "hidden";
            deleteOption.style.cursor = "pointer";
            deleteOption.addEventListener('click', _ => {            
                confirm('Delete message?', 'Delete Message?', (res)=>{
                    if (res) {
                        socket.emit("delete-message", msg.getAttribute("data-message-id"), globalThis.session_id);
                    }
                })
            });

            editOption = document.createElement('i');
            editOption.classList.add('fas', 'fa-edit');
            editOption.style.visibility = "hidden";
            editOption.style.cursor = "pointer";
            editOption.addEventListener('click', _ => {
                let newText = window.prompt("What do you want to change the message to?", msg.querySelector("div p").innerText);
                if (!newText) return;
                socket.emit("edit-message", { messageID: data.id, text: newText }, globalThis.session_id);
            });
        }

        msg.appendChild(img)
        msg.appendChild(holder)
        msg.appendChild(i)
        msg.appendChild(archive)
        if (deleteOption) msg.appendChild(deleteOption)
        if (editOption) msg.appendChild(editOption)

        msg.addEventListener("mouseenter", ()=>{
            archive.style.visibility = "initial"
            i.style.visibility = "initial"
            if (editOption&&deleteOption) {
                deleteOption.style.visibility = "initial"
                editOption.style.visibility = "initial"
            }
        })

        msg.addEventListener("mouseleave", ()=>{
            archive.style.visibility = this.archive?'hidden':'initial'
            i.style.visibility = "hidden"
            if (editOption&&deleteOption) {
                deleteOption.style.visibility = "hidden"
                editOption.style.visibility = "hidden"
            }
        })

        this.msg = msg
        prev_message = data
        prev_message.msg = msg
    }
}

socket.on('incoming-message', data => {

    if (Notification.permission === 'granted' && document.cookie.indexOf(data.author.name) === -1)
        new Notification(`${data.author.name} (Backup Google Chat)`, {
            body: data.text,
            icon: data.author.img,
            silent: document.hasFocus(),
        })

    document.querySelector('link[rel="shortcut icon"]').href = 'https://jason-mayer.com/hosted/favicon2.png'
    clearTimeout(globalThis.timeout)
    globalThis.timeout = setTimeout(() => {
        document.querySelector('link[rel="shortcut icon"]').href = 'https://jason-mayer.com/hosted/favicon.png'
    }, 5000);

    let message = new Message(data)
    let msg = message.msg
    document.getElementById("msgSFX").play()
    document.getElementById('content').appendChild(msg)
    if (document.getElementById("autoscroll").checked) document.getElementById('content').scrollTop = document.getElementById('content').scrollHeight
    msg.style.opacity = 1
})

socket.on('onload-data', data => {
    if (data.userName !== document.cookie.match('(^|;)\\s*' + "name" + '\\s*=\\s*([^;]+)')?.pop() || '') return;

    sessionStorage.removeItem("attached-image-url");
    if (document.getElementById("webhook-options")) document.getElementById("webhook-options").innerHTML = "";

    sessionStorage.setItem("profile-pic", data.image);

    let profilePicDisplay = document.getElementById("profile-pic-display");
    profilePicDisplay.src = data.image;
    profilePicDisplay.style.display = "block";

    profilePicDisplay.onclick = e => {
        let webhookOptionsDisplay = document.getElementById("webhook-options");
        webhookOptionsDisplay.style.display = webhookOptionsDisplay.style.display == "block" ? "none" : "block";
    };

    {
        let elmt = document.createElement("div");
        elmt.classList.add("webhook-option");
        elmt.setAttribute("data-type", "user");

        let imageDisp = document.createElement("img");
        imageDisp.src = data.image;
        imageDisp.alt = data.name + " (Icon)";
        elmt.appendChild(imageDisp);

        let nameDisp = document.createElement("h2");
        nameDisp.innerText = data.name;
        elmt.appendChild(nameDisp);

        elmt.addEventListener('click', e => {
            sessionStorage.removeItem('selected-webhook-id');
            document.getElementById('text').placeholder = "Enter a message...";
            document.getElementById("webhook-options").style.display = "none";
            document.getElementById("profile-pic-display").src = data.image;
        });

        document.getElementById("webhook-options").appendChild(elmt);
    }

    if (data.webhooks.length >= 5) document.getElementById("webhook-options").style["overflow-y"] = "scroll";

    for (option of data.webhooks) {
        let elmt = document.createElement("div");
        elmt.classList.add("webhook-option");
        elmt.setAttribute("data-type", "webhook");
        elmt.setAttribute("data-webhook-id", option.id);
        elmt.setAttribute("data-image-url", option.image);
        elmt.setAttribute("data-webhook-name", option.name);

        let imageDisp = document.createElement("img");
        imageDisp.src = option.image;
        imageDisp.alt = option.name + " (Icon)";
        elmt.appendChild(imageDisp);

        let nameDisp = document.createElement("h2");
        nameDisp.innerText = option.name + " (Bot)";
        elmt.appendChild(nameDisp);

        let optionsDisp = document.createElement("div");
        optionsDisp.classList.add("options");

        let editOption = document.createElement("img");
        editOption.src = "https://img.icons8.com/material-outlined/48/000000/edit--v1.png";
        editOption.onclick = _ => {
            let webhookData = {
                oldName: elmt.getAttribute('data-webhook-name'),
                newName: window.prompt("What do you want to rename the webhook to?") || elmt.getAttribute('data-webhook-name'),
                newImage: window.prompt("What do you want to change the webhook avatar to?") || elmt.getAttribute('data-image-url')
            };
            socket.emit('edit-webhook', {webhookData, cookieString: globalThis.session_id});
            //location.reload();
        }

        let copyOption = document.createElement("img");
        copyOption.src = "https://img.icons8.com/material-outlined/48/000000/copy.png";
        copyOption.onclick = _ => {
            prompt(
                "Use this link to programmatically send webhook messages:" + 
                "\n\nDO NOT SHARE THIS LINK WITH ANYONE, INCLUDING MEMBERS OF THIS CHAT!",
                location.origin + "/webhookmessage/" + 
                elmt.getAttribute("data-webhook-id")
            );
        }

        let deleteOption = document.createElement("img");
        deleteOption.src = "https://img.icons8.com/material-outlined/48/000000/trash--v1.png";
        deleteOption.onclick = _ => {
            confirm(`Are you sure you want to delete webhook ${elmt.getAttribute('data-webhook-name')}?`, 'Delete Webhook?', res=>{
                if (res) socket.emit('delete-webhook', { webhookName: elmt.getAttribute('data-webhook-name'), cookieString: globalThis.session_id });
            })
            //location.reload();
        }

        optionsDisp.appendChild(editOption);
        optionsDisp.appendChild(copyOption);
        optionsDisp.appendChild(deleteOption);
        elmt.appendChild(optionsDisp);

        elmt.addEventListener('click', e => {
            sessionStorage.setItem('selected-webhook-id', elmt.getAttribute('data-webhook-id'));
            document.getElementById('text').placeholder = "Send message as " + elmt.getAttribute('data-webhook-name') + "...";
            document.getElementById("webhook-options").style.display = "none";
            document.getElementById("profile-pic-display").src = elmt.getAttribute('data-image-url');
        });

        document.getElementById("webhook-options").appendChild(elmt);
    }

    {
        let elmt = document.createElement("div");
        elmt.classList.add("webhook-option");

        let imageDisp = document.createElement("img");
        imageDisp.src = "https://img.icons8.com/ios-filled/50/000000/plus.png";
        imageDisp.alt = "Add Webhook (Icon)";
        elmt.appendChild(imageDisp);

        let nameDisp = document.createElement("h2");
        nameDisp.innerText = "Add Webhook";
        elmt.appendChild(nameDisp);
        
        elmt.onclick = _ => {
            socket.emit('add-webhook', {
                name: window.prompt("What do you want to name this webhook?") || "unnamed webhook",
                image: window.prompt("Copy and Paste link to webhook icon here:") || "https://img.icons8.com/ios-glyphs/30/000000/webcam.png",
                cookieString: globalThis.session_id
            });

            //location.reload();
        }

        document.getElementById("webhook-options").appendChild(elmt);
    }
});

socket.on('archive-updated', _ => {
    clearInterval(globalThis.archiveint)
    document.getElementById('archive-update').innerHTML = 'Archive Last Updated 0s Ago <i class="fas fa-download fa-fw"></i>'
    let counter = 0;
    globalThis.archiveint = setInterval(() => {
        counter++
        document.getElementById('archive-update').innerHTML = `Archive Last Updated ${counter}s Ago <i class="fas fa-download fa-fw"></i>`
    }, 1000)
})

let alert_timer = null
socket.on('connection-update', data=>{
    document.getElementById("msgSFX").play()
    document.getElementById('alert').style.visibility = 'initial'
    document.getElementById('alert-text').innerText = `${data.name} has ${data.connection?'connected':'disconnected'}`
    alert_timer = setTimeout(() => {
        document.getElementById('alert').style.visibility = 'hidden'
    }, 5000);
})

socket.on("disconnect", ()=>{
    document.getElementById("msgSFX").play()
    document.getElementById('alert').style.visibility = 'initial'
    document.getElementById('alert-text').innerText = `You have lost connection to the server`
    let msg = new Message({
        text: `You have lost connection to the server. You will automatically be reconnected if/when it is possible.`,
        author: {
            name: "Info",
            img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png"
        },
        time: new Date(new Date().toUTCString()),
        archive: false
    }).msg
    document.getElementById('content').appendChild(msg)
    if (document.getElementById("autoscroll").checked) document.getElementById('content').scrollTop = document.getElementById('content').scrollHeight
    msg.style.opacity = 1
    socket.once("connect", ()=>{
        socket.emit('connected-to-chat', document.cookie, (data)=>{
            if (data.created) {
                globalThis.session_id = data.id
            } else {
                alert(`Could not create session. The server provided this reason: \n${data.reason}`, "Session not Created")
            }
        })
        document.getElementById("msgSFX").play()
        let msg = new Message({
            text: `You have been reconnected.`,
            author: {
                name: "Info",
                img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png"
            },
            time: new Date(new Date().toUTCString()),
            archive: false
        }).msg
        document.getElementById('content').appendChild(msg)
        if (document.getElementById("autoscroll").checked) document.getElementById('content').scrollTop = document.getElementById('content').scrollHeight
        msg.style.opacity = 1
    })
})

document.getElementById('archive-update').addEventListener('click', async _ => {
    const res = await fetch('/archive.json')
    const data = await res.text()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = 'archive.json'
    link.style.display = 'none'
    link.target = '_blank'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)
})

document.getElementById('chat-button').addEventListener('click', async _ => {
    document.getElementById('archive').style.visibility = 'hidden'
    document.getElementById("content").style.visibility = 'initial'
    document.getElementById('archive').innerHTML = ''
    document.getElementById('send').style.display = 'grid'
    document.getElementById('search').style.display = 'none'
    document.getElementById("profile-pic-display").style.display = 'block';
})

socket.on('online-check', userinfo => {
    document.getElementById('online-users').innerHTML = ''
    userinfo.forEach(item => {
        const div = document.createElement('div')
        div.classList.add("online-user")
        div.setAttribute('data-user-name', item.name);
        const span = document.createElement('span')
        span.innerText = item.name
        const img = document.createElement('img')
        img.src = item.img
        let editOption;
        if (item.name === document.cookie.match('(^|;)\\s*' + "name" + '\\s*=\\s*([^;]+)')?.pop() || '') {
            editOption = document.createElement('img');
            editOption.classList.add("editOption")
            editOption.src = "https://img.icons8.com/material-outlined/96/000000/edit--v1.png";
            editOption.style.cursor = "pointer";
            editOption.addEventListener('click', e => {
                let newProfile = prompt('What do you want to change your profile picture to?', item.img);
                if (!newProfile || newProfile == item.img) return;
                socket.emit('change-profile-pic', { cookieString: document.cookie, name: document.cookie.match('(^|;)\\s*' + "name" + '\\s*=\\s*([^;]+)')?.pop() || '', img: newProfile })
            });
        }
        div.appendChild(img)
        div.appendChild(span)
        if (editOption) div.appendChild(editOption);
        document.getElementById('online-users').appendChild(div)
    })
    document.getElementById("online-users-count").innerHTML = `<i class="fas fa-user-alt fa-fw"></i>Currently Online (${userinfo.length}):`
})

const logout = () => {
    confirm(`Are you sure you want to log out? \nLogging out will terminate all active sessions under your account and invalidate your authentication data. You will need to sign in again in order to use your account. \n\nIf you believe your account has been compromised, log out IMMEDIATELY and report it to me.`, "Log Out?", res=>{
        if (res) {
            socket.emit("logout", document.cookie)
        }
    })
}

socket.on("forced_disconnect", reason=>{
    alert(`Your connection has been ended by the server, which provided the following reason: \n${reason}`, "Disconnected")
})

document.querySelector("#image-box > input").onkeyup = e => {
    document.getElementById("image-box-display").src = e.target.value;
    
    if (e.target.value !== "") {
        sessionStorage.setItem("attached-image-url", e.target.value);
        document.getElementById("attach-image").setAttribute("data-image-attached", true);
        document.getElementById("attach-image").style["background-color"] = "lightgreen";
    }
    else {
        sessionStorage.removeItem("attached-image-url");
        document.getElementById("attach-image").setAttribute("data-image-attached", true);
        document.getElementById("attach-image").style["background-color"] = "transparent";
    }
}

document.querySelector("#image-box").onpaste = function (event) {
    let items = (event.clipboardData || event.originalEvent.clipboardData).items;
    for (let index in items) {
        let item = items[index];
        if (item.kind === 'file') {
            let blob = item.getAsFile();
            let reader = new FileReader();
            reader.onload = function (event) {
                 document.getElementById('image-box-display').src = event.target.result;
                 sessionStorage.setItem("attached-image-url", event.target.result);
                 document.getElementById("attach-image").setAttribute("data-image-attached", true);
                 document.getElementById("attach-image").style["background-color"] = "lightgreen";
            }; 
            reader.readAsDataURL(blob);
        }
    }
}

document.querySelector("#image-box #close-image-box").onclick = _ => {
    document.querySelector("#image-box").style.display = "none";
}

document.querySelector("#image-box #clear-image-box").onclick = _ => {
    document.getElementById('image-box-display').src = "";
    document.querySelector("#image-box > input").value = "";
    document.getElementById("attach-image").setAttribute("data-image-attached", false);
    document.getElementById("attach-image").style["background-color"] = "transparent";
}

socket.on("message-deleted", messageID => {
    let message = document.querySelector(`[data-message-id="${messageID}"]`)
    message.remove()
    if (message===prev_message.msg) prev_message = null
});

socket.on("message-edited", data => {
    let message = document.querySelector(`[data-message-id="${data.messageID}"] div p`);
    if (message) message.innerText = data.text;
});

socket.on("profile-pic-edited", data => {
    let elmt = document.querySelector(`.online-user[data-user-name="${data.name}"] img:first-of-type`);
    if (!elmt) return;
    elmt.src = data.img;
    if (data.name === document.cookie.match('(^|;)\\s*' + "name" + '\\s*=\\s*([^;]+)')?.pop() || '') {
        sessionStorage.setItem("profile-pic", data.img);
        document.getElementById("profile-pic-display").src = data.img;
    }
});
