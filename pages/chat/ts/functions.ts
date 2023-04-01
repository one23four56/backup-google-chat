import { createPicker } from 'picmo'
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, InitialData, ServerToClientEvents } from '../../../ts/lib/socket';

const rootElement = document.body.appendChild(document.createElement("div"));
rootElement.className = "emoji-select";
rootElement.style.display = "none";
const picker = createPicker({ rootElement });
let opening = false;

/**
 * Opens the emoji selector
 * @param x X position to open at
 * @param y Y position to open at
 */
export function emojiSelector(x: number, y: number): Promise<string> {

    return new Promise((resolve, reject) => {

        opening = true;

        rootElement.style.display = "block";
        rootElement.style.left = Math.min((Math.max(x - rootElement.offsetWidth, 0)), window.innerWidth - rootElement.offsetWidth) + "px"
        rootElement.style.top = Math.min(Math.max(y - rootElement.offsetHeight, 0), window.innerHeight - rootElement.offsetHeight) + "px"

        const windowClickListener = event => {
            if (!rootElement.contains(event.target as HTMLElement) && opening === false) {
                window.removeEventListener("click", windowClickListener);
                reject()
                rootElement.style.display = "none";
            }
        }


        window.addEventListener("click", windowClickListener)


        picker.addEventListener("emoji:select", data => {
            resolve(data.emoji as string)
            window.removeEventListener("click", windowClickListener);
            rootElement.style.display = "none";
        })

        setTimeout(() => {
            opening = false;
        }, 1);
    })

}

export const id = <type extends HTMLElement = HTMLElement>(elementId: string) => document.querySelector<type>(`#${elementId}`)

export function getInitialData(socket: Socket<ServerToClientEvents, ClientToServerEvents>) {

    const promise = new Promise<InitialData>((resolve) => {

        socket.emit("ready for initial data", (data) => {
            resolve(data)
        })

    })

    return promise;

}