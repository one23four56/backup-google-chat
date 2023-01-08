import { alert, confirm, prompt, sideBarAlert } from "./popups"
import { View, ViewContent } from './channels'
import { io, Socket } from 'socket.io-client';
import { id, getInitialData } from "./functions";
import Message from './message'
import { MessageBar } from "./messageBar";
import { ClientToServerEvents, ServerToClientEvents } from "../../../ts/lib/socket";
import Room from './rooms'
import SideBar, { getMainSideBar, SideBarItem, SideBarItemCollection } from './sideBar';
import { loadInvites, openScheduleSetter, openStatusSetter, openWhatsNew, TopBar } from './ui'
import DM from './dms'
import { setRepeatedUpdate } from './schedule'
import { OnlineStatus } from "../../../ts/lib/authdata";
import Settings from './settings'

document.querySelector("#loading p").innerHTML = "Establishing connection"

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    {
        path: '/socket'
    }
);

// debug loggers
socket.onAny((name, ...args) => console.log(`socket: ↓ received "${name}" with ${args.length} args:\n`, ...args, `\nTimestamp: ${new Date().toLocaleString()}`))
socket.onAnyOutgoing((name, ...args) => console.log(`socket: ↑ sent "${name}" with ${args.length} args:\n`, ...args, `\nTimestamp: ${new Date().toLocaleString()}`))

document.querySelector("#loading p").innerHTML = "Fetching Data"

const initialData = await getInitialData(socket);

export let me = initialData.me
globalThis.me = me; // for now, will be removed
export let rooms = initialData.rooms
export let dms = initialData.dms

id<HTMLImageElement>("header-profile-picture").src = me.img

document.querySelector("#loading p").innerHTML = "Defining Objects"

// all custom elements have to be defined here otherwise it throws a really vague error
// it literally took me almost an hour to figure out what the error meant
// also element names have to have a dash in them for some reason if they don't it throws the same vague error
window.customElements.define('view-holder', View)
window.customElements.define('view-content', ViewContent)
window.customElements.define('message-element', Message);
window.customElements.define('message-bar', MessageBar)
window.customElements.define('view-top-bar', TopBar);
window.customElements.define('sidebar-element', SideBar)
window.customElements.define('sidebar-item-collection', SideBarItemCollection)
window.customElements.define('sidebar-item', SideBarItem)

document.querySelector("#loading p").innerHTML = "Creating Sidebar"

getMainSideBar() // load main sidebar

document.querySelector("#loading p").innerHTML = `Loading Invites`
loadInvites(initialData.invites)

{
    /**
     * A regular for loop here spams the server with a bunch of requests at once, but 
     * this does them one at a time to decrease load on the server
     * 
     * Also it makes the 'Loading room x of y' text work
     * 
     * And it makes so if there are unread messages in the room it shows up as unread right 
     * the loading screen goes away, instead of making you wait a little bit
     * 
     * I will admit tho it is pretty messy and overly complex, but it works so ¯\_(ツ)_/¯ 
     */

    let count = 0;
    const max = rooms.length + dms.length;

    const roomsIter = rooms.values();
    const loadRooms = () => {

        if (count === rooms.length)
            return loadDms();

        count++;
        document.querySelector<HTMLParagraphElement>("#loading p").innerText = `Loading room ${count} of ${max}`
        
        new Room(roomsIter.next().value).ready.then(() => loadRooms());
    }

    const dmsIter = dms.values();
    const loadDms = () => {

        if (count === max)
            return id('loading').remove();

        count++;
        document.querySelector<HTMLParagraphElement>("#loading p").innerText = `Loading room ${count} of ${max}`
        
        new DM(dmsIter.next().value).ready.then(() => loadDms());
    }

    loadRooms();
}

socket.on("invites updated", loadInvites)

socket.on("added to room", Room.addedToRoomHandler)
socket.on("removed from room", Room.removedFromRoomHandler)
socket.on("added to dm", DM.dmStartedHandler)

if (!localStorage.getItem("welcomed") || Settings.get("always-show-popups"))
    id("connectbutton").addEventListener("click", () => {
        id("connectdiv-holder").remove()
        localStorage.setItem("welcomed", 'true')
        openWhatsNew()
    }, { once: true })
else {
    id("connectdiv-holder").remove()
    openWhatsNew()
}

socket.on("userData updated", data => {
    if (data.id !== me.id)
        return;

    me.status = data.status;
    me.name = data.name;
    me.img = data.img;
    me.schedule = data.schedule;
    // can't set me directly, but can set properties of it

    id("header-status").innerText = data.status?.char || "+"

    if (data.schedule) {
        if (stopScheduleUpdate) stopScheduleUpdate();
        stopScheduleUpdate = setRepeatedUpdate(data.schedule, id("header-schedule"), true)
    }
})

id("header-status").innerText = me.status?.char || "+"
id("header-status").addEventListener("click", openStatusSetter)

id("header-schedule-button").addEventListener("click", openScheduleSetter);

id("settings-header").addEventListener("click", () => Settings.open())

let stopScheduleUpdate: () => void;
if (me.schedule) {
    id("header-schedule").classList.add("no-outline")
    stopScheduleUpdate = setRepeatedUpdate(me.schedule, id("header-schedule"), true)
}

if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    Notification.requestPermission()
}


socket.on('connection-update', data => {
    if (Settings.get("sound-connection")) id<HTMLAudioElement>("msgSFX").play()
    sideBarAlert(`${data.name} has ${data.connection ? 'connected' : 'disconnected'}`, 5000)
})

socket.on("disconnect", () => {
    id<HTMLAudioElement>("msgSFX").play()
    sideBarAlert(`You have lost connection to the server.`)
    sideBarAlert(`When possible, you will be reconnected.`)

    socket.once("connect", () => location.reload())
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

socket.on("forced_disconnect", reason => {
    alert(`Your connection has been ended by the server, which provided the following reason: \n${reason}`, "Disconnected")
})

socket.on("auto-mod-update", data => {
    sideBarAlert(data, 5000, "../public/mod.png")
})

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

document.querySelectorAll("#header-p, #header-logo-image").forEach(element => element.addEventListener("click", () => {

    // get main sidebar 
    const sideBar =
        [...document.querySelectorAll<SideBar>("sidebar-element")]
            .find(s => s.isMain)

    if (!sideBar) return;

    // toggle collapse
    sideBar.toggleCollapse()

}))


// online state updater
{
    let idleTimer: ReturnType<typeof setTimeout>;

    // initialize handlers
    const blur = () => {
        socket.emit("set online state", OnlineStatus.online)
        idleTimer = setTimeout(
            () => socket.emit("set online state", OnlineStatus.idle),
            2.5 * 60 * 1000
        )
    };

    const focus = () => {
        socket.emit("set online state", OnlineStatus.active);
        idleTimer && clearTimeout(idleTimer);
    };

    // start event listeners
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);

    // determine online state & inform server
    if (document.hasFocus()) focus();
    else blur();
}

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