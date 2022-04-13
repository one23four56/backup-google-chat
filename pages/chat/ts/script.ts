import { alert, confirm, prompt, sideBarAlert } from "./popups"
import { makeChannel, setMainChannel } from './channels'
import { io } from 'socket.io-client';
import Dexie from 'dexie';
import { addReaction, doInitialMessageLoad, getSetting, id, loadSettings, updateStatus } from "./functions";
import getLoadData from './dataHandler'

export const socket = io();
globalThis.viewList = []
globalThis.channels = {}

// Dexie.delete('DMDatabase');
let DMDatabase = new Dexie("DMDatabase");

DMDatabase.version(1).stores({
    messages: '++key,data'
})

globalThis.me = await (await fetch('/me')).json()
await getLoadData()
makeChannel("content", "Main", true);
if (getSetting("misc", "hide-welcome")) document.getElementById("connectdiv-holder").remove();
await doInitialMessageLoad()

id("loading").remove()

socket.on('load data updated', getLoadData)


let
    messageCount = 50,
    inMessageCoolDown = false;


if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    Notification.requestPermission()
}

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