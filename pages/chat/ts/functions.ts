import { createPicker } from 'picmo'
import { View } from './channels';
import { Socket } from 'socket.io-client';
import { ClientToServerEvents, InitialData, ServerToClientEvents } from '../../../ts/lib/socket'; 

/**
 * Opens the emoji selector
 * @param x X position to open at
 * @param y Y position to open at
 */
export function emojiSelector(x: number, y: number): Promise<string> {

    return new Promise((resolve, reject) => {

        const rootElement = document.createElement("div")
        rootElement.className = "emoji-select"

        const picker = createPicker({ rootElement })

        picker.addEventListener("data:ready", () => {
            document.body.appendChild(rootElement)

            rootElement.style.left = `calc(${x}px - ${rootElement.offsetWidth}px)`
            rootElement.style.top = `calc(${y}px - ${rootElement.offsetHeight}px)`

            const windowClickListener = event => {
                if (!rootElement.contains(event.target as HTMLElement) && !picker.isDestroyed) {
                    window.removeEventListener("click", windowClickListener);
                    reject()
                    picker.destroy()
                }
            }

            window.addEventListener("click", windowClickListener)

            picker.addEventListener("emoji:select", data => {
                resolve(data.emoji as string)
                picker.destroy()
            })
        })

    })

}

export const id = <type extends HTMLElement = HTMLElement>(elementId: string) => document.querySelector<type>(`#${elementId}`)

/**
 * Gets a setting that the user set.
 * @param {string} category The name of the category that the setting is in
 * @param {string} setting The name of the setting
 * @returns {boolean} The value of the setting
 */
export const getSetting = (category, setting) => {
    const settings = JSON.parse(localStorage.getItem("settings"))
    return settings[`${category}-settings-${setting}`]
}

/**
 * Loads the settings from local storage. If they are not set, it sets them to the defaults and retries.
 */
export const loadSettings = async () => {
    const defaults = await (await fetch("/public/defaults.json")).json()
    if (!localStorage.getItem("settings")) {
        localStorage.setItem("settings", JSON.stringify(defaults))
        return;
        // no need to continue execution, the settings are already set to the defaults
    }

    const settings = JSON.parse(localStorage.getItem("settings"))   
    for (const name in defaults) // set all settings that are not set to the defaults
        if (settings[name] === undefined) // cant use !settings[name] because it would be true for settings set to false
            settings[name] = defaults[name]

    localStorage.setItem("settings", JSON.stringify(settings))

    for (const name in settings) { // load settings
        if (!document.getElementById(name)) continue
        id<HTMLInputElement>(name).checked = settings[name]
    }

    return true;
}

export async function doInitialMessageLoad() {
    const res = await fetch(`/archive.json?reverse=true&start=0&count=50`)

    if (!res.ok) { alert("Error loading previous messages"); return }

    const messages = await res.json()

    for (let data of messages.reverse()) {
        if (data?.tag?.text === "DELETED") continue
        data.mute = true
        id<View>("content").channel.handle(data)
        console.log(data)
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

export function getInitialData(socket: Socket<ServerToClientEvents, ClientToServerEvents>) {

    const promise = new Promise<InitialData>((resolve) => {

        socket.emit("ready for initial data", (data) => {
            resolve(data)
        })

    })

    return promise;

}