import { MessageMedia } from "../../../ts/lib/msg";

export default class MediaGetter {
    
    id: string;

    constructor(id: string) {
        this.id = id;
    }

    getUrlFor(location: string, data?: boolean): string;
    getUrlFor(media: MessageMedia, data?: boolean): string;
    getUrlFor(mediaOrLocation: MessageMedia | string, data: boolean = false): string {

        if (typeof mediaOrLocation === "string")
            return `/media/${this.id}/${mediaOrLocation}/${data? 'data' : 'raw'}`

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