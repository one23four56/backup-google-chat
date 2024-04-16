import { StartUploadResponse } from "../../../ts/handlers/http/mediashare";
import { MessageMedia } from "../../../ts/lib/msg";
import { AllowedTypes } from "../../../ts/lib/socket";
import { alert, sideBarAlert } from "./popups";

export default class MediaGetter {

    id: string;

    constructor(id: string) {
        this.id = id;
    }

    getUrlFor(location: string, data?: boolean): string;
    getUrlFor(media: MessageMedia, data?: boolean): string;
    getUrlFor(mediaOrLocation: MessageMedia | string, data: boolean = false): string {

        if (typeof mediaOrLocation === "string")
            return `/media/${this.id}/${mediaOrLocation}/${data ? 'data' : 'raw'}`

        const media = mediaOrLocation;

        if (media.type === "link")
            return media.location;

        return `/media/${this.id}/${media.location}/${data ? 'data' : 'raw'}`

    }

    async getMediaBlob(media: MessageMedia): Promise<Blob> {

        const url = this.getUrlFor(media)

        return await (await fetch(url)).blob()

    }
}

/**
 * Uploads a file to Mediashare
 * @param shareId Share to upload file to
 * @param file File to upload
 * @returns File ID, or void if upload failed
 */
export async function uploadFile(shareId: string, file: File): Promise<string> {
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

    const preparing = sideBarAlert(`Preparing upload...`, undefined, `../public/mediashare.png`);

    // get hash and convert to hex string
    // https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
    // https://stackoverflow.com/a/40031979/
    const hash = [...new Uint8Array(
        await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
    )].map(x => x.toString(16).padStart(2, '0')).join("");

    const response = await fetch(`/media/${shareId}/upload`, {
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

    const close = sideBarAlert(`Uploading ${file.name} (${(file.size / 1e6).toFixed(2)} MB)...`, undefined, `../public/mediashare.png`)

    fetch(`/media/upload/${data.key}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/octet-stream"
        },
        body: await file.arrayBuffer()
    }).then(async res => {
        close();

        if (!res.ok) return alert(`${await res.text()}\n(${res.status} ${res.statusText})`, "Upload Failed");

        sideBarAlert(`Upload completed (${(file.size / 1e6).toFixed(2)} MB)`, 4000, `../public/mediashare.png`)

    }).catch(err => {
        close();
        alert(err, "Upload Error")
    })

    return data.id;
}