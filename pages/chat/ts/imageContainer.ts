import { MediaIcon } from '../../../ts/lib/msg'

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

            this.appendChild(document.createElement("i")).classList.add(
                "fa-solid", icon.name, icon.alwaysShowing ? "perm" : "hover"
            )

            this.classList.add(icon.alwaysShowing ? "perm-child" : "hover-child")

            this.addEventListener("click", onclick)

        }, { once: true })

    }

}

window.customElements.define("image-container", ImageContainer)