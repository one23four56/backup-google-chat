import { alert, confirm, prompt, sideBarAlert } from "./popups"
import { makeChannel, setMainChannel } from './channels'
import { io } from 'socket.io-client';
import Dexie from 'dexie';

const socket = io();
globalThis.viewList = []
globalThis.channels = {}

// Dexie.delete('DMDatabase');
let DMDatabase = new Dexie("DMDatabase");

DMDatabase.version(1).stores({
    messages: '++key,data'
})

globalThis.me = await (await fetch('/me')).json()


let
    messageCount = 0,
    inMessageCoolDown = false;

const id = <type extends HTMLElement = HTMLElement>(elementId: string) => document.querySelector<type>(`#${elementId}`)


if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    Notification.requestPermission()
}



/**
 * Loads the settings from local storage. If they are not set, it sets them to the defaults and retries.
 */
const loadSettings = async () => {
    if (!localStorage.getItem("settings")) {
        const request = await fetch("/public/defaults.json")
        const defaults = await request.text()
        localStorage.setItem("settings", defaults)
        loadSettings()
    } else {
        let settings = JSON.parse(localStorage.getItem("settings"))
        for (const name in settings) {
            if (!document.getElementById(name)) continue
            id<HTMLInputElement>(name).checked = settings[name]
        }
    }
}

/**
 * Gets a setting that the user set.
 * @param {string} category The name of the category that the setting is in
 * @param {string} setting The name of the setting
 * @returns {boolean} The value of the setting
 */
export const getSetting = (category, setting) => {
    if (!localStorage.getItem("settings")) loadSettings().then(_=>getSetting(category, setting))
    else {
        const settings = JSON.parse(localStorage.getItem("settings"))
        return settings[`${category}-settings-${setting}`]
    }
}

function check(prompt = "Check?")  {
    let alert = document.querySelector("div.alert-holder[style='display:none;']").cloneNode(true) as HTMLDivElement
    alert.classList.add('check-alert')
    let checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'checkbox';
    checkbox.id = 'checkbox';
    checkbox.checked = false;
    let label = document.createElement('label');
    label.innerText = prompt
    label.setAttribute('for', 'checkbox')
    let button = document.createElement("button")
    button.innerText = "OK"
    alert.firstElementChild.appendChild(checkbox)
    alert.firstElementChild.appendChild(label)
    alert.firstElementChild.appendChild(button)
    alert.style.display = "flex"
    document.body.appendChild(alert)
    return new Promise((resolve, reject) => {
        button.onclick = () => { alert.remove(); resolve(checkbox.checked) }
    })
}

if (getSetting("misc", "hide-welcome")) {
    document.getElementById("connectdiv-holder").remove();
    id<HTMLInputElement>("text").disabled = true;
    id<HTMLInputElement>("text").placeholder = "Please wait while the site loads..."
}

fetch(`/archive.json?reverse=true&start=0&count=50`, {
    headers: {
        'cookie': document.cookie
    }
}).then(res=>{
    if (!res.ok) {alert("Error loading previous messages");return}
    res.json().then(messages=>{
        messageCount += messages.length;
        for (let data of messages.reverse()) {
            if (data?.tag?.text==="DELETED") continue
            data.mute = true
            globalThis.channels.content.msg.handle(data);
        }

        document.getElementById('content').scrollTop = document.getElementById('content').scrollHeight;


        if (getSetting("misc", "hide-welcome")) {
            id<HTMLInputElement>("text").disabled = false;
            id<HTMLInputElement>("text").placeholder = "Enter a message..."
        } else {
            document.getElementById("connectbutton").innerText = "Continue"
            document.getElementById("connectbutton").addEventListener('click', _ => {
                document.getElementById("connectdiv-holder").removeEventListener('click', this)
                document.getElementById("connectdiv-holder").remove()
            })
        }
    })
}).catch(_=>alert("Error loading previous messages"))

document.getElementById("send").addEventListener('submit', event => {
    event.preventDefault()

    const formdata = new FormData(id<HTMLFormElement>("send"))
    id<HTMLInputElement>("text").value = ""
    if (globalThis.messageToEdit) {
        socket.emit('edit-message', {
            messageID: globalThis.messageToEdit, 
            text: formdata.get('text').toString().trim()
        })
        delete globalThis.messageToEdit
        id<HTMLImageElement>('profile-pic-display').src = document.getElementById('profile-pic-display').getAttribute('data-old-src')
    } else if (globalThis.selectedWebhookId) {
        if (globalThis.mainChannelId!=="content") {alert("Webhooks are currently not supported in DMs", "Error");return}
        socket.emit('send-webhook-message', {
            data: {
                id: globalThis.selectedWebhookId,
                text: formdata.get('text').toString().trim(),
                archive: id<HTMLInputElement>('save-to-archive').checked,
                image: sessionStorage.getItem("attached-image-url")
            }
        });
    } else {
        socket.emit('message', {
            text: formdata.get('text').toString().trim(),
            archive: id<HTMLFormElement>('save-to-archive').checked,
            image: sessionStorage.getItem("attached-image-url"),
            recipient: globalThis.mainChannelId === 'content' ? 'chat' : globalThis.mainChannelId
        }, data => {
            data.mute = getSetting('notification', 'sound-send-message')? false : true
            if (data.channel && data.channel.to === 'chat') globalThis.channels.content.msg.handle(data);
            else {
                globalThis.channels[data.channel.to].msg.handle(data);
            }
            //@ts-expect-error
            DMDatabase.messages.put({data});
        })

    }
    sessionStorage.removeItem("attached-image-url");
    document.querySelector<HTMLDivElement>("#attached-image-preview-container").style.display = "none";
})

makeChannel("content", "Main", true);

let flash_interval;
globalThis.channels.content.msg.secondary = (data) => {
    clearInterval(flash_interval)
    flash_interval = setInterval(() => {
        document.querySelector('#chat-button i').className = "far fa-comments fa-fw"
        setTimeout(() => {
            document.querySelector('#chat-button i').className = "fas fa-comments fa-fw"
        }, 500);
    }, 1000);
    document.getElementById("chat-button").addEventListener('click', () => {
        clearInterval(flash_interval)
        document.querySelector('#chat-button i').className = "fas fa-comments fa-fw"
    }, {
        once: true
    })
}

socket.on('incoming-message', data => {
    console.log('incoming message')
    if (data.channel && data.channel.to === 'chat') {
        globalThis.channels.content.msg.handle(data);
        messageCount++;
    }

    else if (data.channel) {
        globalThis.channels[data.channel.origin].msg.handle(data);
        //@ts-expect-error
        DMDatabase.messages.put({data});
    }

    else {globalThis.channels.content.msg.handle(data);console.warn(`${data.id? `Message #${data.id}` : `Message '${data.text}' (message has no id)`} has no channel. It will be displayed on the main channel.`)};
})

socket.on('onload-data', data => {
    //@ts-expect-error
    DMDatabase.messages.toArray().then(messages => { // this doesn't have to be in onload-data, but i just needed to put it somewhere that it wouldn't run immediately
        for (let message of messages) {
            let data = message.data;

            if (data.channel.origin == globalThis.me.name) globalThis.channels[data.channel.to].msg.handle(data);
            else if (globalThis.channels[data.channel.origin]) globalThis.channels[data.channel.origin].msg.handle(data);
        }
    });

    sessionStorage.removeItem("attached-image-url");
    if (document.getElementById("webhook-options")) document.getElementById("webhook-options").innerHTML = "";

    sessionStorage.setItem("profile-pic", data.image);

    let profilePicDisplay = id<HTMLImageElement>("profile-pic-display");
    profilePicDisplay.src = data.image;
    profilePicDisplay.style.display = "block";

   id<HTMLImageElement>("header-profile-picture").src = data.image;

    profilePicDisplay.onclick = e => {
        if (globalThis.messageToEdit) return;
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
            delete globalThis.selectedWebhookId
            id<HTMLInputElement>('text').placeholder = "Enter a message...";
            document.getElementById("webhook-options").style.display = "none";
            id<HTMLImageElement>("profile-pic-display").src = data.image;
        });

        document.getElementById("webhook-options").appendChild(elmt);
    }

    if (data.webhooks.length >= 5) document.getElementById("webhook-options").style["overflow-y"] = "scroll";

    for (const option of data.webhooks) {
        let hasAccess = ((globalThis.me.name == option.owner) || !option.private);
        let elmt = document.createElement("div");
        elmt.classList.add("webhook-option");
        elmt.setAttribute("data-type", "webhook");
        elmt.setAttribute("data-webhook-id", option.id);
        elmt.setAttribute("data-image-url", option.image);
        elmt.setAttribute("data-webhook-name", option.name);
        elmt.setAttribute("data-webhook-gid", option.globalId)

        let imageDisp = document.createElement("img");
        imageDisp.src = option.image;
        imageDisp.alt = option.name + " (Icon)";
        elmt.appendChild(imageDisp);

        let nameDisp = document.createElement("h2");
        nameDisp.innerText = option.name + " (Bot)";
        if (!hasAccess) nameDisp.innerHTML += ` <i class="fa fa-lock"></i>`;
        elmt.appendChild(nameDisp);

        let optionsDisp = document.createElement("div");
        optionsDisp.classList.add("options");

        let editOption = document.createElement("i");
        editOption.className = "far fa-edit fa-fw"
        editOption.onclick = _ => {
            prompt('What do you want to rename the webhook to?', 'Rename Webhook', elmt.getAttribute('data-webhook-name'), 50).then(name=>{
                prompt('What do you want to change the webhook avatar to?', 'Change Avatar', elmt.getAttribute('data-image-url'), 9999999).then(avatar=>{
                    let webhookData = {
                        newName: name,
                        newImage: avatar,
                    };
                    socket.emit('edit-webhook', { 
                        webhookData: webhookData, 
                        id: elmt.getAttribute('data-webhook-gid')
                    });
                })
                .catch()
            })
            .catch()
        }

        let copyOption = document.createElement("i");
        copyOption.className = "far fa-copy fa-fw"
        copyOption.onclick = _ => {
            navigator.clipboard.writeText(`${location.origin}/webhookmessage/${elmt.getAttribute("data-webhook-id")}`)
            .then(_=>alert('The link to programmatically send webhook messages has been copied to your clipboard.\nPlease do not share this link with anyone, including members of this chat.', 'Link Copied'))
            .catch(_ => alert(`The link to programmatically send webhook messages could not be copied. It is:\n${`${location.origin}/webhookmessage/${elmt.getAttribute("data-webhook-id")}`}\nPlease do not share this link with anyone, including members of this chat.`, 'Link not Copied'))
        }

        let deleteOption = document.createElement("i");
        deleteOption.className = "far fa-trash-alt fa-fw"
        deleteOption.onclick = _ => {
            if (hasAccess) {
                confirm(`Are you sure you want to delete webhook ${elmt.getAttribute('data-webhook-name')}?`, 'Delete Webhook?')
                .then(res => {
                    if (res) socket.emit('delete-webhook', elmt.getAttribute('data-webhook-gid'));
                })
            } else {
                socket.emit('start delete webhook poll', elmt.getAttribute('data-webhook-gid'))
            }
        }

        if (hasAccess) optionsDisp.appendChild(editOption);
        if (hasAccess) optionsDisp.appendChild(copyOption);
        optionsDisp.appendChild(deleteOption);

        elmt.appendChild(optionsDisp);

        elmt.addEventListener('click', e => {
            if (!hasAccess) return;

            globalThis.selectedWebhookId = elmt.getAttribute('data-webhook-id');
            id<HTMLInputElement>('text').placeholder = "Send message as " + elmt.getAttribute('data-webhook-name') + "...";
            document.getElementById("webhook-options").style.display = "none";
            id<HTMLImageElement>("profile-pic-display").src = elmt.getAttribute('data-image-url');
        });

        if (getSetting("misc", "hide-welcome")) {
            document.getElementById("connectdiv-holder").remove();
            id<HTMLInputElement>("text").disabled = true;
            id<HTMLInputElement>("text").placeholder = "Please wait while the site loads..."
        }
        if (!getSetting("misc", "hide-private-webhooks") || hasAccess) document.getElementById("webhook-options").appendChild(elmt);
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
            prompt("What do you want to name this webhook?", "Name Webhook", "unnamed webhook", 50).then(name=>{
                prompt("What do you want the webhook avatar to be?", "Set Avatar", "https://img.icons8.com/ios-glyphs/30/000000/webcam.png", 9999999).then(avatar=>{
                    check("Make this a PRIVATE webhook").then(checked => {
                        socket.emit('add-webhook', {
                            name: name,
                            image: avatar,
                            private: checked
                        });
                    });
                })
                .catch()
            })
            .catch()
        }

        document.getElementById("webhook-options").appendChild(elmt);
    }
});

let alert_timer = null
socket.on('connection-update', data=>{
    if (getSetting('notification', 'sound-connect')) id<HTMLAudioElement>("msgSFX").play()
    sideBarAlert(`${data.name} has ${data.connection ? 'connected' : 'disconnected'}`, 5000)
})

socket.on("disconnect", ()=>{
    id<HTMLAudioElement>("msgSFX").play()
    let close_popup = sideBarAlert(`You have lost connection to the server`)
    let msg = {
        text: `You have lost connection to the server. You will automatically be reconnected if/when it is possible.`,
        author: {
            name: "Info",
            img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png"
        },
        time: new Date(new Date().toUTCString()),
        archive: false
    }
    globalThis.channels.content.msg.handle(msg)

    socket.once("connect", () => {
        id<HTMLAudioElement>("msgSFX").play()
        let msg = {
            text: `You have been reconnected.`,
            author: {
                name: "Info",
                img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png"
            },
            time: new Date(new Date().toUTCString()),
            archive: false
        }
        globalThis.channels.content.msg.handle(msg)
        close_popup()
    })
})

document.getElementById('chat-button').addEventListener('click', async _ => {
    setMainChannel("content")
})

socket.on('online-check', userinfo => {
    for (let i in globalThis.channels) {
        if (globalThis.channels[i].id !== "content") globalThis.channels[i].clearMessages()
    }

    //@ts-expect-error
    DMDatabase.messages.toArray().then(messages => { // this doesn't have to be in onload-data, but i just needed to put it somewhere that it wouldn't run immediately
        for (let message of messages) {
            let data = message.data;

            if (data.channel.origin == globalThis.me.name) globalThis.channels[data.channel.to].msg.handle(data);
            else if (globalThis.channels[data.channel.origin]) globalThis.channels[data.channel.origin].msg.handle(data);
        }
    });

    document.getElementById('online-users').innerHTML = ''
    userinfo.forEach(item => {
        const div = document.createElement('div')
        div.classList.add("online-user")
        div.setAttribute('data-user-name', item.name);
        const span = document.createElement('span')
        span.innerText = item.name
        const img = document.createElement('img')
        img.src = item.img
        let status;
        if (item.status) {
            status = document.createElement('p');
            status.innerText = item.status.char
        }
        let editOption;
        let dmOption;
        if ( item.name === globalThis.me.name ) {
            editOption = document.createElement('i');
            editOption.className = "fa-regular fa-face-meh-blank fa-fw"
            editOption.style.cursor = "pointer";
            div.addEventListener('click', e =>updateStatus());
        } else {
            if (!globalThis.channels[item.name]) makeChannel(item.name, `DM with ${item.name}`, false).msg.handle({
                    text: `You are in a DM conversation with ${item.name}. Messages here are saved in your browser, not on the server. `,
                    author: {
                        name: "",
                        img: "https://jason-mayer.com/hosted/favicon.png"
                    },
                    time: new Date(),
                    archive: false,
                    mute: true,
            })
            dmOption = document.createElement("i")
            dmOption.classList = "far fa-comment fa-fw"
            let channel = globalThis.channels[item.name]
            div.style.cursor = "pointer"
            div.title = `DM conversation with ${item.name}`
            channel.msg.secondary = ()=>{
                span.style.fontWeight = "bold"
                dmOption.classList = "fas fa-comment fa-fw"
            }
            div.addEventListener("click", ()=>{
                setMainChannel(channel.id)
                span.style.fontWeight = "normal"
                dmOption.classList = "far fa-comment fa-fw"
            })
            div.addEventListener("contextmenu", e => {
                socket.emit("start mute user poll", item.name)
            })
        }
        div.appendChild(img)
        div.appendChild(span)
        if (editOption) div.appendChild(editOption);
        if (dmOption) div.appendChild(dmOption);
        if (status) {
            div.appendChild(status);
            div.title = `${item.status.char}: ${item.status.status}`
        }
        document.getElementById('online-users').appendChild(div)
    })
    document.getElementById("online-users-count").innerHTML = `<i class="fas fa-user-alt fa-fw"></i>Currently Online (${userinfo.length}):`
})

const logout = () => {
    confirm(`Are you sure you want to log out?`, "Log Out?")
        .then(res => {
            if (res)
                fetch("/logout", {
                    method: "POST",
                }).then(res => location.reload());
        })
}
document.getElementById("logout-button").addEventListener("click", logout)

socket.on("forced_disconnect", reason=>{
    alert(`Your connection has been ended by the server, which provided the following reason: \n${reason}`, "Disconnected")
})

document.querySelector<HTMLInputElement>("#send #text").onpaste = function (event) {
    //@ts-expect-error
    let items = (event.clipboardData || event.originalEvent.clipboardData).items;
    for (let index in items) {
        let item = items[index];
        if (item.kind === 'file') {
            let blob = item.getAsFile();
            let reader = new FileReader();
            reader.onload = function (event) {
                 sessionStorage.setItem("attached-image-url", event.target.result.toString());

                 if (sessionStorage.getItem("attached-image-url")) {
                    document.querySelector<HTMLDivElement>("#attached-image-preview-container").style.display = "block";
                    id<HTMLImageElement>("attached-image-preview").src = sessionStorage.getItem("attached-image-url")
                    document.getElementById("attached-image-preview").removeAttribute("hidden")
                }
            }; 
            reader.readAsDataURL(blob);
        }
    }
}

document.querySelector<HTMLButtonElement>("#attached-image-preview-container #close-button").onclick = _ => {
    document.querySelector<HTMLDivElement>("#attached-image-preview-container").style.display = "none";
    if (sessionStorage.getItem("attached-image-url")) {;
        sessionStorage.removeItem("attached-image-url");
    }
}

socket.on("message-deleted", messageID => {
    let message = document.querySelector(`[data-message-id="${messageID}"]`)
    const channel = message.parentElement.id
    message.remove()
    globalThis.channels[channel].messageObjects = globalThis.channels[channel].messageObjects.filter(item => {
        if (item.msg === message) {
            globalThis.channels[channel].messages = globalThis.channels[channel].messages.filter(message => message !== item.data)
            return false; 
        } else return true;
    })
    globalThis.channels[channel].messageObjects.forEach(message => message.update())
    messageCount -= 1;
});

socket.on("message-edited", data => {
    let message = document.querySelector(`[data-message-id="${data.id}"]`);
    if (message) {
        const channel = message.parentElement.id
        for (let item of globalThis.channels[channel].messageObjects) {
            if (item.msg !== message) continue; 
            globalThis.channels[channel].messages[globalThis.channels[channel].messages.indexOf(item.data)] = data;
            item.data = data;
        }
        globalThis.channels[channel].messageObjects.forEach(message => message.update())
    }
});

socket.on("auto-mod-update", data => {
    sideBarAlert(data, 5000, "https://jason-mayer.com/hosted/mod.png")
})

document.getElementById("settings-header").addEventListener('click', async event=>{
    await loadSettings()
    document.getElementById("settings-holder").style.display = 'flex'
})

document.getElementById("settings-exit-button").addEventListener('click', event => {
    let settings = {};
    for (const element of document.querySelectorAll<HTMLInputElement>("div#settings_box input")) {
        settings[element.id] = element.checked
    }
    localStorage.setItem('settings', JSON.stringify(settings))
    document.getElementById("settings-holder").style.display = 'none'
    //@ts-expect-error // TODO: fix this
    updateTheme()
})

document.getElementById("header-logo-image").addEventListener("click", ()=>{
    if (document.querySelector<HTMLHtmlElement>(':root').style.getPropertyValue('--view-width') === '85%' || document.querySelector<HTMLHtmlElement>(':root').style.getPropertyValue('--view-width') == '') {
        document.querySelector<HTMLHtmlElement>(':root').style.setProperty('--view-width', '100%')
        document.querySelector<HTMLHtmlElement>(':root').style.setProperty('--sidebar-left', '-15%')
    } else {
        document.querySelector<HTMLHtmlElement>(':root').style.setProperty('--view-width', '85%')
        document.querySelector<HTMLHtmlElement>(':root').style.setProperty('--sidebar-left', '0')
    }
})

let timeUpdate = setInterval(() => {
    const date =  String(new Date().getDate())
    const ending = !"123".includes(date.slice(-1)) ? 'th' : ['11', '12', '13'].includes(date) ? 'th' : date.slice(-1) === '1' ? 'st' : date.slice(-1) === '2' ? 'nd' : 'rd' //my brain hurts
    const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]
    const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][new Date().getMonth()]
    document.getElementById("time-disp").innerHTML = `${new Date().toLocaleTimeString()}<br>${day}, ${month} ${date}${ending}`
}, 500);

setTimeout(_ => {

    document.getElementById("content").addEventListener('scroll', e => {
        if (inMessageCoolDown) return;

        if (document.getElementById("content").scrollTop > 20) return;

        inMessageCoolDown = true;

        fetch(`/archive.json?reverse=true&start=${messageCount}&count=50`, {
            headers: {
                'cookie': document.cookie
            }
        }).then(res => {
            res.json().then(messages => {
                messageCount += messages.length;
                for (let data of messages) {
                    if (data?.tag?.text === "DELETED") continue
                    data.mute = true
                    globalThis.channels.content.msg.appendTop(data)
                }
                globalThis.channels.content.messageObjects.forEach(message => message.update())
                setTimeout(_ => { inMessageCoolDown = false }, 500)
            });
        })
    }, { passive: true });
}, 1000)

socket.on("forced to disconnect", reason => {
    alert(reason, 'Server-Provided Reason:');
    alert('The server has forcefully closed your connection. Click OK to view the server-provided reason.')
})

document.getElementById("profile-picture-holder").addEventListener('click', event => {
    if (document.querySelector("#profile-picture-holder i").className === "fa-solid fa-caret-down fa-2x") {
        // currently closed, set to open
        document.querySelector("#profile-picture-holder i").className = "fa-solid fa-caret-up fa-2x";
        document.getElementById("account-options-display").style.display = "block";
    } else {
        // currently open, set to closed
        document.querySelector("#profile-picture-holder i").className = "fa-solid fa-caret-down fa-2x";
        document.getElementById("account-options-display").style.display = "none";
    }
})

function updateStatus() {
    prompt("Enter 1-3 characters to represent your status\nEnter nothing to reset your status", "Enter a Status (1/2)", "", 3).then(char => {
        if (char === "")
            confirm("Are you sure you want to reset your status?", "Reset Status")
                .then(confirmed => {
                    if (!confirmed) return;
                    socket.emit("status-reset")
                })
        else
            prompt("Enter your status", "Enter a Status (2/2)", "", 50).then(status => {
                confirm(`Are you sure you want to change your status to:\n${char}: ${status}`, "Change Status?")
                    .then(confirmed => {
                        if (!confirmed) return;
                        socket.emit("status-set", { char, status })
                    })
            });
    })
}

let typingTimer, typingStopped = true;
document.getElementById("text").addEventListener('input', event => {
    if (typingStopped)
        socket.emit('typing start', globalThis.mainChannelId === 'content' ? 'chat' : globalThis.mainChannelId)

    typingStopped = false;
    clearTimeout(typingTimer);

    typingTimer = setTimeout(() => {
        socket.emit('typing stop', globalThis.mainChannelId === 'content' ? 'chat' : globalThis.mainChannelId)
        typingStopped = true;
    }, 500)
})

socket.on('typing', (name, channel) => {
    let stopTyping;
    if (channel === 'chat') 
        stopTyping = globalThis.channels.content.msg.typing(name)
    else if (channel) 
        stopTyping = globalThis.channels[channel].msg.typing(name);

    
    const endListener = (stopName, stopChannel) => {
        if (stopName === name && stopChannel === channel) {
            stopTyping();
            socket.off('end typing', endListener)
        }
    }
    
    socket.on('end typing', endListener)
})

/**
 * Opens the reaction picker
 * @param {number} xPos X-Position of the mouse
 * @param {number} yPos Y-Position of the mouse
 * @param {number} id ID of the message that is being reacted to
 */
export function openReactPicker(xPos, yPos, id) {
    document.getElementById("react-picker").style.display = "flex";
    document.getElementById("react-picker").style.left = `calc(${xPos}px - 7.5%)`
    document.getElementById("react-picker").style.top = yPos + "px";

    document.getElementById("react-picker").setAttribute("data-id", id)

    // very strange solution, but it works
    // the first click event is called by the click that opens the reaction picker, so it has to be ignored
    // the second click event is called by the click that closes the reaction picker
        window.addEventListener('click', event =>
            window.addEventListener('click', event => document.getElementById("react-picker").style.display = "none", { once: true }), {
            once: true,
        })

}

/**
 * Adds a reaction to a message
 * @param {string} emoji Emoji to react with
 * @param {number?} overrideId ID of the message to react to, if not specified, the message that is currently being reacted to is used
 */
function addReaction(emoji, overrideId?) {
    const id = overrideId? overrideId : document.getElementById("react-picker").getAttribute("data-id")
    
    socket.emit('react', id, emoji)
}

document.querySelectorAll(".add-reaction").forEach(item => {
    item.addEventListener('click', _event => addReaction(item.getAttribute("data-reaction")))
})

socket.on("reaction", (id, message) => {
    let editMessage = document.querySelector(`[data-message-id="${id}"]`);
    if (editMessage) {
        const channel = editMessage.parentElement.id
        for (let item of globalThis.channels[channel].messageObjects) {
            if (item.msg !== editMessage) continue;
            globalThis.channels[channel].messages[globalThis.channels[channel].messages.indexOf(item.data)] = message;
            item.data = message;
            item.update();
        }
    }
})

socket.on("poll", (prompt, startMessage, respond) => {
    confirm(prompt, "Poll")
        .then(confirmed => {
            respond(confirmed)
        })
    alert(startMessage, "Poll")
})

socket.on('alert', (title, message) => alert(message, title))