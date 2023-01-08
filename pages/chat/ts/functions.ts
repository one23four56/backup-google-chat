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

export function getInitialData(socket: Socket<ServerToClientEvents, ClientToServerEvents>) {

    const promise = new Promise<InitialData>((resolve) => {

        socket.emit("ready for initial data", (data) => {
            resolve(data)
        })

    })

    return promise;

}