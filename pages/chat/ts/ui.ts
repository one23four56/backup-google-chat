import { UserData } from "../../../ts/lib/authdata";
import { CreateRoomData } from "../../../ts/lib/misc";
import { BotData } from "../../../ts/modules/bots";
import { BasicInviteFormat } from "../../../ts/modules/invites";
import { RoomFormat } from "../../../ts/modules/rooms";
import { emojiSelector, getSetting, id } from "./functions";
import { alert, sideBarAlert } from "./popups";
import { me, socket } from "./script";


interface TopBarItem {
    name: string; 
    icon?: string; 
    selected: boolean;
    onSelect: () => void;
    canSelect?: boolean;
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

            if (item.canSelect !== false) 
                div.addEventListener("click", () => {
                    this.select(item.name);
                })
            
            if (item.canSelect === false)
                div.classList.add("no-select")

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


interface SectionFormat {
    description: string;
    name: string;
    items: ItemFormat[];
}


type Manipulator<dataType> = (value: dataType, RoomOptions: RoomFormat["options"]) => void;


type ItemFormat = {
    type: "boolean";
    question: string;
    boolean: boolean;
    manipulator: Manipulator<boolean>
} | {
    type: "select";
    question: string;
    selected: string;
    options: string[];
    manipulator: Manipulator<string>
} | {
    type: "permissionSelect";
    question: string;
    permission: "anyone" | "owner" | "poll"; 
    manipulator: Manipulator<"anyone" | "owner" | "poll">
} | {
    type: "number";
    question: string;
    number: number;
    min: number;
    max: number
    manipulator: Manipulator<number>
}


export class FormItemGenerator  {

    private disabled: boolean;
    data: RoomFormat["options"]

    constructor(options: RoomFormat["options"], disabled: boolean = false) {
        this.data = JSON.parse(JSON.stringify(options)) // deep copy
        this.disabled = disabled
    }

    resetData(options: RoomFormat["options"]) {
        this.data = JSON.parse(JSON.stringify(options)) // deep copy
    }

    static stringToName(string: string): string {
        return string
            .toLowerCase()
            .replace(/'|\?|"|:/g, '')
            .replace(/ |\//g, '-')
    }

    createInput(type: string, name: string, value: any): HTMLInputElement
    createInput(type: string, value: any): HTMLInputElement
    createInput(type: string, nameOrValue?: string, value?: any): HTMLInputElement {
        const input = document.createElement("input")

        input.type = type

        if (value) input.name = nameOrValue

        if (value) input.value = value 
        else input.value = nameOrValue

        input.disabled = this.disabled

        return input
    }

    createParagraph(text: string) {
        const p = document.createElement("p")

        p.innerText = text;

        return p;
    }
    
    generateBoolean(question: string, boolean: boolean, manipulator: Manipulator<boolean>) {
        const p = document.createElement("p")
        p.append(document.createTextNode(question), document.createElement("br"))

        p.style.width = "98%"
        p.style.marginLeft = "2%"

        for (const option of ["Yes", "No"]) {
            const
                input = this.createInput("radio", FormItemGenerator.stringToName(question), option),
                label = document.createElement("label"),
                thisBoolean = option === "Yes" ? true : false

            if (thisBoolean === boolean) {
                input.checked = true;
                input.setAttribute("checked", "")
            }

            input.addEventListener("input", () => {
                manipulator(thisBoolean, this.data)
            })

            label.append(input, document.createTextNode(option))
            p.append(label, document.createElement("br"))
        }

        return p;
    }

    generateSelect<type extends string>(question: string, value: type, options: type[], manipulator: Manipulator<type>) {
        const 
            select = document.createElement("select"),
            label = document.createElement("label"),
            p = document.createElement("p")

        select.disabled = this.disabled
        select.name = FormItemGenerator.stringToName(question)

        label.innerText = question + ": "

        for (const option of options) {

            const item = document.createElement("option")

            item.value = FormItemGenerator.stringToName(option);
            item.text = option;
            item.disabled = this.disabled;

            select.add(item)

            if (option === value) {
                item.selected = true;
                item.setAttribute("selected", "")
            }


        }

        select.addEventListener("input", () => {
            manipulator(select.value as type, this.data)
        })

        label.append(select)
        p.appendChild(label)

        return p;

    }

    generatePermissionSelect<type extends "anyone" | "owner" | "poll">(question: string, permission: type, manipulator: Manipulator<type>) {
        return this.generateSelect(
            question,
            permission,
            [
                "owner",
                "poll",
                "anyone"
            ],
            manipulator
        )

    }

    generateNumber(question: string, number: number, min: number, max: number, manipulator: Manipulator<number>) {

        const 
            p = document.createElement("p"),
            label = document.createElement("label"),
            input = this.createInput("number", number)

        input.setAttribute("value", String(number))
        input.max = String(max);
        input.min = String(min);

        label.innerText = question + ": "
        label.appendChild(input)

        input.addEventListener("input", () => {
            manipulator(Number(input.value), this.data)
        })

        p.appendChild(label)

        return p;

    }

    generateForm(sections: SectionFormat[]): HTMLFormElement {

        const form = document.createElement("form")

        form.append(
            this.createInput("submit", 'Save Changes'),
            this.createInput("reset", 'Cancel Changes')
        )

        for (const section of sections) {

            const
                fieldset = document.createElement("fieldset"),
                legend = document.createElement("legend")

            legend.innerText = section.name

            fieldset.append(legend, this.createParagraph(section.description), document.createElement("hr"))

            for (const item of section.items) {
                let element;

                switch (item.type) {

                    case "boolean":
                        element = this.generateBoolean(item.question, item.boolean, item.manipulator)
                        break;

                    case "select":
                        element = this.generateSelect(item.question, item.selected, item.options, item.manipulator)
                        break;

                    case "permissionSelect":
                        element = this.generatePermissionSelect(item.question, item.permission, item.manipulator)
                        break;

                    case "number":
                        element = this.generateNumber(item.question, item.number, item.min, item.max, item.manipulator)
                        break;
                }

                fieldset.append(element)
            }

            form.appendChild(fieldset)

        }

        form.append(
            this.createInput("submit", 'Save Changes'),
            this.createInput("reset", 'Cancel Changes')
        )

        return form;
    }
}

// definitely not copy and pasted
export function searchBots(stringTitle: string, list?: string[], listType: "exclude" | "include" = "exclude"): Promise<string> {

    return new Promise((resolve, reject) => {

        const div = document.createElement("div");
        div.classList.add("modal", "search-users");

        const closeBackground = openBackground(() => {
            div.remove();
            reject();
        })

        const search = document.createElement("input");
        search.type = "text"
        search.placeholder = "Search bots..."

        const title = document.createElement("h1")
        title.innerText = stringTitle

        const display = document.createElement("div")

        const loadNames = () => {
            display.innerText = "";

            socket.emit("query bots by name", search.value, bots => {

                console.log(bots)

                for (const [index, bot] of bots.entries()) {
                    if (index >= 20) continue;

                    if (list && listType === "exclude" && list.includes(bot.name))
                        continue;

                    if (list && listType === "include" && !list.includes(bot.name))
                        continue;

                    const holder = document.createElement("div"), image = document.createElement("img"), name = document.createElement("b")

                    holder.className = "user"

                    name.innerText = bot.name;
                    image.src = bot.image

                    holder.append(image, name)

                    holder.addEventListener("click", () => {
                        resolve(bot.name)
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

export function openBotInfoCard(botData: BotData) {
    const closeBackground = openBackground(() => {
        div.remove();
    })

    const div = document.createElement("div")
    div.classList.add("modal", "bot-info")

    const title = document.createElement("h1")
    title.innerText = botData.name

    const type = document.createElement("i")
    type.innerText = `Bot type: ${botData.type}`

    const description = document.createElement("p")
    description.innerText = botData.desc

    const list = document.createElement("ul")
    list.appendChild(document.createTextNode("Commands:"))    
    
    for (const command of botData.commands) {

        const item = document.createElement("li")
        item.innerText = `/${command.command} ${command.args.join(" ")}`

        list.append(item)

    }

    div.append(title, type, description, list)

    document.body.append(div)

}

export function loadInvites(invites: BasicInviteFormat[]) {

    if (invites.length === 0 ) {
        id("invites").style.display = "none"
        return;
    }

    id("invites").style.display = "flex"
    
    const closeAlert = sideBarAlert(`You have pending invites`)

    socket.once("invites updated", closeAlert)

    // add event listener is not used because this needs to replace old event listeners
    id("invites").onclick = () => {
        closeAlert()

        socket.off("invites updated", closeAlert)

        const closeBackground = openBackground(() => {
            div.remove();
        })

        const div = document.createElement("div")
        div.classList.add("modal", "invites")

        const title = document.createElement("h1")
        title.innerText = `Pending Invites (${invites.length})`

        div.append(title);

        for (const invite of invites) {

            const item = document.createElement("div")

            const accept = document.createElement("i"), decline = document.createElement("i")

            accept.className = "fa-solid fa-check"
            decline.className = "fa-solid fa-x"

            accept.title = "Accept Invite"
            decline.title = "Decline Invite"

            accept.addEventListener("click", () => {
                socket.emit("invite action", invite.id, "accept")
                closeBackground()
            })

            decline.addEventListener("click", () => {
                socket.emit("invite action", invite.id, "decline")
                closeBackground()
            })

            item.append(invite.message + ` (from ${invite.from.name})`, accept, decline)

            div.append(item)

        }

        document.body.appendChild(div)

    }

}

interface WhatsNewData {
    version: {
        name: string;
        number: string;
        patch: number;
    };
    highlights: string[];
    logLink: string;
    imageLink: string;
    date: string;
}

/**
 * Opens the what's new display
 */
export async function openWhatsNew() {

    const data: WhatsNewData = await (await fetch("/public/whats-new.json")).json()

    if (localStorage.getItem(`seen-${data.version.number}`) && !getSetting('misc', 'always-show-popups'))
        return;


    const div = document.createElement("div")
    div.className = "whats-new"


    const title = document.createElement("h1")
    title.innerText = `${data.version.name}${data.version.patch? ` Patch ${data.version.patch}` : ''} released!`

    const date = document.createElement("p")
    date.innerText = data.date

    const list = document.createElement("ul")

    for (const highlight of data.highlights) {

        const item = document.createElement("li")
        item.innerText = highlight

        list.append(item, document.createElement("br"))

    }

    const linkItem = document.createElement("li"), link = document.createElement("a")

    link.href = data.logLink
    link.innerText = `See full changelog`
    link.target = "_blank"

    linkItem.appendChild(link)
    list.appendChild(linkItem)

    const image = document.createElement("img")

    const holder = document.createElement("div"), mainHolder = document.createElement("div")
    mainHolder.className = "whats-new-holder"

    const button = document.createElement("button")
    button.innerText = ["Cool", "Great", "Ok", "Nice", "Yay"][Math.floor(Math.random() * 5)]



    holder.append(
        title, 
        date,
        document.createElement("hr"),
        `What's new in v${data.version.number}:`,
        list
    )

    image.addEventListener("load", () => {
        const close = openBackground(() => mainHolder.remove())

        div.append(image, holder, button)
        mainHolder.append(div)
        document.body.appendChild(mainHolder)

        button.addEventListener("click", () => {
            close()
            localStorage.setItem(`seen-${data.version.number}`, 'true')
        })
    })

    image.src = data.imageLink

}