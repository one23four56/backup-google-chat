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
 * @param modal True to open the selector as a modal dialog in the center of the page
 */
export function emojiSelector(modal: true): Promise<string>;
/**
 * Opens the emoji selector
 * @param x X position to open at
 * @param y Y position to open at
 */
export function emojiSelector(x: number, y: number): Promise<string>;
export function emojiSelector(x: number | boolean, y?: number): Promise<string> {

    return new Promise((resolve, reject) => {

        opening = true;

        rootElement.style.display = "block";

        let dialog: HTMLDialogElement;
        if (typeof x === "number" && typeof y === "number") {
            rootElement.style.left = Math.min((Math.max(x - rootElement.offsetWidth, 0)), window.innerWidth - rootElement.offsetWidth) + "px"
            rootElement.style.top = Math.min(Math.max(y - rootElement.offsetHeight, 0), window.innerHeight - rootElement.offsetHeight) + "px"
        } else {
            rootElement.style.top = "";
            rootElement.style.left = "";
            dialog = document.body.appendChild(document.createElement("dialog"));
            dialog.appendChild(rootElement);
            dialog.showModal();
            dialog.classList.add("emoji")
        }

        const windowClickListener = event => {
            if (!rootElement.contains(event.target as HTMLElement) && opening === false) {
                window.removeEventListener("click", windowClickListener);
                reject()
                rootElement.style.display = "none";
                if (x === true) { // intentional (x could be true or a number, both of which are truthy)
                    document.body.appendChild(rootElement);
                    dialog.remove();
                }
            }
        }


        window.addEventListener("click", windowClickListener)


        picker.addEventListener("emoji:select", data => {
            resolve(data.emoji as string)
            window.removeEventListener("click", windowClickListener);
            rootElement.style.display = "none";
            if (x === true) { // intentional (x could be true or a number, both of which are truthy)
                document.body.appendChild(rootElement);
                dialog.remove();
            }
        })

        setTimeout(() => {
            opening = false;
            rootElement.querySelector(".emojiArea").scrollTop = 0;
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