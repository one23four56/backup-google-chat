
interface SideBarItemOptions { 
    title: string; 
    clickEvent?: () => void;
    /**
     * Called when the bar is created
     */
    initial?: (obj: HTMLElement) => void;
}

interface IconSideBarOptions extends SideBarItemOptions {
    icon: string;
}

interface EmojiSideBarOptions extends SideBarItemOptions {
    emoji: string;
}

interface ImageSideBarOptions extends SideBarItemOptions {
    image: string;
    subTitle?: string;
    icon?: string;
    emoji?: string;
    afk?: boolean;
}

export default class SideBar extends HTMLElement {

    isMain: boolean = false;
    collections: {
        [key: string]: SideBarItemCollection
    } = {};
    
    constructor() {
        super();

        this.style.display = "none;"

    }

    static timeDisplayPreset: SideBarItemOptions = {
        title: 'Loading...',
        initial(obj) {
            obj.style.textAlign = 'center';
            setInterval(() => {
                const date = String(new Date().getDate())
                const ending = !"123".includes(date.slice(-1)) ? 'th' : ['11', '12', '13'].includes(date) ? 'th' : date.slice(-1) === '1' ? 'st' : date.slice(-1) === '2' ? 'nd' : 'rd' //my brain hurts
                const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]
                const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][new Date().getMonth()]
                obj.innerText = `${new Date().toLocaleTimeString()}\n${day}, ${month} ${date}${ending}`
            }, 500);
        },
    }

    static createDefaultItem(options: SideBarItemOptions) {

        const item = new SideBarItem()

        item.className = "sidebar-item-default"

        item.innerText = options.title

        if (options.clickEvent) {
            item.addEventListener("click", options.clickEvent);
            item.style.cursor = "pointer";
        }

        if (options.initial)
            options.initial(item);

        return item;

    }

    static createIconItem(options: IconSideBarOptions) {
        const item = new SideBarItem()
        item.className = "sidebar-item-default"

        const i = document.createElement("i")
        i.className = options.icon
        
        item.appendChild(i)
        item.appendChild(document.createTextNode(options.title))

        if (options.clickEvent) {
            item.addEventListener("click", options.clickEvent);
            item.style.cursor = "pointer";
        }

        if (options.initial)
            options.initial(item);

        return item;

    }

    static createEmojiItem(options: EmojiSideBarOptions) {
        const item = new SideBarItem()
        item.className = "sidebar-item-emoji"

        const p = document.createElement("p")
        p.innerText = options.emoji

        item.appendChild(p)
        item.appendChild(document.createTextNode(options.title))

        if (options.clickEvent) {
            item.addEventListener("click", options.clickEvent);
            item.style.cursor = "pointer";
        }

        if (options.initial)
            options.initial(item);

        return item;

    }

    static createImageItem(options: ImageSideBarOptions) {
        const item = new SideBarItem();
        item.className = "sidebar-item-image online-user";

        const image = document.createElement("img")
        image.src = options.image;

        const span = document.createElement("span")
        span.innerText = options.title;

        item.append(image, span)

        if (options.icon) {
            const i = document.createElement("i")
            i.className = options.icon
            item.appendChild(i)
        }

        if (options.emoji) {
            const status = document.createElement('p')
            status.innerText = options.emoji
            item.appendChild(status)
        }

        if (options.afk)
            item.classList.add("afk")

        if (options.clickEvent) {
            item.addEventListener("click", options.clickEvent);
            item.style.cursor = "pointer";
        }

        if (options.initial)
            options.initial(item);

        return item;

    }

    makeMain() {
        SideBar.resetMain();

        this.isMain = true;
        this.style.display = 'block';
    }

    static resetMain() {
        document.querySelectorAll<SideBar>('sidebar-element').forEach(bar => {
            bar.isMain = false;
            bar.style.display = 'none';
        })
    }

    addLine() {
        this.appendChild(document.createElement("hr"))
    }

    addCollection(id: string): SideBarItemCollection {
        const collection = new SideBarItemCollection();
        
        this.appendChild(collection)

        this.collections[id] = collection

        return collection;
    }

}

export class SideBarItem extends HTMLElement {
    constructor() {
        super();
    }

    addTo(object: SideBar | SideBarItemCollection): SideBarItem {
        object.appendChild(this)
        return this;
    }
}

export class SideBarItemCollection extends HTMLElement {
    constructor() {
        super();
    }

    clear() {
        this.innerText = "";
    }
}

let mainSideBar: SideBar;

function createMainSideBar() {
    mainSideBar = new SideBar()

    SideBar.createDefaultItem(SideBar.timeDisplayPreset).addTo(mainSideBar);
    mainSideBar.addLine();
    SideBar.createIconItem({
        title: 'Update Log',
        icon: 'fas fa-pen-square fa-fw',
        clickEvent() {
            window.open(location.origin + '/updates')
        },
    }).addTo(mainSideBar);
    mainSideBar.addLine()
    mainSideBar.addCollection("rooms")

    document.body.appendChild(mainSideBar)
    mainSideBar.makeMain()

}

export function getMainSideBar(): SideBar {
    if (mainSideBar)
        return mainSideBar

    createMainSideBar();

    return mainSideBar;
}
