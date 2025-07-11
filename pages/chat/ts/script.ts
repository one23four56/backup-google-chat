import { alert, sideBarAlert } from "./popups"
import userDict from "./userDict";
import Channel, { View, ViewContent, channelReference } from './channels'
import { io, Socket, protocol as socketProtocol } from 'socket.io-client';
import Message from './message'
import { MessageBar } from "./messageBar";
import { ClientToServerEvents, DebugData, InitialData, ServerToClientEvents } from "../../../ts/lib/socket";
import Room from './rooms'
import SideBar from './sideBar';
import { openStatusViewer, openWhatsNew, showKickedNotification, showWelcome, TopBar } from './ui'
import DM from './dms'
import { setRepeatedUpdate } from './schedule'
import { OnlineStatus, Status } from "../../../ts/lib/authdata";
import Settings from './settings'
import { title } from './title'
import { notifications } from "./home";
import { KickNotification, TextNotification, UpdateNotification } from "../../../ts/lib/notifications";
import { initializeWatchers } from "./socket";
import { Temporal } from "temporal-polyfill";

export const id = <type extends HTMLElement = HTMLElement>(elementId: string) => document.querySelector<type>(`#${elementId}`);

["keyup", "change"].forEach(n =>
    //@ts-expect-error
    addEventListener(n, e => e.target.getAttribute("lsa-security") !== "off" && e.stopPropagation(),
        { capture: true }
    ))

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
    {
        path: '/socket'
    }
);

initializeWatchers(socket);

// debug loggers
DEV: socket.onAny((name, ...args) => console.log(`socket: ↓ received "${name}" with ${args.length} args:\n`, ...args, `\nTimestamp: ${new Date().toLocaleString()}`));
DEV: socket.onAnyOutgoing((name, ...args) => console.log(`socket: ↑ sent "${name}" with ${args.length} args:\n`, ...args, `\nTimestamp: ${new Date().toLocaleString()}`));

//@ts-expect-error window.initial is defined by a separate script, so ts doesn't know about it
const initialData: InitialData = window.initial;

export let me = initialData.me
globalThis.me = me; // for now, will be removed
export let rooms = initialData.rooms
export let dms = initialData.dms
export const blocklist = initialData.blocklist;
userDict.update({ ...me, online: OnlineStatus.active });

id<HTMLImageElement>("header-profile-picture").src = me.img

// all custom elements have to be defined here otherwise it throws a really vague error
// it literally took me almost an hour to figure out what the error meant
// also element names have to have a dash in them for some reason if they don't it throws the same vague error
window.customElements.define('view-holder', View)
window.customElements.define('view-content', ViewContent)
window.customElements.define('message-element', Message);
window.customElements.define('message-bar', MessageBar)
window.customElements.define('view-top-bar', TopBar);

initialData.invites.forEach(i => notifications.addInvite(i))

// initialize title
title.reset()

// load rooms
await Promise.all([
    ...initialData.rooms.map(r => new Room(r).ready),
    ...initialData.dms.map(d => new DM(d).ready)
]);

// document.querySelector("#loading i").className = "fa-solid fa-check";
document.querySelector<HTMLElement>("#loading i").style.visibility = "hidden";
id('loading').style.opacity = "0.9";
id('loading').style.top = "-100%";
setTimeout(() => id('loading').remove(), 1000);

if (location.hash)
    channelReference[location.hash.split("#")[1]]?.makeMain();

socket.on("invites updated", invites => {
    notifications.clearInvites();
    invites.forEach(i => notifications.addInvite(i))
})

socket.on("added to room", Room.addedToRoomHandler)
socket.on("removed from room", Room.removedFromRoomHandler)
socket.on("added to dm", DM.dmStartedHandler)

// if (!localStorage.getItem("welcomed") || Settings.get("always-show-popups"))
//     id("connectbutton").addEventListener("click", () => {
//         id("connectdiv-holder").remove()
//         localStorage.setItem("welcomed", 'true')
//     }, { once: true })
// else id("connectdiv-holder").remove()
id("connectdiv-holder").remove()

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
        stopScheduleUpdate = setRepeatedUpdate(data.schedule, id("header-user-schedule"), true, me.status ? shortenText(me.status.status) : "")
    } else if (me.status)
        id("header-user-schedule").innerText = shortenText(me.status.status);
    else id("header-user-schedule").innerText = ""
})

id("header-user-name").innerText = `${me.name}${me.status ? " " + me.status.char : ""}`;
id("settings-header").addEventListener("click", () => Settings.open());
id("user-img-holder").addEventListener("click", () => userDict.generateUserCard(me).showModal())

let stopScheduleUpdate: () => void;
if (me.schedule)
    stopScheduleUpdate = setRepeatedUpdate(me.schedule, id("header-user-schedule"), true, me.status ? shortenText(me.status.status) : "")
else if (me.status)
    id("header-user-schedule").innerText = shortenText(me.status.status)

if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    Notification.requestPermission()
}


socket.on('connection-update', data => {
    if (data.name === me.name) return;
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

socket.on("auto-mod-update", data => sideBarAlert({ message: data, expires: 5000, icon: "/public/mod.png" }));
socket.on("forced to disconnect", reason => alert(`The server has closed your connection:\n${reason}`, "Disconnected"));
socket.on('alert', (title, message) => alert(message, title));

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
            3 * 60 * 1000
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
    dialog.dispatchEvent(new Event("close"));

    dialog.addEventListener("animationend", () => {
        if (remove) dialog.remove();
        else dialog.close();
    }, { once: true });

}

socket.emit("get notifications", data => {
    for (const notification of data)
        notifications.addNotification(notification);
});

socket.on("remove notification", id => notifications.removeChannel(id));
// bc of the way removeChannel works, it also happens to remove notifications
// way to save me some time lol

socket.on("notification", notification => notifications.addNotification(notification));

type NotificationData = TextNotification | Status | UpdateNotification | KickNotification | undefined;
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
    },
    async (data: KickNotification, close) => {
        if (await showKickedNotification(data))
            close();
    },
    async (data: undefined, close) => {
        // await showWelcome();
    }
]

export function isRoom(channel: Channel): channel is Room {
    //@ts-expect-error
    return channel.room === true;
}

/**
 * Escapes a string (removes HTML tags, i.e \<b\> becomes \&lt;b\&gt;)
 * @param string String to escape
 * @returns Escaped string
 */
export function escape(string: string) {
    // yes i copy and pasted from functions.ts lol
    return String(string)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/`/g, "&#x60;")
        .replace(/\//g, "&#x2F;");
}

document.addEventListener("keydown", async e => {
    if (!e.ctrlKey || e.key !== ";") return;
    e.preventDefault();

    const start = Date.now();
    const data = await new Promise<DebugData>(res => socket.emit("debug", d => res(d)));
    const end = Date.now();
    const dialog = document.body.appendChild(document.createElement("dialog"));
    dialog.style.color = "var(--main-text-color)";
    dialog.style.width = "30%";

    const title = dialog.appendChild(document.createElement("p"));
    title.innerText = "Server Information";
    title.style.textAlign = "center";
    title.style.margin = "0";

    const add = (title: string, content: string) => {
        const p = dialog.appendChild(document.createElement("p"));
        p.appendChild(document.createElement("b")).innerText = title + ": ";
        const code = p.appendChild(document.createElement("code"));
        code.innerText = content;
        p.style.display = "flex";
        code.style.marginLeft = "auto";
    };

    add("Version", data.version + ", node " + data.node);

    add("Server Uptime", Temporal.Duration.from({
        milliseconds: Math.round(data.serverStart * 1000)
    }).round({ largestUnit: 'day', smallestUnit: "second" }).toLocaleString());

    add("Session Uptime", Temporal.Duration.from({
        milliseconds: Date.now() - data.clientStart
    }).round({ largestUnit: 'day', smallestUnit: "second" }).toLocaleString());

    add("Connection Protocol", `v${socketProtocol} ${socket.io.engine.transport.name}`)

    add("Socket Latency (Ping)", `${end - start}ms`);

    const timezoneOffset = new Date().getTimezoneOffset();

    add("CPU Time", Temporal.Duration.from({
        microseconds: data.cpu.user + data.cpu.system
    }).round({ largestUnit: 'hour' }).toLocaleString());

    add("Timezone Difference", `${timezoneOffset - data.timezone} (C${timezoneOffset}-S${data.timezone})`)

    add("Session I/O", data.socket.join(" / "));

    add("Global I/O", data.global.join(" / "));

    add("Data A/P/S(T)", data.data.join(" / ") + ` (${data.data.reduce((x, y) => x + y)})`);

    const memory = (data) => `${Math.round(data / 1024 / 1024 * 100) / 100} MB`;

    add("Resident Set Size (RSS)", memory(data.memory.rss))

    add("Heap Used / Total", `${memory(data.memory.heapUsed)} / ${memory(data.memory.heapTotal)} (${(100 * data.memory.heapUsed / data.memory.heapTotal).toFixed(2)
        }%)`);

    add("V8 External Memory", memory(data.memory.external))

    add("Bad Reads", `${data.badReads} ${data.badReads === 0 ? "🟢" : "🔴"}`);

    const close = dialog.appendChild(document.createElement("p"));
    close.innerText = "Press `ESC` to close";
    close.style.textAlign = "center";
    close.style.margin = "0";

    dialog.showModal();
})