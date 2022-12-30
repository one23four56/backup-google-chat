import { MediaDataOutput } from '../../../ts/handlers/http/mediashare';
import { MediaIcon } from '../../../ts/lib/msg'
import { alert } from './popups';

export default class ImageContainer extends HTMLElement {

    constructor(url: string, icon: MediaIcon, onclick: (ev: MouseEvent) => void) {
        super();

        const image = document.createElement("img")
        image.alt = `Attached Image`
        image.className = "attached-image"

        this.className = "image-crop-container"

        this.appendChild(document.createElement("i")).className = "fa-solid fa-spinner fa-pulse temp"

        this.title = icon.title;

        // load and add image
        image.src = url;

        image.addEventListener("load", () => {
            this.querySelector(".temp")?.remove();
            this.appendChild(image);

            const i = this.appendChild(document.createElement("i"))

            i.classList.add("fa-solid", icon.name, icon.alwaysShowing ? "perm" : "hover")

            if (icon.color)
                i.style.color = icon.color;

            if (icon.outlineColor) {
                this.style.setProperty("--outline-color", icon.outlineColor)
                this.classList.add("outline")
            }

            this.classList.add(icon.alwaysShowing ? "perm-child" : "hover-child")

            this.addEventListener("click", onclick)

        }, { once: true })

    }

}

window.customElements.define("image-container", ImageContainer)

/**
 * Shows media full screen
 * @param url data url for media
 */
export async function showMediaFullScreen(url: string) {

    const res = await fetch(url);

    if (!res.ok)
        return alert(`Invalid response:\n${res.status}: ${res.statusText}`, res.statusText)

    const data: MediaDataOutput = await res.json()

    const div = document.createElement("div");
    div.className = "media-full-screen";

    const sidebar = document.createElement("div");
    sidebar.className = "sidebar";

    sidebar.appendChild(document.createElement("h1")).innerText = "File Info"

    if (data.user) {
        const img = document.createElement("img")
        img.src = data.user.img;


        sidebar.appendChild(document.createElement("span")).append(
            img,
            data.user.name,
            " uploaded at ",
            new Date(data.time).toLocaleTimeString(),
            " on ",
            new Date(data.time).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            })
        )
    }

    {
        const i = document.createElement("i")
        i.className = "fa-solid fa-circle-info"

        sidebar.appendChild(document.createElement("span")).append(
            i,
            `Size: ${data.size} Bytes`,
            document.createElement("br"),
            `Type: ${data.type}`
        )
    }

    sidebar.appendChild(document.createElement("span")).innerText =
        `This file is using ${((data.size / 1e8)*100).toFixed(2)}% of this room's storage`


    const image = document.createElement("img")
    image.src = url.replace("data", "raw")

    div.append(sidebar, image)

    document.body.appendChild(div)

    sidebar.addEventListener("click", e => e.stopPropagation())
    image.addEventListener("click", e => e.stopPropagation())

    div.addEventListener("click", () => div.remove())

}