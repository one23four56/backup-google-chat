import { OnlineStatus, OnlineUserData } from "../../../ts/lib/authdata";
import { ServerToClientEvents } from "../../../ts/lib/socket";
import DM, { dmReference } from "./dms";
import { confirm } from "./popups";
import { setRepeatedUpdate } from "./schedule";
import { me, socket } from "./script";
import { createRoom, openStatusSetter } from "./ui";

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
    collapsableElement?: HTMLElement;
    plusIconEvent?: () => void;
}

interface EmojiSideBarOptions extends SideBarItemOptions {
    emoji: string;
}

interface ImageSideBarOptions extends SideBarItemOptions {
    image: string;
    subTitle?: HTMLElement;
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
            obj.style.justifyContent = 'center';
            obj.style.textAlign = 'center'

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

        if (options.collapsableElement)
            item.appendChild(options.collapsableElement)

        let plus;
        if (options.plusIconEvent) {
            plus = document.createElement("i")
            plus.className = "fa-solid fa-plus"
            plus.style.marginLeft = "auto";

            plus.addEventListener("click", options.plusIconEvent)

            item.appendChild(plus)
        }

        if (options.clickEvent) {
            item.addEventListener("click", event => {
                if (event.target === plus) return;
                options.clickEvent()
            });

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

        if (options.subTitle)
            span.append(
                document.createElement("br"),
                options.subTitle
            );

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
        this.dataset.main = "true";
        this.style.display = 'block';
    }

    static resetMain() {
        document.querySelectorAll<SideBar>('sidebar-element').forEach(bar => {
            bar.isMain = false;
            bar.dataset.main = "false"
            bar.style.display = 'none';
        })
    }

    addLine() {
        this.appendChild(document.createElement("hr"))
    }

    addCollection(id: string, title: IconSideBarOptions): SideBarItemCollection {

        const caret = document.createElement("i")
        caret.className = "fa-solid fa-caret-down fa-fw"

        title.collapsableElement = caret

        title.clickEvent = () => {
            if (collection.style.display !== "none") {
                // hide

                collection.style.display = "none"
                caret.className = "fa-solid fa-caret-right fa-fw"

            } else {
                // show

                collection.style.display = "inline"
                caret.className = "fa-solid fa-caret-down fa-fw"

            }
        }

        const item = SideBar.createIconItem(title).addTo(this)

        const collection = new SideBarItemCollection(item);

        this.appendChild(collection)

        this.collections[id] = collection

        return collection;
    }

    static get isMobile(): boolean {
        return window.matchMedia("(pointer:none), (pointer:coarse)").matches
    }

    collapseIfMobile() {
        SideBar.isMobile && this.collapse();
    }

    /**
     * Collapses this sidebar, or expands it if it is already collapsed
     */
    toggleCollapse() {
        document.body.classList.toggle("hide-sidebar")
    }

    /**
     * Collapses this sidebar
     */
    collapse() {
        document.body.classList.add("hide-sidebar")
    }

    /**
     * Expands this sidebar
     */
    expand() {
        document.body.classList.remove("hide-sidebar")
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

    titleElement: SideBarItem;

    constructor(title: SideBarItem) {
        super();

        this.titleElement = title;
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
        title: 'Update Logs',
        icon: 'fas fa-pen-square fa-fw',
        clickEvent() {
            window.open(location.origin + '/updates')
        },
    }).addTo(mainSideBar);

    mainSideBar.addLine()

    mainSideBar.addCollection("dms", {
        icon: 'fa-regular fa-comment',
        title: 'Chats',
        plusIconEvent: DM.startDM
    })

    mainSideBar.addLine()

    mainSideBar.addCollection("rooms", {
        icon: 'fa-regular fa-comments',
        title: 'Rooms',
        plusIconEvent: createRoom
    })

    document.body.appendChild(mainSideBar)

    mainSideBar.makeMain()

}

export function getMainSideBar(): SideBar {
    if (mainSideBar)
        return mainSideBar

    createMainSideBar();

    return mainSideBar;
}

export let sideBarItemUnreadList: string[] = []

export function removeFromUnreadList(id: string) {
    sideBarItemUnreadList = sideBarItemUnreadList.filter(i => i !== id)
}

export function getUserSideBarItem(userData: OnlineUserData) {

    const icon: string = userData.id === me.id ?
        `fa-regular fa-face-smile` : dmReference[userData.id] ?
            `fa-regular fa-comment` : `fa-solid fa-user-plus`



    const schedule: { span: HTMLSpanElement, stop?: () => void } = {
        span: (() => {
            const holder = document.createElement("span")
            holder.innerText = userData.online

            return holder;
        })()
    };

    if (userData.schedule) {
        const span = document.createElement("span")
        schedule.span.appendChild(span)

        schedule.stop = setRepeatedUpdate(userData.schedule, span)
    }

    const item = SideBar.createImageItem({
        image: userData.img,
        title: userData.name,
        emoji: userData.status ? userData.status.char : undefined,
        subTitle: schedule.span,
        icon,
        clickEvent: () => {
            if (dmReference[userData.id]) {
                dmReference[userData.id].makeMain()
                getMainSideBar().collapseIfMobile();
            }
            else if (userData.id !== me.id)
                confirm(`You do not have a direct message conversation with ${userData.name}. Would you like to start one?`, `Start Direct Message Conversation?`).then(res => {
                    if (res)
                        socket.emit("start dm", userData.id)
                })
            else
                openStatusSetter()

        }
    })

    if (userData.status)
        item.title = userData.status.status

    if (sideBarItemUnreadList.includes(userData.id))
        item.classList.add("unread")

    switch (userData.online) {
        case OnlineStatus.online:
            item.classList.add("online");
            break;
        case OnlineStatus.offline:
            item.classList.add("offline");
            break;
        case OnlineStatus.idle:
            item.classList.add("idle");
            break;
        case OnlineStatus.active:
            item.classList.add("active");
            break;
        default:
            item.classList.add("offline");
    }

    item.dataset.userId = userData.id

    const handleUpdate: ServerToClientEvents["userData updated"] = (newUserData) => {

        if (newUserData.id !== userData.id) {
            socket.once("userData updated", handleUpdate)
            return;
        }

        schedule.stop && schedule.stop()

        item.replaceWith(getUserSideBarItem(newUserData))

    }

    const handleState: ServerToClientEvents["online state change"] = (id, state) => {

        if (id !== userData.id)
            return socket.once("online state change", handleState)

        if (schedule)
            schedule.stop()

        item.replaceWith(getUserSideBarItem({
            ...userData,
            online: state
        }))

    }

    socket.once("userData updated", handleUpdate)
    socket.once("online state change", handleState)

    return item

}