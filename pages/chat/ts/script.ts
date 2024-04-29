import { alert, sideBarAlert } from "./popups"
import userDict from "./userDict";
import { View, ViewContent } from './channels'
import { io, Socket } from 'socket.io-client';
import { id, getInitialData } from "./functions";
import Message from './message'
import { MessageBar } from "./messageBar";
import { ClientToServerEvents, ServerToClientEvents } from "../../../ts/lib/socket";
import Room from './rooms'
import SideBar from './sideBar';
import { openStatusViewer, openWhatsNew, TopBar } from './ui'
import DM from './dms'
import { setRepeatedUpdate } from './schedule'
import { OnlineStatus, Status } from "../../../ts/lib/authdata";
import Settings from './settings'
import { title } from './title'
import { notifications } from "./home";
import { TextNotification, UpdateNotification } from "../../../ts/lib/notifications";

["keyup", "change"].forEach(n =>
    //@ts-expect-error
    addEventListener(n, e => e.target.getAttribute("lsa-security") !== "off" && e.stopPropagation(),
        { capture: true }
    ))

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
export const blocklist = initialData.blocklist;
userDict.update({ ...me, online: OnlineStatus.active });

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

document.querySelector("#loading p").innerHTML = "Creating Sidebar"

document.querySelector("#loading p").innerHTML = `Loading Invites`
initialData.invites.forEach(i => notifications.addInvite(i))

// initialize title
title.reset()

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

        if (count === max)
            return id('loading').remove();

        count++;
        document.querySelector<HTMLParagraphElement>("#loading p").innerText = `Loading room ${count} of ${max}`

        const room = new Room(roomsIter.next().value)
        room.ready.then(() => {
            "#" + room.id === location.hash && room.makeMain()
            loadRooms();
        });
    }

    const dmsIter = dms.values();
    const loadDms = () => {

        if (count === dms.length)
            return loadRooms()

        count++;
        document.querySelector<HTMLParagraphElement>("#loading p").innerText = `Loading room ${count} of ${max}`

        new DM(dmsIter.next().value).ready.then(() => loadDms());
    }

    loadDms();
}

socket.on("invites updated", invites => {
    notifications.clearInvites();
    invites.forEach(i => notifications.addInvite(i))
})

socket.on("added to room", Room.addedToRoomHandler)
socket.on("removed from room", Room.removedFromRoomHandler)
socket.on("added to dm", DM.dmStartedHandler)

if (!localStorage.getItem("welcomed") || Settings.get("always-show-popups"))
    id("connectbutton").addEventListener("click", () => {
        id("connectdiv-holder").remove()
        localStorage.setItem("welcomed", 'true')
    }, { once: true })
else id("connectdiv-holder").remove()

socket.on("userData updated", data => {
    if (data.id !== me.id)
        return;

    me.status = data.status;
    me.name = data.name;
    me.img = data.img;
    me.schedule = data.schedule;
    // can't set me directly, but can set properties of it

    id("header-user-name").innerText = `${me.name}${me.status ? " " + me.status.char : ""}`;

    if (data.schedule) {
        if (stopScheduleUpdate) stopScheduleUpdate();
        stopScheduleUpdate = setRepeatedUpdate(data.schedule, id("header-user-schedule"), true, shortenText(me.status.status))
    } else if (me.status)
        id("header-user-schedule").innerText = shortenText(me.status.status);
    else id("header-user-schedule").innerText = ""
})

id("header-user-name").innerText = `${me.name}${me.status ? " " + me.status.char : ""}`;
id("settings-header").addEventListener("click", () => Settings.open());
id("user-img-holder").addEventListener("click", () => userDict.generateUserCard(me).showModal())

let stopScheduleUpdate: () => void;
if (me.schedule)
    stopScheduleUpdate = setRepeatedUpdate(me.schedule, id("header-user-schedule"), true, shortenText(me.status.status))
else if (me.status)
    id("header-user-schedule").innerText = shortenText(me.status.status)

if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    Notification.requestPermission()
}


socket.on('connection-update', data => {
    if (Settings.get("sound-connection")) id<HTMLAudioElement>("msgSFX").play()
    sideBarAlert({
        message: `${data.name} has ${data.connection ? 'connected' : 'disconnected'}`,
        expires: 5000
    })
})

socket.on("disconnect", () => {
    id<HTMLAudioElement>("msgSFX").play()
    sideBarAlert({ message: `You have lost connection to the server.` });

    socket.once("connect", () => location.reload())
})

// const logout = () => {
//     confirm(`Are you sure you want to log out?`, "Log Out?")
//         .then(res => {
//             if (res)
//                 fetch("/logout", {
//                     method: "POST",
//                 }).then(res => location.reload());
//         })
// }
// document.getElementById("logout-button").addEventListener("click", logout)

socket.on("forced_disconnect", reason => {
    alert(`Your connection has been ended by the server, which provided the following reason: \n${reason}`, "Disconnected")
})

socket.on("auto-mod-update", data => {
    sideBarAlert({ message: data, expires: 5000, icon: "/public/mod.png" });
})

socket.on("forced to disconnect", reason => {
    alert(reason, 'Server-Provided Reason:');
    alert('The server has forcefully closed your connection. Click OK to view the server-provided reason.')
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

socket.on("userData updated", data => userDict.update(data, true))
socket.on("online state change", (id, state) => {
    const old = userDict.getData(id);
    if (!old) return;

    userDict.update({
        ...old.userData,
        online: state,
        lastOnline: Date.now()
    }, true)
})


/**
 * Relatively formats time
 * @param time time to format
 * @param now Whether or not to say 'now' instead of going into seconds
 * @returns Time formatted relatively
 */
export function formatRelativeTime(time: number, now: boolean = false): string {

    // loosely based on this SO answer:
    // https://stackoverflow.com/a/67374710/
    // they use the same "algorithm", but this version is more concise and imo better

    const
        dif = time - Date.now(),
        formatter = new Intl.RelativeTimeFormat('en-US', {
            style: 'narrow',
        }),
        units = Object.entries({
            year: 1000 * 60 * 60 * 24 * 365, // i doubt this will ever happen
            month: 1000 * 60 * 60 * 24 * 30,  // even this is stretching it
            week: 1000 * 60 * 60 * 24 * 7,
            day: 1000 * 60 * 60 * 24,
            hour: 1000 * 60 * 60,
            minute: 1000 * 60,
            second: 1000
        });


    return time === 0 ? "" :
        (Math.abs(dif) < 1000 * 60) && now ? 'now' :
            (function getEnding(index: number): string {
                if (Math.abs(dif) > units[index][1] || index >= 6) // index >= 6 stops infinite loop
                    return formatter.format(Math.trunc(dif / units[index][1]), units[index][0] as any);

                return getEnding(index + 1);
            })(0)

}

/**
 * Shortens text, adding a "..." if it is above the character limit
 * @param text Text to shorten
 * @param limit Character limit (optional, default 20)
 * @returns Shortened text
 */
export function shortenText(text: string, limit: number = 20) {
    if (text.length <= limit)
        return text;

    return text.slice(0, limit - 3) + "...";
}

socket.on("block", (userId, block, list) => {
    if (block)
        blocklist[list].includes(userId) || blocklist[list].push(userId);
    else
        blocklist[list] = blocklist[list].filter(i => i !== userId);

    userDict.setPart(userId, list === 0 ? "blockedByMe" : "blockingMe", block);
})

/**
 * Closes a HTML dialog element
 * @param dialog Dialog to close
 */
export function closeDialog(dialog: HTMLDialogElement, remove: boolean = true) {

    if (!Settings.get("animate-popups"))
        return dialog.remove();

    dialog.classList.add("closing");

    dialog.addEventListener("animationend", () => {
        if (remove) dialog.remove();
        else dialog.close();
    }, { once: true })

}

socket.emit("get notifications", data => {
    for (const notification of data)
        notifications.addNotification(notification);
});

socket.on("notification", notification => notifications.addNotification(notification));

type NotificationData = TextNotification | Status | UpdateNotification;
export const NotificationHandlers: ((data: NotificationData, close: () => void) => void)[] = [
    async (data: TextNotification, close) => {
        await alert(data.content, data.title);
        close();
    },
    async (data: Status, close) => {
        await openStatusViewer(data);
        close();
    },
    async (data: UpdateNotification, close) => {
        await openWhatsNew(data);
        close();
    }
]