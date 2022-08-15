import { UserData } from "../../../ts/lib/authdata";
import { CreateRoomData } from "../../../ts/lib/misc";
import { emojiSelector, id } from "./functions";
import { alert } from "./popups";
import { me, socket } from "./script";


interface TopBarItem {
    name: string; 
    icon?: string; 
    selected: boolean;
    onSelect: () => void;
}

interface FullTopBarItem extends TopBarItem {
    div: HTMLDivElement;
}

export class TopBar extends HTMLElement {

    items: FullTopBarItem[] = [];
    isMain: boolean = false;

    constructor(items: TopBarItem[]) {
        super();

        for (const item of items) {
            const div = document.createElement("div"), p = document.createElement("p")
            let icon: HTMLElement;

            p.innerText = item.name;

            if (item.selected)
                div.classList.add("selected")

            if (item.icon) {
                icon = document.createElement("i")
                icon.className = item.icon
                div.appendChild(icon)
            }

            div.appendChild(p)

            div.addEventListener("click", () => {
                this.select(item.name);
            })

            this.items.push({
                div: div, 
                name: item.name, 
                icon: item.icon, 
                selected: item.selected,
                onSelect: item.onSelect
            });

            this.appendChild(div)

        }
    }

    select(name: string) {
        const item = this.items.find(e => e.name === name);

        if (!item) {
            console.warn(`TopBar: call to select item '${name}', item '${name}' does not exist. Call canceled. `)
            return;
        }

        this.items.forEach(e => { e.selected = false, e.div.classList.remove("selected")})

        item.selected = true;
        item.div.classList.add("selected")
        item.onSelect();

    }

    makeMain() {
        TopBar.resetMain();

        this.isMain = true;
        this.style.display = 'flex';
    }

    static resetMain() {
        document.querySelectorAll<TopBar>('view-top-bar').forEach(bar => {
            bar.isMain = false;
            bar.style.display = 'none';
        })
    }
}

/**
 * @hideconstructor
 */
export class Header {
    static set(name: string, icon: string) {
        id("header-logo-image").style.display = "none"
        id("header-h1").innerText = name;
        id("header-p").innerText = icon;
        id("header-p").style.display = "block";
    }

    static reset() {
        id("header-h1").innerText = "Backup Google Chat"
        id("header-logo-image").style.display = "block"
        id("header-p").style.display = "none";
    }
}


const modalBackgroundList: Function[] = [];

id("modal-cover").addEventListener("click", () => {

    modalBackgroundList[modalBackgroundList.length - 1]()

    modalBackgroundList.pop()

    if (modalBackgroundList.length === 0)
        id("modal-cover").style.display = "none"
})

/**
 * Opens the modal background
 * @param onClose Function to call when the background is closed
 * @returns A function that closes the background when called
 */
function openBackground(onClose: Function) {
    if (modalBackgroundList.length === 0) 
        id("modal-cover").style.display = "block"

    modalBackgroundList.push(onClose)

    /**
     * Closes the background
     */
    return () => {
        id("modal-cover").click()
    }
}

export function searchUsers(stringTitle: string, list?: string[], listType: "exclude" | "include" = "exclude"): Promise<UserData> {

    return new Promise((resolve, reject) => {

        const div = document.createElement("div");
        div.classList.add("modal", "search-users");

        const closeBackground = openBackground(() => {
            div.remove();
            reject();
        })

        const search = document.createElement("input");
        search.type = "text"
        search.placeholder = "Search users..."

        const title = document.createElement("h1")
        title.innerText = stringTitle

        const display = document.createElement("div")

        const loadNames = () => {
            display.innerText = "";

            socket.emit("query users by name", search.value, users => {

                for (const [index, user] of users.entries()) {
                    if (index >= 20) continue;

                    if (list && listType === "exclude" && list.includes(user.id))
                        continue;

                    if (list && listType === "include" && !list.includes(user.id))
                        continue;

                    const holder = document.createElement("div"), image = document.createElement("img"), name = document.createElement("b")

                    holder.className = "user"

                    name.innerText = user.name;
                    image.src = user.img

                    holder.append(image, name)

                    holder.addEventListener("click", () => {
                        resolve(user)
                        closeBackground();
                    })

                    display.appendChild(holder)
                }

            })
        }

        loadNames();

        let typingTimer;
        search.addEventListener('input', _event => {
            clearTimeout(typingTimer);
            typingTimer = setTimeout(loadNames, 200)
        })



        div.append(title, search, display)



        document.body.appendChild(div)

    })

}

export function createRoom() {

    // probably could (and should) have used a form for this, it would have made it so much easier
    // in my defense i set up all the css before that occurred to me and when i tried just making
    // it a form to see if it still worked it didn't

    const closeBackground = openBackground(() => {
        div.remove();
    })

    const div = document.createElement("div")
    div.classList.add("modal", "create-room")

    const title = document.createElement("h1")
    title.innerText = "Create New Room"


    const emoji = document.createElement("span")
    emoji.classList.add("emoji-picker-opener")
    emoji.innerText = "+"

    emoji.addEventListener("click", event => {
        emojiSelector(event.clientX, event.clientY).then(e => {
            emoji.innerText = e;
        }).catch()
    })

    const name = document.createElement("input")
    name.maxLength = 30
    name.placeholder = "Room Name"
    name.classList.add("name-input")

    const desc = document.createElement("input")
    desc.maxLength = 100
    desc.placeholder = "Room Description"
    desc.classList.add("desc-input")

    let members: UserData[] = [me];

    const membersDisp = document.createElement("p")
    membersDisp.classList.add("members")

    membersDisp.innerText = "Members: " + members.map(e => e.name).join(", ")

    const add = document.createElement("button")
    add.classList.add("add")
    add.innerText = "Add Member"

    add.addEventListener("click", async () => {
        const user = await searchUsers("Add Member", members.map(e => e.id), "exclude")
        members.push(user)
        membersDisp.innerText = "Members: " + members.map(e => e.name).join(", ")
    })

    

    const remove = document.createElement("button")
    remove.classList.add("remove")
    remove.innerText = "Remove Member"

    remove.addEventListener("click", async () => {
        const user = await searchUsers("Remove Member", members.map(e => e.id).filter(e => e !== me.id), "include")
        members = members.filter(e => e.id !== user.id)
        membersDisp.innerText = "Members: " + members.map(e => e.name).join(", ")
    })
    
    const text = document.createElement("p")
    text.classList.add("text")
    text.innerText = `You can edit the room options once the room is created.`


    const create = document.createElement("button")
    create.classList.add("create")
    create.innerText = "Create Room"

    const cancel = document.createElement("button")
    cancel.innerText = "Cancel"
    cancel.classList.add("cancel")

    create.addEventListener("click", () => {

        // get inputs

        const data: CreateRoomData = {
            emoji: emoji.innerText === "+" ? undefined : emoji.innerText,
            name: name.value,
            description: desc.value,
            rawMembers: members
        }

        // validate
        // yeah i know, i should have used a form
        // if only i had thought of that before i wrote all this and did all the css

        for (const name in data) {
            if (typeof data[name] === "undefined" || data[name] === "" || data[name] === []) {
                alert(`The ${name} field is blank`, `Missing ${name[0].toUpperCase() + name.slice(1, name.length)}`);
                return;
            }
        }

        socket.emit("create room", data)

        closeBackground()
    })

    cancel.addEventListener("click", closeBackground)

    div.append(title, emoji, name, desc, membersDisp, add, remove, text, create, cancel)

    document.body.appendChild(div)

}