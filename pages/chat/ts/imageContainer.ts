import { MediaDataOutput } from '../../../ts/handlers/http/mediashare';
import { MessageMedia } from '../../../ts/lib/msg'
import { MediaCategory, TypeCategories } from '../../../ts/lib/socket';
import Channel from './channels';
import Share, { MediaGetError, isMediaData } from './media';
import { alert } from './popups';
import { formatRelativeTime } from './script';

export type ImageContainerOnClick = (data: {
    container: ImageContainer,
    event: MouseEvent,
    data?: MediaDataOutput,
    error?: MediaGetError | string,
    url?: string
}) => void;

export default class ImageContainer extends HTMLElement {

    private url: string;
    private icon: MessageMedia["icon"];

    constructor(media: MessageMedia, onclick: ImageContainerOnClick, share: Share) {
        super();

        const { icon } = media;
        this.icon = icon;

        const image = document.createElement("img")
        image.alt = `Attached Media`
        image.className = "attached-image"

        this.className = "image-crop-container"

        this.appendChild(document.createElement("i")).className = "fa-solid fa-spinner fa-pulse temp"

        this.title = icon.title;

        // handle links
        const isLink = !!media.clickURL;

        if (isLink) ImageContainer.getIconUrl(media).then(url => {
            image.src = url;
            this.appendChild(image);
            this.loadIcon();

            this.addEventListener("click", ev => {
                ev.stopPropagation();
                onclick({ container: this, event: ev, url });
            })
        })

        // load and add image
        if (!isLink) share.get(media).then(([blob, data]) => {

            // since the blob could be large, object urls are used instead of data urls
            // as per this (https://stackoverflow.com/a/73603744/) great stack overflow answer,
            // written by- woah wait a minute that name looks familiar

            this.url = URL.createObjectURL(blob);

            if (isMediaData(data)) {
                image.src = Share.iconUrl(data.type, this.url);

                if (TypeCategories[data.type] !== MediaCategory.image)
                    icon.text = data.name;

            } else image.src = this.url;

            // url will be revoked when container is removed
            // this allows onclick to use the url 

            this.appendChild(image);
            this.loadIcon();

            this.addEventListener("click", ev => {
                ev.stopPropagation();
                onclick({
                    container: this,
                    event: ev,
                    data: isMediaData(data) ? data : undefined,
                    //@ts-expect-error too lazy to type safe this, no importa
                    error: data && data.error ? data : undefined,
                    url: this.url
                });
            })

        }).catch((error: MediaGetError | string) => {
            this.style.backgroundColor = "var(--red)";
            this.querySelector(".temp").className = "fa-solid fa-exclamation";
            this.addEventListener("click", ev => {
                ev.stopPropagation();
                onclick({
                    container: this,
                    event: ev,
                    error
                });
            })
        })

    }

    remove(): void {
        super.remove();
        this.url && URL.revokeObjectURL(this.url);
    }

    /**
     * Gets the icon url for media w/ clickURL
     * @param media media to convert
     * @returns converted media, if applicable
     */
    static async getIconUrl(media: MessageMedia) {
        const res = await fetch(`/api/thumbnail?url=${media.clickURL}`);

        if (!res.ok)
            return "/public/link.svg";

        return res.text();
    }

    private loadIcon() {
        this.querySelector(".temp")?.remove();

        const i = this.appendChild(document.createElement("i"))

        i.classList.add("fa-solid", ...this.icon.name.split(" "), this.icon.alwaysShowing ? "perm" : "hover")

        if (this.icon.color)
            i.style.color = this.icon.color;

        if (this.icon.outlineColor) {
            this.style.setProperty("--outline-color", this.icon.outlineColor)
            this.classList.add("outline")
        }

        if (this.icon.text) {
            this.appendChild(document.createElement("p")).innerText = this.icon.text;

            if (this.icon.isLink) {
                this.classList.add("link-text")
                this.querySelector("p").appendChild(document.createElement("i")).className = "fa-solid fa-paperclip"
            }
        }

        this.classList.add(this.icon.alwaysShowing ? "perm-child" : "hover-child")
    }
}

window.customElements.define("image-container", ImageContainer)

/**
 * Shows media full screen
 * @param url data url for media
 */
export async function showMediaFullScreen(channel: Channel, data: MediaDataOutput, url: string) {

    const holder = document.createElement("div");
    holder.className = "media-holder";
    const [container, options] = getLoader(data.type)(url, holder, () => div.remove());

    holder.appendChild(container);

    const div = document.createElement("div");
    div.className = "media-full-screen";
    document.body.appendChild(div)

    const sidebar = document.createElement("div");
    sidebar.className = "sidebar";

    sidebar.appendChild(document.createElement("h1"))
        .appendChild(document.createTextNode(data.name));

    {
        const div = sidebar.appendChild(document.createElement("div"));
        div.className = "container";

        const size = div.appendChild(document.createElement("span"));
        size.title = `${data.size} Bytes`
        size.innerText = data.size >= 1e6 ?
            `${(data.size / 1e6).toPrecision(3)} MB` :
            data.size >= 1e3 ?
                `${(data.size / 1e3).toPrecision(3)} KB` :
                `${data.size} B`;

        div.appendChild(document.createElement("span")).innerText = data.type;

    }

    if (data.user) {
        const img = document.createElement("img")
        img.src = data.user.img;


        sidebar.appendChild(document.createElement("span")).append(
            img,
            data.user.name,
            " uploaded ",
            formatRelativeTime(data.time)
        )
    }

    // {
    //     const div = sidebar.appendChild(document.createElement("div"));
    //     div.className = "container";

    //     const date = new Date(data.time);

    //     // div.appendChild(document.createElement("span")).innerText = formatRelativeTime(data.time);
    //     div.appendChild(document.createElement("span")).innerText = date.toLocaleDateString();
    //     div.appendChild(document.createElement("span")).innerText = date.toLocaleTimeString();
    // }

    {
        const span = sidebar.appendChild(document.createElement("span"))
        span.className = "center"
        span.append(
            `This file is using ${((data.size / 5e8) * 100).toFixed(2)}% of the room's storage.`,
            document.createElement("br"),
            `${((data.totalSize / 5e8) * 100).toFixed(2)}% is being used in total.`
        )
    }

    if (options) for (const [text, option] of options) {
        const holder = sidebar.appendChild(document.createElement("div"));
        holder.className = "option";
        holder.appendChild(document.createElement("span")).innerText = text;
        holder.appendChild(option);
    }

    sidebar.append(document.createElement("br"))

    {
        const button = sidebar.appendChild(document.createElement("button"))
        button.appendChild(document.createElement("i")).className = "fa-solid fa-paperclip"
        button.append("Attach to Message")
        button.addEventListener("click", () => {

            if (channel.bar.media.includes(data.id))
                return alert("This file is already attached", "Can't Attach");

            channel.bar.media.push(data.id);
            channel.bar.addImagePreview(url + `#${data.id}`, data.type);
            // adding id as a hash makes it so file can be unattached
            div.remove();
            channel.bar.container.focus();

        })
    }

    {
        const button = sidebar.appendChild(document.createElement("button"))
        button.appendChild(document.createElement("i")).className = "fa-solid fa-download"
        button.append("Download")
        button.addEventListener("click", () => {
            const a = document.createElement("a")
            a.href = url;
            a.download = data.id;

            a.click();
            a.remove();
        })
    }

    {
        const button = sidebar.appendChild(document.createElement("button"))
        button.appendChild(document.createElement("i")).className = "fa-solid fa-up-right-from-square"
        button.append("Open in New Tab")
        button.addEventListener("click", () => window.open(`/media/${channel.id}/${data.id}`));
    }

    {
        const button = sidebar.appendChild(document.createElement("button"))
        button.appendChild(document.createElement("i")).className = "fa-solid fa-circle-info"
        button.append("View Advanced Info")
        button.addEventListener("click", () => alert(`Media ID: ${data.id}\n\nCompression: ${data.compression ?? "None"}\n\nHash (SHA-256): ${data.hash}\n\n`, "Advanced Information"))
    }

    {
        const button = sidebar.appendChild(document.createElement("button"))
        button.appendChild(document.createElement("i")).className = "fa-solid fa-xmark"
        button.append("Close")
        button.addEventListener("click", () => div.remove())
    }

    div.append(sidebar, holder);

    sidebar.addEventListener("click", e => e.stopPropagation());
    holder.addEventListener("click", e => e.stopPropagation());

}

type MediaLoader = (url: string, container: HTMLDivElement, close: () => void) => [HTMLElement] | [HTMLElement, [string, HTMLElement][]];

const imageLoader: MediaLoader = (url, container, close) => {
    const image = document.createElement("img");
    image.src = url;

    container.addEventListener("click", close);
    image.addEventListener("click", e => e.stopPropagation());

    const options = document.createElement("div");
    options.className = "background-options";
    options.title = "Change image background color";

    const none = options.appendChild(document.createElement("div"))
    none.innerText = "None"
    none.className = "none"

    const white = options.appendChild(document.createElement("div"))
    white.innerText = "White"
    white.className = "white"

    const black = options.appendChild(document.createElement("div"))
    black.innerText = "Black"
    black.className = "black"

    white.addEventListener("click", () => container.style.backgroundColor = "white")
    black.addEventListener("click", () => container.style.backgroundColor = "black")
    none.addEventListener("click", () => container.style.backgroundColor = "var(--main-holder-color)")

    // i love tuples
    return [image, [["Background", options]]];
}

const textLoader: MediaLoader = (url, container) => {
    const span = document.createElement("span");

    fetch(url).then(r => r.text().then(t => (span.innerText = t)));
    container.style.backgroundColor = "var(--main-bg-color)";
    container.style.opacity = "0.9"

    return [span];
}

const pdfLoader: MediaLoader = (url, container) => {
    const frame = document.createElement("iframe");
    frame.src = url;

    return [frame];
}

function getLoader(type: string): MediaLoader {
    switch (TypeCategories[type]) {
        case MediaCategory.image: return imageLoader;
        case MediaCategory.text: return textLoader;
        case MediaCategory.pdf: return pdfLoader;
        default: throw new Error(`Media type '${type}' does not have a defined loader`);
    }
}