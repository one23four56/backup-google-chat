import {confirm, prompt} from './popups';
import { socket } from './script';

export function updateStatus() {
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
export function addReaction(emoji, overrideId?) {
    const id = overrideId ? overrideId : document.getElementById("react-picker").getAttribute("data-id")

    socket.emit('react', id, emoji)
}

export const id = <type extends HTMLElement = HTMLElement>(elementId: string) => document.querySelector<type>(`#${elementId}`)

/**
 * Gets a setting that the user set.
 * @param {string} category The name of the category that the setting is in
 * @param {string} setting The name of the setting
 * @returns {boolean} The value of the setting
 */
export const getSetting = (category, setting) => {
    if (!localStorage.getItem("settings")) loadSettings().then(_ => getSetting(category, setting))
    else {
        const settings = JSON.parse(localStorage.getItem("settings"))
        return settings[`${category}-settings-${setting}`]
    }
}

/**
 * Loads the settings from local storage. If they are not set, it sets them to the defaults and retries.
 */
export const loadSettings = async () => {
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

export async function doInitialMessageLoad() {
    const res = await fetch(`/archive.json?reverse=true&start=0&count=50`)

    if (!res.ok) { alert("Error loading previous messages"); return }

    const messages = await res.json()

    for (let data of messages.reverse()) {
        if (data?.tag?.text === "DELETED") continue
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
}