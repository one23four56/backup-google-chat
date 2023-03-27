import { MediaDataOutput } from '../../../ts/handlers/http/mediashare';
import { MediaIcon } from '../../../ts/lib/msg'
import { alert } from './popups';

export default class ImageContainer extends HTMLElement {

    constructor(url: string, icon: MediaIcon, onclick: (container: ImageContainer, ev: MouseEvent) => void) {
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

            i.classList.add("fa-solid", ...icon.name.split(" "), icon.alwaysShowing ? "perm" : "hover")

            if (icon.color)
                i.style.color = icon.color;

            if (icon.outlineColor) {
                this.style.setProperty("--outline-color", icon.outlineColor)
                this.classList.add("outline")
            }

            this.classList.add(icon.alwaysShowing ? "perm-child" : "hover-child")

            this.addEventListener("click", ev => {
                ev.stopPropagation();
                onclick(this, ev);
            })

        }, { once: true })

    }

}

window.customElements.define("image-container", ImageContainer)

/**
 * Shows media full screen
 * @param url data url for media
 */
export async function showMediaFullScreen(dataUrl: string, rawUrl: string) {

    const div = document.createElement("div");
    div.className = "media-full-screen";
    document.body.appendChild(div)

    const res = await fetch(dataUrl);

    if (!res.ok) {
        div.remove();
        return alert(`Invalid response:\n${res.status}: ${res.statusText}`, res.statusText);
    }
    
    const data: MediaDataOutput = await res.json()

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
            `Type: ${data.type}`,
            document.createElement("br"),
            data.name ? `Name: ${data.name}` : ''
        )
    }

    {
        const span = sidebar.appendChild(document.createElement("span"))
        span.className = "center"
        span.append(
            `This file is using ${((data.size / 1e8) * 100).toFixed(2)}% of the room's storage.`,
            document.createElement("br"),
            `${((data.totalSize / 1e8) * 100).toFixed(2)}% is being used in total.`
        )
    }

    {
        const options = sidebar.appendChild(document.createElement("div"))
        options.className = "background-options"
        options.title = "Change image background color"

        const white = options.appendChild(document.createElement("div"))
        white.innerText = "White"
        white.className = "white"

        const black = options.appendChild(document.createElement("div"))
        black.innerText = "Black"
        black.className = "black"

        const none = options.appendChild(document.createElement("div"))
        none.innerText = "None"
        none.className = "none"

        white.addEventListener("click", () => div.style.backgroundColor = "white")
        black.addEventListener("click", () => div.style.backgroundColor = "black")
        none.addEventListener("click", () => div.style.backgroundColor = "var(--main-holder-color)")
    }

    sidebar.append(document.createElement("br"))

    {
        const button = sidebar.appendChild(document.createElement("button"))
        button.appendChild(document.createElement("i")).className = "fa-solid fa-download"
        button.append("Download")
        button.addEventListener("click", () => {
            const a = document.createElement("a")
            a.href = rawUrl;
            a.download = data.name ? 
                data.name :
                `${(data.time/1000).toFixed(0)}-${data.id.substring(0,10)}`

            a.click();
            a.remove();
        })
    }

    {
        const button = sidebar.appendChild(document.createElement("button"))
        button.appendChild(document.createElement("i")).className = "fa-solid fa-up-right-from-square"
        button.append("Open in New Tab")
        button.addEventListener("click", () => window.open(rawUrl))
    }

    {
        const button = sidebar.appendChild(document.createElement("button"))
        button.appendChild(document.createElement("i")).className = "fa-solid fa-code"
        button.append("View Advanced Info")
        button.addEventListener("click", () => alert(`Media ID: ${data.id}\n\nsha256 Checksum: ${data.hash}`, "Advanced Information"))
    }

    {
        const button = sidebar.appendChild(document.createElement("button"))
        button.appendChild(document.createElement("i")).className = "fa-solid fa-xmark"
        button.append("Close")
        button.addEventListener("click", () => div.remove())
    }

    const image = document.createElement("img");
    image.src = rawUrl;

    div.append(sidebar, image)

    sidebar.addEventListener("click", e => e.stopPropagation())
    image.addEventListener("click", e => e.stopPropagation())

    div.addEventListener("click", () => div.remove())

}