import { alert, confirm, prompt, sideBarAlert } from "./popups"
import Channel, { View } from './channels'
import { io, Socket } from 'socket.io-client';
import { getSetting, id, loadSettings, getInitialData } from "./functions";
import getLoadData from './dataHandler'
import Message from './message'
import { MessageBar } from "./messageBar";
import { ClientToServerEvents, ServerToClientEvents } from "../../../ts/lib/socket";
import Room from './rooms'
import SideBar, { SideBarItem, SideBarItemCollection } from './sideBar';
import { loadInvites, openStatusSetter, openWhatsNew, TopBar } from './ui'
import DM from './dms'

document.querySelector("#loading p").innerHTML = "Creating Socket"

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io();

// debug loggers
socket.onAny((name, ...args) => console.log(`socket: ↓ received "${name}" with ${args.length} args:\n`, ...args, `\nTimestamp: ${new Date().toLocaleString()}`))
socket.onAnyOutgoing((name, ...args) => console.log(`socket: ↑ sent "${name}" with ${args.length} args:\n`, ...args, `\nTimestamp: ${new Date().toLocaleString()}`))

document.querySelector("#loading p").innerHTML = "Fetching Data"

const initialData = await getInitialData(socket);

document.querySelector("#loading p").innerHTML = "Fetching Settings"

await loadSettings()

document.querySelector("#loading p").innerHTML = "Saving Data"

export let me = initialData.me
globalThis.me = me; // for now, will be removed
export let rooms = initialData.rooms
export let dms = initialData.dms




document.querySelector("#loading p").innerHTML = "Defining Objects"

window.customElements.define('message-holder', View)
window.customElements.define('message-element', Message);
window.customElements.define('message-bar', MessageBar)
window.customElements.define('view-top-bar', TopBar);
window.customElements.define('sidebar-element', SideBar)
window.customElements.define('sidebar-item-collection', SideBarItemCollection)
window.customElements.define('sidebar-item', SideBarItem)

document.querySelector("#loading p").innerHTML = "Creating Sidebar"

try {


rooms.forEach(room => {

    document.querySelector("#loading p").innerHTML = `Loading Room ${room.name}`

    const roomObj = new Room(room)
})

dms.forEach(dm => {

    document.querySelector("#loading p").innerHTML = `Loading DM with ${dm.name}`

    const dmObj = new DM(dm)
})

document.querySelector("#loading p").innerHTML = `Loading Invites`

loadInvites(initialData.invites)

socket.on("invites updated", loadInvites)

socket.on("added to room", Room.addedToRoomHandler)
socket.on("removed from room", Room.removedFromRoomHandler)
socket.on("added to dm", DM.dmStartedHandler)

    if (!localStorage.getItem("welcomed") || getSetting('misc', 'always-show-popups'))
        id("connectbutton").addEventListener("click", () => {
            id("connectdiv-holder").remove()
            localStorage.setItem("welcomed", 'true')
            openWhatsNew()
        }, { once: true })
    else {
        id("connectdiv-holder").remove()
        openWhatsNew()
    }

id("loading").remove()

socket.on('load data updated', getLoadData)

socket.on("userData updated", data => {
    if (data.id !== me.id)
        return;

    me.status = data.status;
    me.name = data.name;
    me.img = data.img;
    // can't set me directly, but can set properties of it

    id("header-status").innerText = data.status?.char || "No Status"
})

id("header-status").innerText = me.status?.char || "No Status"
id("header-status").addEventListener("click", openStatusSetter)

if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    Notification.requestPermission()
}

// document.getElementById("send").addEventListener('submit', event => {
//     event.preventDefault()

//     const formdata = new FormData(id<HTMLFormElement>("send"))
//     id<HTMLInputElement>("text").value = ""

//     if (formdata.get("text") === "" && !sessionStorage.getItem("attached-image-url")) return;

//     if (globalThis.messageToEdit) {
//         socket.emit('edit-message', {
//             messageID: globalThis.messageToEdit, 
//             text: formdata.get('text').toString().trim()
//         })
//         delete globalThis.messageToEdit
//         id<HTMLImageElement>('profile-pic-display').src = document.getElementById('profile-pic-display').getAttribute('data-old-src')
//     } else if (globalThis.selectedWebhookId) {
//         if (globalThis.mainChannelId!=="content") {alert("Webhooks are currently not supported in DMs", "Error");return}
//         socket.emit('send-webhook-message', {
//             data: {
//                 id: globalThis.selectedWebhookId,
//                 text: formdata.get('text').toString().trim(),
//                 archive: id<HTMLInputElement>('save-to-archive').checked,
//                 image: sessionStorage.getItem("attached-image-url"),
//                 replyTo: globalThis.replyTo
//             }
//         });
//     } else {
//         socket.emit('message', {
//             text: formdata.get('text').toString().trim(),
//             archive: id<HTMLFormElement>('save-to-archive').checked,
//             image: sessionStorage.getItem("attached-image-url"),
//             recipient: globalThis.mainChannelId === 'content' ? 'chat' : globalThis.mainChannelId,
//             replyTo: globalThis.replyTo
//         }, data => {
//             data.mute = getSetting('notification', 'sound-send-message')? false : true
//             // if (data.channel && data.channel.to === 'chat') globalThis.channels.content.msg.handle(data);
//             // else {
//             //     globalThis.channels[data.channel.to].msg.handle(data);
//             // }

//             content.handle(oldToNewConverter(data))
//         })

//     }
//     sessionStorage.removeItem("attached-image-url");
//     document.querySelector<HTMLDivElement>("#attached-image-preview-container").style.display = "none";
// })

// socket.on('incoming-message', data => {
//     // if (data.channel && data.channel.to === 'chat') {
//     //     globalThis.channels.content.msg.handle(data);
//     //     messageCount++;
//     // }

//     // else if (data.channel) {
//     //     globalThis.channels[data.channel.origin].msg.handle(data);
//     //     //@ts-expect-error
//     //     DMDatabase.messages.put({data});
//     // }

//     // else {globalThis.channels.content.msg.handle(data);console.warn(`${data.id? `Message #${data.id}` : `Message '${data.text}' (message has no id)`} has no channel. It will be displayed on the main channel.`)};

//     content.handle(oldToNewConverter(data))
// })

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

// document.querySelector<HTMLInputElement>("#send #text").onpaste = function (event) {
//     //@ts-expect-error
//     let items = (event.clipboardData || event.originalEvent.clipboardData).items;
//     for (let index in items) {
//         let item = items[index];
//         if (item.kind === 'file') {
//             let blob = item.getAsFile();
//             let reader = new FileReader();
//             reader.onload = function (event) {
//                  sessionStorage.setItem("attached-image-url", event.target.result.toString());

//                  if (sessionStorage.getItem("attached-image-url")) {
//                     document.querySelector<HTMLDivElement>("#attached-image-preview-container").style.display = "block";
//                     id<HTMLImageElement>("attached-image-preview").src = sessionStorage.getItem("attached-image-url")
//                     document.getElementById("attached-image-preview").removeAttribute("hidden")
//                 }
//             }; 
//             reader.readAsDataURL(blob);
//         }
//     }
// }

// document.querySelector<HTMLButtonElement>("#attached-image-preview-container #close-button").onclick = _ => {
//     document.querySelector<HTMLDivElement>("#attached-image-preview-container").style.display = "none";
//     if (sessionStorage.getItem("attached-image-url")) {;
//         sessionStorage.removeItem("attached-image-url");
//     }
// }

socket.on("auto-mod-update", data => {
    sideBarAlert(data, 5000, "../public/mod.png")
})

document.getElementById("settings-header").addEventListener('click', async _event => {
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

// setTimeout(_ => {

//     document.getElementById("content").addEventListener('scroll', e => {
//         if (inMessageCoolDown) return;

//         if (document.getElementById("content").scrollTop > 20) return;

//         inMessageCoolDown = true;

//         fetch(`/archive.json?reverse=true&start=${messageCount}&count=50`, {
//             headers: {
//                 'cookie': document.cookie
//             }
//         }).then(res => {
//             res.json().then(messages => {
//                 messageCount += messages.length;
//                 for (let data of messages) {
//                     if (data?.tag?.text === "DELETED") continue
//                     data.mute = true
//                     globalThis.channels.content.msg.appendTop(data)
//                 }
//                 globalThis.channels.content.messageObjects.forEach(message => message.update())
//                 setTimeout(_ => { inMessageCoolDown = false }, 500)
//             });
//         })
//     }, { passive: true });
// }, 1000)

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

socket.on('alert', (title, message) => alert(message, title))

socket.on("ping", (from: string, respond: () => void) => {
    if (getSetting("misc", "hide-pings") && document.hasFocus()) {
        respond();
        return;
    }
    alert(`${from} has sent you a ping. Click OK to respond.`, `Ping from ${from}`).then(_ => {
        respond();
    })
})

document.addEventListener('keydown', event => {
    if (event.key === 's' && event.ctrlKey) {
        event.preventDefault();
        prompt("Enter a URL to shorten", "Shorten URL", "https://www.example.com", 999999).then(url => {
            if (!url) return;
            socket.emit('shorten url', url, (url) =>
                navigator.clipboard.writeText(url)
                .then(() => alert(`Shortened URL has been copied to your clipboard`, "URL Shortened"))
                .catch(_err => alert(`URL: ${url}`, "URL Shortened"))
            )
        })
    }
})

document.addEventListener('keydown', event => {
    if (
        document.querySelector('div.message.highlight.manual') &&
        (event.key === 'a' || event.key === 'e' || event.key === 'd' || event.key === 'r') &&
        id<HTMLInputElement>("text") !== document.activeElement
    ) {
        event.preventDefault();
        const message = document.querySelector<Message>('div.message.highlight.manual')
        switch (event.key) {
            case 'a':
                // react
                // this one is the hardest to do since it doesn't work with just click()
                if (message.channel)
                    message.channel.initiateReaction(
                        Number(message.getAttribute("data-message-id")),
                        (message.getBoundingClientRect().left + message.getBoundingClientRect().right) / 2,
                        message.getBoundingClientRect().top
                    )
                break;
            case 'e':
                // edit
                document.querySelector<HTMLButtonElement>('div.message.highlight.manual .fa-edit')?.click()
                break;
            case 'd':
                // delete
                document.querySelector<HTMLButtonElement>('div.message.highlight.manual .fa-trash-alt')?.click()
                break;
            case 'r':
                // reply
                document.querySelector<HTMLButtonElement>('div.message.highlight.manual .fa-reply')?.click()
                break; // break is not needed but i like it so it is here
        }
    }
})

// id('open-dev-options-button').addEventListener('click', event => {
//     id('dev-options').style.display = "block";

//     id('dev-options').style.left = event.clientX + "px";
//     id('dev-options').style.top = event.clientY + "px";

//     document.addEventListener('click', _event => {
//         document.addEventListener('click', _event => {
//             id('dev-options').style.display = "none";
//         }, {once: true})
//     }, {once: true})
// })

} catch (err) {
    console.error(err)
}