import { MediaDataOutput, StartUploadResponse } from "../../../ts/handlers/http/mediashare";
import { MessageMedia } from "../../../ts/lib/msg";
import { AllowedTypes, MediaCategory, TypeCategories } from "../../../ts/lib/socket";
import ImageContainer, { ImageContainerOnClick } from "./imageContainer";
import { alert, sideBarAlert } from "./popups";
import ReactiveContainer from "./reactive";

export default class Share {

    id: string;

    constructor(id: string) {
        this.id = id;
    }

    /**
     * Gets the url of media
     * @param media Message media object or media id string
     * @returns Media URL
     */
    url(media: MessageMedia | string): string {

        if (typeof media === "string")
            return `/media/${this.id}/${media}`

        if (media.type === "link")
            return media.location;

        return `/media/${this.id}/${media.location}`

    }

    private async mediaGetter(url: string, time: number = 0): Promise<Response> {
        // exponential backoff
        await new Promise(r => setTimeout(r, 1000 * 2 ** time - 1000))
        // since time increases by 0.5 after each miss, the equation is:
        // f(x) = 1000 * 2^(x/2) - 1000
        // where x is the number of tries and f(x) is wait time (milliseconds)

        const response = await fetch(url);

        // server will respond with 425 if the media is still being uploaded
        if (response.status === 425)
            return this.mediaGetter(url, time + 0.5);

        // all other statuses can be ignored, they are the responsibility of the main worker

        return response;
    }

    // private externalGetter(url: string) {
    //     return fetch(url);
    // }

    /**
     * 
     * @param media Message media object
     * @returns 
     */
    async get(media: MessageMedia): MediaGet {

        const external = media.type === "link";

        const response = external ?
            await fetch(this.url(media)) :
            await this.mediaGetter(this.url(media));

        if (external && !response.ok)
            throw {
                error: true,
                status: response.status,
                statusText: response.statusText,
                responseText: await response.text()
            } as MediaGetError

        if (!response.ok && response.status !== 404)
            throw {
                error: true,
                status: response.status,
                statusText: response.statusText,
                responseText: await response.text()
            } as MediaGetError

        if (response.status === 404) // for 404 ms sends an image
            return [
                await response.blob(),
                {
                    error: true,
                    status: response.status,
                    statusText: response.statusText
                }
            ]

        // past here, response is OK

        if (external) return [await response.blob()];

        let data = response.headers.get("x-media-data");

        if (!data) return [await response.blob()];

        // convert base64url to base64
        data = data.replaceAll("-", "+").replaceAll("_", "/"); // substitutions
        data = data + new Array((4 - data.length % 4) % 4).fill("=").join(""); // padding

        // convert data to string, parse json, and return w/ blob
        return [await response.blob(), JSON.parse(atob(data)) as MediaDataOutput];

    }

    /**
     * Uploads a file to the share
     * @param shareId Share to upload file to
     * @param file File to upload
     * @returns File ID, or void if upload failed
     */
    async upload(file: File): Promise<string> {
        const max = 2e7; // requests above 20mb are automatically refused

        if (!AllowedTypes.includes(file.type)) {
            alert(`File type '${file.type}' is not supported.`, `File not Allowed`)
            throw "File type not supported"
        }

        if (file.size > max) {
            alert(`'${file.name}' is ${(file.size / 1e6).toFixed(2)} MB, which is ${((file.size - max) / 1e6).toFixed(2)} MB over the maximum size of ${max / 1e6} MB.`, `File too Large`)
            throw "File too large";
        }

        // upload file

        const preparing = sideBarAlert({
            message: `Preparing upload...`,
            icon: `../public/mediashare.png`
        });

        // get hash and convert to hex string
        // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
        // https://stackoverflow.com/a/40031979/
        const hash = [...new Uint8Array(
            await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
        )].map(x => x.toString(16).padStart(2, '0')).join("");

        const response = await fetch(`/media/${this.id}/upload`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                hash,
                type: file.type,
                size: file.size,
                name: file.name,
            })
        }).catch(err => {
            preparing();
            alert(err, "Upload Error");
        });

        if (!response) return;

        preparing(); // close popup

        if (!response.ok) {
            alert(`${await response.text()}\n(${response.status} ${response.statusText})`, `Can't Upload File`);
            throw `${response.status}: ${response.statusText}`;
        }

        const data: StartUploadResponse = await response.json();

        if (!data.key)
            return data.id; // file is a duplicate

        const progress = new ReactiveContainer(0);
        const message = new ReactiveContainer(`Uploading ${file.name} (${(file.size / 1e6).toFixed(2)} MB)...`)

        const close = sideBarAlert({
            icon: `../public/mediashare.png`,
            progressBarColor: "ff9933",
            progress, message
        })

        const request = new XMLHttpRequest();

        request.addEventListener("load", () => {

            if (request.status !== 201) {
                message.data = `Upload failed (${request.status})`
                return alert(`${request.responseText}\n(${request.status} ${request.statusText})`, "Upload Failed");
            }

            message.data = `Upload completed (${(file.size / 1e6).toFixed(2)} MB)`;

        });

        request.addEventListener("error", () => {
            message.data = "Upload error"
        })

        request.addEventListener("loadend", () => {
            progress.data = 1;
            setTimeout(close, 3000);
        });

        request.upload.addEventListener("progress", event => {
            progress.data = event.loaded / event.total;
        });

        request.open("PUT", `/media/upload/${data.key}`);
        request.setRequestHeader("Content-Type", "application/octet-stream");
        request.send(await file.arrayBuffer());

        return data.id;
    }

    /**
     * Creates an image container
     * @param media Message media to use
     * @param onclick Event when the container is clicked
     * @returns A new image container
     */
    imageContainer(media: MessageMedia, onclick: ImageContainerOnClick): ImageContainer {
        return new ImageContainer(
            media, onclick, this
        )
    }
}

export interface MediaGetError {
    error: true;
    status: number;
    statusText: string;
    responseText?: string;
}

type MediaGet = Promise<[Blob, MediaGetError] | [Blob] | [Blob, MediaDataOutput]>;

export function isMediaData(object: unknown): object is MediaDataOutput {
    //@ts-expect-error
    return (typeof object === "object" && !object.error)
}