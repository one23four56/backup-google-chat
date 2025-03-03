import { Status, UserData } from "../../../ts/lib/authdata";
import { CreateRoomData } from "../../../ts/lib/misc";
import { KickNotification, UpdateNotification } from "../../../ts/lib/notifications";
import { BotData } from "../../../ts/modules/bots";
import { BasicInviteFormat } from "../../../ts/modules/invites";
import { RoomFormat } from "../../../ts/modules/rooms";
import { emojiSelector } from "./emoji";
import { notifications } from "./home";
import { alert, confirm, prompt } from "./popups";
import { closeDialog, escape, me, shortenText, socket } from "./script";
import { BooleanFormat, ItemFormat, NumberFormat, PermissionFormat, SectionFormat, SelectFormat } from '../../../ts/lib/options';
import settings from "./settings";
import { id } from './script';
import UpdateData from '../../../ts/update.json';
import { MediaCategory, TypeCategories } from "../../../ts/lib/socket";

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

    constructor(items: TopBarItem[]) {
        super();

        for (const item of items) {
            this.addItem(item)
        }
    }

    select(name: string) {
        const item = this.items.find(e => e.name === name);

        if (!item && name !== '') {
            console.warn(`TopBar: call to select item '${name}', item '${name}' does not exist. Call canceled. `)
            return;
        } else if (!item && name === '') {
            this.items.forEach(e => { e.selected = false, e.div.classList.remove("selected") })
            return;
        }

        this.items.forEach(e => { e.selected = false, e.div.classList.remove("selected") })

        item.selected = true;
        item.div.classList.add("selected")
        item.onSelect();

    }

    addItem(item: TopBarItem) {
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

    removeItem(name: string) {

        const item = this.items.find(i => i.name === name)

        if (!item)
            return;

        item.div.remove();
        this.items = this.items.filter(i => i.name !== name)

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

interface SearchOptions<type, multi extends boolean = boolean> {
    title: string,
    includeList?: string[],
    excludeList?: string[],
    selected?: type[],
    multiSelect?: multi,
    selectIcon?: string,
    noResults?: {
        icon: string,
        text: string,
        action: (close: () => void) => void,
    }[],
}

interface SearchItem {
    image: string;
    id: string;
    name: string;
    subImage?: string;
    subName?: string;
    description?: string;
    icon?: string;
    roomCount?: number;
}

// yeah good luck with this one
// this is what sleep deprivation will do to you

function search<type>(
    queryFunction: (string: string) => Promise<type[]>,
    transformer: (item: type) => SearchItem,
    options: SearchOptions<type, false>
): Promise<type>;
function search<type>(
    queryFunction: (string: string) => Promise<type[]>,
    transformer: (item: type) => SearchItem,
    options: SearchOptions<type, true>
): Promise<type[]>;
function search<type>(
    queryFunction: (string: string) => Promise<type[]>,
    transformer: (item: type) => SearchItem,
    options: SearchOptions<type, boolean>
): Promise<type | type[]>;
function search<type>(
    queryFunction: (string: string) => Promise<type[]>,
    transformer: (item: type) => SearchItem,
    { title, includeList, excludeList, multiSelect, selectIcon, selected, noResults }: SearchOptions<type>
): Promise<type | type[]> {
    return new Promise<type | type[]>((res, rej) => {

        const div = document.createElement("dialog");
        div.classList.add("search");

        const search = document.createElement("input");
        search.type = "text";
        search.placeholder = "Search...";

        const header = document.createElement("h1")
        header.innerText = title;

        const display = document.createElement("div");
        display.classList.add("display");

        const buttons = document.createElement("div");
        buttons.classList.add("buttons");

        const cancel = buttons.appendChild(document.createElement("button"));
        cancel.appendChild(document.createElement("i")).className = "fa-solid fa-xmark fa-fw";
        cancel.append("Cancel");
        cancel.addEventListener("click", () => {
            closeDialog(div);
            rej();
        });

        let list: [string, type][] = multiSelect && selected ? selected.map(t => [transformer(t).id, t]) : [];

        if (multiSelect) {
            cancel.classList.add("red");
            const next = document.createElement("button");
            buttons.prepend(next);
            next.appendChild(document.createElement("i")).className = "fa-solid fa-check fa-fw";
            next.append("Done");
            next.classList.add("green");
            next.addEventListener("click", () => {
                closeDialog(div);
                res(list.map(i => i[1]));
            });
        }

        async function query(string: string) {
            display.innerText = "";

            const results = await queryFunction(string);

            function updateSelectionStyle(selected: boolean, element: HTMLElement) {
                if (!selected) {
                    element.classList.remove("selected")
                    element.querySelector(`i.${selectIcon}`)?.remove();
                    return;
                }

                element.classList.add("selected")

                const i = document.createElement("i");
                i.className = `fa-solid ${selectIcon}`;
                element.prepend(i);
            }

            let count = 0;

            for (const item of results) {
                const result = transformer(item);

                if (includeList && !includeList.includes(result.id)) continue;
                if (excludeList && excludeList.includes(result.id)) continue;
                if (count >= 20) break;

                count += 1;

                const holder = document.createElement("div"),
                    image = document.createElement("img"),
                    name = document.createElement("b");

                name.innerText = result.name;
                image.src = result.image;

                if (result.icon)
                    name.appendChild(document.createElement("i")).className = result.icon;

                if (result.subName) {
                    name.appendChild(document.createElement("span")).innerText =
                        result.subName;
                }

                holder.append(image, name);

                if (result.description) {
                    holder.appendChild(document.createElement("p")).appendChild(
                        document.createTextNode(shortenText(result.description, 50))
                    );
                }

                if (typeof result.roomCount === "number") {
                    const count = holder.appendChild(document.createElement("p"));
                    count.className = "count";
                    count.innerText = result.roomCount.toString();
                    count.appendChild(document.createElement("i")).className = "fa-solid fa-users"
                }

                display.appendChild(holder);

                multiSelect && updateSelectionStyle(list.map(i => i[0]).includes(result.id), holder);

                holder.addEventListener("click", multiSelect ? () => {
                    if (list.map(i => i[0]).includes(result.id)) {
                        list = list.filter(i => i[0] !== result.id);
                        updateSelectionStyle(false, holder);
                    } else {
                        list.push([result.id, item]);
                        updateSelectionStyle(true, holder);
                    }
                } : () => {
                    closeDialog(div);
                    res(item);
                })
            }

            if (count !== 0) return;

            const holder = display.appendChild(document.createElement("div"));
            holder.className = "no-results";
            holder.appendChild(document.createElement("h1")).innerText = "No Results";

            if (noResults) for (const item of noResults) {
                const button = holder.appendChild(document.createElement("button"));
                button.className = "action";
                button.appendChild(document.createElement("i")).className = item.icon;
                button.appendChild(document.createTextNode(item.text));
                button.addEventListener("click", () => item.action(() => {
                    closeDialog(div);
                    rej();
                }));
            }
        }

        query("");

        let typingTimer;
        search.addEventListener('input', _event => {
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => query(search.value), 200)
        })

        div.append(header, search, display, buttons)

        document.body.appendChild(div);
        div.showModal();
    });
}

// searchUsers and searchBots are easier-to-use wrappers around the search function

export function searchUsers(options: SearchOptions<UserData, false>): Promise<UserData>;
export function searchUsers(options: SearchOptions<UserData, true>): Promise<UserData[]>;
export function searchUsers(options: SearchOptions<UserData>): Promise<UserData | UserData[]> {
    return search<UserData>(
        string => new Promise(res => {
            socket.emit("query users by name", string, !!options.includeList, r => res(r))
        }),
        userData => ({
            id: userData.id,
            image: userData.img,
            name: userData.name
        }),
        options
    )
}

// definitely not copy and pasted
export function searchBots(options: SearchOptions<BotData, false>): Promise<BotData>;
export function searchBots(options: SearchOptions<BotData, true>): Promise<BotData[]>;
export function searchBots(options: SearchOptions<BotData>): Promise<BotData | BotData[]> {
    return search(
        string => new Promise(res => socket.emit("query bots by name", string, bots => res(bots))),
        item => ({
            name: item.name,
            id: item.id,
            image: item.image,
            subImage: item.by.image,
            subName: `by ${item.by.name}`,
            description: item.description,
            icon: item.check ? "fa-solid fa-check" : item.beta ? "fa-solid fa-screwdriver-wrench" : "",
            roomCount: item.roomCount
        }),
        options
    )
}

export function createRoom() {

    // probably could (and should) have used a form for this, it would have made it so much easier
    // in my defense i set up all the css before that occurred to me and when i tried just making
    // it a form to see if it still worked it didn't

    const div = document.body.appendChild(document.createElement("dialog"));
    div.classList.add("create-room");

    const title = div.appendChild(document.createElement("h1"));
    title.innerText = "Create New Room"

    const nameHolder = div.appendChild(document.createElement("div"));
    nameHolder.className = "name"

    const emoji = nameHolder.appendChild(document.createElement("span"));
    emoji.classList.add("emoji-picker-opener")
    emoji.innerText = "+"

    emoji.addEventListener("click", () => {
        div.close();
        emojiSelector(true).then(e => {
            div.showModal();
            emoji.innerText = e;
        }).catch(() => div.showModal())
    })

    const name = nameHolder.appendChild(document.createElement("input"));
    name.maxLength = 30
    name.placeholder = "Room Name"
    name.classList.add("name-input")

    const desc = nameHolder.appendChild(document.createElement("input"));
    desc.maxLength = 250
    desc.placeholder = "Room Description"
    desc.classList.add("desc-input");

    const inviteHolder = div.appendChild(document.createElement("div"));
    inviteHolder.className = "invite"

    let members: UserData[] = [me];

    const membersDisp = inviteHolder.appendChild(document.createElement("p"));
    membersDisp.classList.add("members")

    membersDisp.innerText = "0 people will be invited."

    const memberIcons = inviteHolder.appendChild(document.createElement("div"));
    memberIcons.className = "member-icons";

    const add = inviteHolder.appendChild(document.createElement("button"));
    add.classList.add("add")
    add.appendChild(document.createElement("i")).className = "fa-solid fa-envelope fa-fw"
    add.append("Invite People");

    add.addEventListener("click", async () => {
        const users = await searchUsers({
            title: "Invite People",
            excludeList: [me.id],
            multiSelect: true,
            selectIcon: "fa-envelope",
            selected: members.filter(m => m.id !== me.id)
        })
        members = [me, ...users];
        membersDisp.innerText = `${members.length - 1} ${members.length - 1 === 1 ? "person" : "people"} will be invited.`;
        memberIcons.innerText = "";
        for (const member of members.slice(0, 11)) {
            if (member.id === me.id) continue;
            memberIcons.appendChild(document.createElement("img")).src = member.img;
        }
    })

    const botsHolder = div.appendChild(document.createElement("div"));
    botsHolder.className = "invite"

    let bots: BotData[] = [];

    const botsDisp = botsHolder.appendChild(document.createElement("p"));
    botsDisp.classList.add("members")

    botsDisp.innerText = "0 bots will be added."

    const botIcons = botsHolder.appendChild(document.createElement("div"));
    botIcons.className = "member-icons";

    const addBots = botsHolder.appendChild(document.createElement("button"));
    addBots.classList.add("add")
    addBots.appendChild(document.createElement("i")).className = "fa-solid fa-plus fa-fw"
    addBots.append("Add Bots");

    addBots.addEventListener("click", async () => {
        const list = await searchBots({
            title: "Add Bots",
            multiSelect: true,
            selectIcon: "fa-plus",
            selected: bots
        })
        bots = list;
        botsDisp.innerText = `${bots.length} bot${bots.length === 1 ? "" : "s"} will be added.`;
        botIcons.innerText = "";
        for (const bot of bots.slice(0, 11))
            botIcons.appendChild(document.createElement("img")).src = bot.image;
    })

    const buttons = div.appendChild(document.createElement("div"));
    buttons.classList.add("buttons");

    const create = buttons.appendChild(document.createElement("button"));
    create.classList.add("create")
    create.innerHTML = `<i class="fa-solid fa-plus fa-fw"></i>Create Room`

    const cancel = buttons.appendChild(document.createElement("button"));
    cancel.innerHTML = `<i class="fa-solid fa-xmark fa-fw"></i>Cancel`
    cancel.classList.add("cancel")

    create.addEventListener("click", () => {

        // get inputs

        const data: CreateRoomData = {
            emoji: emoji.innerText === "+" ? undefined : emoji.innerText,
            name: name.value,
            description: desc.value,
            members: members.map(m => m.id),
            bots: bots.map(b => b.id)
        }

        // validate
        // yeah i know, i should have used a form
        // if only i had thought of that before i wrote all this and did all the css

        for (const name in data) {
            if (typeof data[name] === "undefined" || data[name] === "") {
                alert(`The ${name} field is blank`, `Missing ${name[0].toUpperCase() + name.slice(1, name.length)}`);
                return;
            }
        }

        socket.emit("create room", data)

        closeDialog(div);
    })

    cancel.addEventListener("click", () => closeDialog(div));

    div.showModal();

}

export class FormItemGenerator {

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
        const p = document.createElement("p");

        p.innerHTML = escape(text)
            .replace(/\n/g, "<br>")
            .replace(/\[/g, `<i class="fa-solid `)
            .replace(/\]/g, ` fa-fw"></i>`);

        return p;
    }

    generateBoolean({ question, boolean, manipulator, description, children, disabled }: BooleanFormat) {
        const
            p = document.createElement("p"),
            label = document.createElement("label"),
            input = document.createElement("input")

        input.type = "checkbox"
        label.classList.add("checkbox")

        label.append(
            input,
            document.createTextNode(question), // just to be safe
        )

        description && label.appendChild(this.createParagraph(description));

        p.append(
            label
        )

        const childElements: HTMLParagraphElement[] = [];

        children && children.forEach(
            child => childElements.push(p.appendChild(this.generateItem(child)))
        );

        childElements.forEach(e => e.classList.add("sub"));
        boolean || childElements.forEach(e => e.style.display = "none");

        input.checked = boolean;
        boolean && label.classList.add("checked")

        if (boolean)
            input.setAttribute("checked", "")

        if (disabled)
            input.disabled = true
        else
            input.disabled = this.disabled;

        input.addEventListener("input", _event => {
            manipulator(input.checked, this.data)
            childElements.forEach(e => e.style.display = input.checked ? "block" : "none")
            if (input.checked)
                label.classList.add("checked")
            else label.classList.remove("checked")
        })

        return p;
    }

    generateSelect<type extends string>({ question, manipulator, options, selected: value, description }: SelectFormat) {
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
        description && label.appendChild(this.createParagraph(description));
        p.appendChild(label)

        return p;

    }

    generatePermissionSelect({ manipulator, permission, question, description }: PermissionFormat) {
        return this.generateSelect({
            type: "select",
            question,
            selected: permission,
            options: [
                "owner",
                "poll",
                "anyone"
            ],
            manipulator,
            description
        })

    }

    generateNumber({ number, min, max, manipulator, question, description }: NumberFormat) {

        const
            p = document.createElement("p"),
            label = document.createElement("label"),
            input = this.createInput("number", number)

        input.setAttribute("value", String(number))
        input.max = String(max);
        input.min = String(min);

        label.innerText = question + ": "
        label.appendChild(input)

        description && label.appendChild(this.createParagraph(description));

        input.addEventListener("input", () => {
            manipulator(Number(input.value), this.data)
        })

        p.appendChild(label)

        return p;

    }

    generateForm(sections: SectionFormat[]): HTMLFormElement {

        const form = document.createElement("form")

        const addSaveButtons = () => {
            const holder = form.appendChild(document.createElement("div"))
            holder.className = "save-cancel-holder"
            holder.append(
                this.createInput("submit", 'Save Changes'),
                this.createInput("reset", 'Cancel Changes')
            )
        }

        addSaveButtons();

        for (const section of sections) {

            const
                fieldset = document.createElement("fieldset"),
                legend = document.createElement("legend")

            legend.innerText = section.name

            fieldset.style.setProperty("--accent-color", section.color.accent)
            fieldset.style.setProperty("--text-color", section.color.text)
            fieldset.classList.add("options")

            fieldset.append(legend, this.createParagraph(section.description), document.createElement("hr"))

            for (const item of section.items)
                fieldset.append(this.generateItem(item))

            form.appendChild(fieldset)

        }

        addSaveButtons();

        return form;
    }

    private generateItem(item: ItemFormat): HTMLParagraphElement {
        switch (item.type) {
            case "boolean":
                return this.generateBoolean(item)

            case "select":
                return this.generateSelect(item)

            case "permissionSelect":
                return this.generatePermissionSelect(item)

            case "number":
                return this.generateNumber(item)

            case "text":
                return this.createParagraph(item.question)
        }
    }
}

export function openBotInfoCard(botData: BotData, query?: true): Promise<boolean>;
export function openBotInfoCard(botData: BotData, actionData?: UserActionsGetter): void;
export function openBotInfoCard(botData: BotData, actionData?: UserActionsGetter | true): void | Promise<boolean> {

    const div = document.body.appendChild(document.createElement("dialog"));
    div.className = "user-card bot";

    div.appendChild(document.createElement("img")).src = botData.image;
    div.appendChild(document.createElement("h1")).innerText = botData.name;

    const p = div.appendChild(document.createElement("p"))
    const byline = p.appendChild(document.createElement("p"))
    byline.classList.add("byline")
    byline.append(`by`)
    byline.appendChild(document.createElement("img")).src = botData.by.image;
    byline.appendChild(document.createTextNode(botData.by.name));

    const tag = p.appendChild(document.createElement("span"));
    tag.classList.add("bot");
    tag.innerText = "BOT";

    if (botData.check)
        tag.appendChild(document.createElement("i")).className =
            "fa-solid fa-fw fa-check"

    if (botData.beta)
        tag.appendChild(document.createElement("i")).className =
            "fa-solid fa-fw fa-screwdriver-wrench"

    const count = p.appendChild(document.createElement("span"));
    count.classList.add("room-count");
    count.appendChild(document.createTextNode(botData.roomCount.toString()));
    count.appendChild(document.createElement("i")).className = "fa-solid fa-users fa-fw";
    count.title = `In ${botData.roomCount} rooms`;

    const description = div.appendChild(document.createElement("div"));
    description.className = "description";
    description.innerText = botData.description;

    if (botData.commands) {

        const list = div.appendChild(document.createElement("div"));
        list.className = "commands";
        list.append(`${botData.commands.length} command${botData.commands.length === 1 ? "" : "s"}:`)

        for (const command of botData.commands) {

            const item = list.appendChild(document.createElement("div"));
            item.className = "command";
            item.innerText = `/${command.command} ${command.args.map(a => a[0]).join(" ")}`
            item.appendChild(document.createElement("span")).innerText = command.description;

        }

    }

    const close = div.appendChild(document.createElement("button"));
    close.className = "close";
    close.appendChild(document.createElement("i")).className = "fa-solid fa-xmark";
    close.append("Close")
    close.addEventListener("click", () => closeDialog(div))

    if (actionData === true) {
        close.remove();
        const actions = div.appendChild(document.createElement("div"));
        actions.className = "actions";

        const yes = actions.appendChild(document.createElement("button"));
        yes.className = "yes";
        yes.appendChild(document.createElement("i")).className = "fa-solid fa-plus";
        yes.append("Add");

        const no = actions.appendChild(document.createElement("button"));
        no.className = "no";
        no.appendChild(document.createElement("i")).className = "fa-solid fa-xmark";
        no.append("Cancel");

        div.showModal();
        return new Promise(res => {
            no.addEventListener("click", () => {
                closeDialog(div);
                res(false);
            });
            yes.addEventListener("click", () => {
                closeDialog(div);
                res(true);
            });
        })
    } else if (actionData && settings.get("user-card-show-actions")) {
        div.style.overflow = "visible";

        const actions = openRoomUserActions(true, () => ({ ...actionData(), profile: undefined }));
        if (actions) div.append(actions);
    }

    div.showModal()

}

export function openInviteMenu(invite: BasicInviteFormat) {

    const div = document.body.appendChild(document.createElement("dialog"))
    div.className = "invite"
    div.showModal();

    div.appendChild(document.createElement("h1")).innerText = invite.message;
    div.appendChild(document.createElement("p")).innerText = invite.longMessage ?? invite.message;

    const accept = div.appendChild(document.createElement("button"))
    accept.appendChild(document.createElement("i")).className = "fa-solid fa-check"
    accept.append("Accept")
    accept.className = "accept"

    const decline = div.appendChild(document.createElement("button"))
    decline.appendChild(document.createElement("i")).className = "fa-solid fa-xmark"
    decline.append("Decline")
    decline.className = "decline"

    const cancel = div.appendChild(document.createElement("button"))
    cancel.innerText = "Cancel"

    cancel.addEventListener("click", () => closeDialog(div))

    accept.addEventListener("click", () => {
        notifications.removeInvite(invite.id)
        socket.emit("invite action", invite.id, "accept")
        closeDialog(div);
    })

    decline.addEventListener("click", () => {
        notifications.removeInvite(invite.id)
        socket.emit("invite action", invite.id, "decline")
        closeDialog(div);
    })

}


/**
 * Opens the what's new display
 */
export function openWhatsNew(data: UpdateNotification) {

    const div = document.createElement("dialog")
    div.className = "whats-new"

    const title = document.createElement("h1")
    title.innerText = `${data.version.name}${data.version.patch ? ` Patch ${data.version.patch}` : ''} released!`

    title.appendChild(document.createElement("br"));
    const date = title.appendChild(document.createElement("p"));
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

    const button = document.createElement("button")
    button.innerText = ["Cool", "Great", "Ok", "Nice", "Yay"][Math.floor(Math.random() * 5)]

    const span = document.createElement("span");
    span.innerText = `What's new in v${data.version.number}:`;

    return new Promise<void>(res => {
        image.addEventListener("load", () => {
            document.body.appendChild(div).showModal();
            div.append(image, title, span, list, button)
            button.addEventListener("click", () => {
                closeDialog(div);
                res();
            })
        })

        image.src = data.imageLink
    })
}

/**
 * Opens the status setter
 * @returns A promise that resolves when the setter is closed with the new status
 */
export function openStatusSetter(): Promise<UserData["status"] | undefined> {

    const div = document.createElement("dialog");
    div.classList.add("status");

    const title = document.createElement("h1")
    title.innerText = "Update your Status"

    const holder = document.createElement("div");

    const emoji = holder.appendChild(document.createElement("span"));
    emoji.classList.add("emoji-picker-opener")
    emoji.innerText = me.status?.char || "+"

    emoji.addEventListener("click", event => {
        div.close();
        emojiSelector(true).then(e => {
            emoji.innerText = e;
            div.showModal();
        }).catch(() => div.showModal())
    })

    const input = holder.appendChild(document.createElement("input"));
    input.maxLength = 200;
    input.value = me.status?.status || "";
    input.placeholder = "Enter status here";

    const save = document.createElement("button")
    save.innerText = "Save"
    save.classList.add("save")

    const cancel = document.createElement("button")
    cancel.innerText = "Cancel"
    cancel.classList.add("cancel")

    const reset = document.createElement("button")
    reset.innerText = "Reset"
    reset.classList.add("reset")

    div.append(title, holder, save, reset, cancel)
    document.body.appendChild(div).showModal();

    return new Promise(resolve => {
        reset.addEventListener("click", () => {

            confirm(`Are you sure you want to reset your status?`, "Reset Status?").then(res => {
                if (res) {
                    socket.emit("status-reset");
                    // userDict.setPart(me.id, "userData", { ...userDict.getData(me.id).userData, status: undefined })
                    closeDialog(div);
                    resolve(undefined);
                }
            })

        })

        save.addEventListener("click", () => {

            if (emoji.innerText === "+")
                return alert("Please choose an emoji", `Can't Set Status`)

            if (input.value.trim().length <= 0)
                return alert("Please enter a status", `Can't Set Status`)

            socket.emit("status-set", emoji.innerText, input.value);

            closeDialog(div);

            resolve({
                char: emoji.innerText,
                status: input.value,
                updated: Date.now()
            })

        })

        cancel.addEventListener("click", () => {
            closeDialog(div);
            resolve(me.status);
        })
    });

}

/**
 * Opens the schedule setter
 * @returns A promise that resolves when the setter is closed, containing the new schedule
 */
export function openScheduleSetter(): Promise<UserData["schedule"] | undefined> {

    const div = document.createElement("dialog");
    div.className = "schedule"

    const makeSpan = (text: string) => {
        const span = document.createElement("span");
        span.innerText = text;
        return span;
    }

    div.append(
        makeSpan("Period"),
        makeSpan("Class")
    )

    const inputs: HTMLInputElement[] = [];

    for (let i = 0; i < 7; i++) {
        const input = document.createElement("input")
        input.maxLength = 20;
        input.type = "text";
        input.placeholder = `Period ${i + 1}`

        if (me.schedule && me.schedule[i])
            input.value = me.schedule[i]

        inputs.push(input);

        div.append(
            makeSpan(`Period ${i + 1}`),
            input
        )
    }

    const save = document.createElement("button");
    const reset = document.createElement("button");

    save.innerText = "Save"
    reset.innerText = "Cancel"

    save.className = "save";
    reset.className = "reset";

    div.append(save, reset);

    document.body.appendChild(div).showModal();

    return new Promise(resolve => {
        reset.addEventListener("click", () => {
            closeDialog(div);
            resolve(me.schedule);
        })

        save.addEventListener("click", () => {
            const classes: string[] = [];

            for (const [index, input] of inputs.entries()) {
                const value = input.value.trim();
                classes.push(value ? value : `Period ${index + 1}`)
            }

            // now it is safe to remove the holder
            closeDialog(div);

            socket.emit("set schedule", classes);

            resolve(classes)

        })
    })

}

/**
 * Loads an SVG from the public folder as an SVG element
 * @param path path to load from (`../public/` is automatically added to the beginning,
 * and `.svg` is added to the end)
 * @since BGC v3.2
 */
export async function loadSVG(path: string): Promise<Element> {

    const text = await fetch(`../public/${path}.svg`).then(r => r.text());

    // convert to HTML
    // https://stackoverflow.com/a/35385518/

    const template = document.createElement("template");
    template.innerHTML = text;

    return template.content.firstElementChild;

}

export function openStatusViewer(status: Status): Promise<void> {
    const div = document.createElement("dialog");
    div.classList.add("status", "viewer");

    const holder = document.createElement("div");

    const emoji = holder.appendChild(document.createElement("span"));
    emoji.classList.add("emoji-picker-opener");
    emoji.innerText = status.char;

    const input = holder.appendChild(document.createElement("input"));
    input.disabled = true;
    input.value = status.status;

    const p = document.createElement("p")
    p.innerText = `Updated at ${new Date(status.updated).toLocaleTimeString("en-US", {
        timeStyle: "short"
    })} on ${new Date(status.updated).toLocaleDateString('en-US', {
        dateStyle: "long"
    })}`

    const cancel = document.createElement("button")
    cancel.innerText = "Close"
    cancel.classList.add("cancel")

    div.append(holder, p, cancel)
    document.body.appendChild(div).showModal();

    return new Promise(res => {
        cancel.addEventListener("click", () => {
            closeDialog(div);
            res();
        });
    })
}

export interface RoomUserActions {
    profile?: {
        image: string;
    };
    name: string;
    room?: {
        name: string;
        emoji: string;
    }
    userId: string;
    roomId: string;
    canRemove: boolean;
    pollRemove?: boolean;
    canMute: boolean;
    pollMute?: boolean;
    canKick: boolean;
    pollKick?: boolean;
    bot?: true;
    unMute?: boolean;
    unKick?: boolean;
}

export type UserActionsGetter = () => RoomUserActions;

export function openRoomUserActions(x: number, y: number, actions: UserActionsGetter): void
export function openRoomUserActions(modal: true, actions: UserActionsGetter): HTMLElement
export function openRoomUserActions(x: number | true, y: number | UserActionsGetter, _actions?: UserActionsGetter) {
    const modal = x === true;
    const actions = (typeof y === "number" ? _actions : y)();

    if (typeof actions === "undefined") return;
    if (!actions.canMute && !actions.canKick && !actions.canRemove)
        return;

    const div = document.createElement("div");
    div.dataset.opening = "true";
    div.className = "room-user-actions dialog-no-style";
    if (modal) div.classList.add("in-card"); else document.body.appendChild(div);

    if (actions.profile) {
        const item = div.appendChild(document.createElement("div"));
        item.className = "dialog-no-style"
        item.appendChild(document.createElement("img")).src = actions.profile.image;
        item.appendChild(document.createTextNode(actions.name));
    }

    else if (actions.room) {
        const item = div.appendChild(document.createElement("div"));
        item.className = "dialog-no-style"
        item.appendChild(document.createElement("span")).innerText = actions.room.emoji;
        item.appendChild(document.createTextNode(actions.room.name));
    }

    if (!actions.canRemove && !actions.canMute && !actions.canKick)
        return;

    if (actions.canRemove) {
        const remove = div.appendChild(document.createElement("button"));
        remove.className = "dialog-no-style remove-button";
        remove.appendChild(document.createElement("i")).className = "fa-solid fa-user-minus";
        remove.append("Remove")
        if (actions.pollRemove)
            remove.appendChild(document.createElement("i")).className = "small fa-solid fa-chart-pie"

        remove.addEventListener("click", async () => {
            if (!await confirm(
                actions.pollRemove ? "Note: This will start a poll" : "",
                `Remove ${actions.name}?`
            )) return;
            if (actions.bot)
                socket.emit("modify bots", actions.roomId, false, actions.userId);
            else
                socket.emit("remove user", actions.roomId, actions.userId);
            click();
        })
    }

    if (actions.canMute) {
        const mute = div.appendChild(document.createElement("button"));
        mute.className = "dialog-no-style mute-button";
        mute.appendChild(document.createElement("i")).className =
            actions.unMute ? "fa-solid fa-volume-high" : "fa-solid fa-volume-xmark";
        mute.append(actions.unMute ? "Unmute" : "Mute");
        if (actions.pollMute)
            mute.appendChild(document.createElement("i")).className = "small fa-solid fa-chart-pie"

        mute.addEventListener("click", () => (actions.unMute ? confirm(
            `Unmute ${actions.name}?`,
            `Unmute ${actions.name}?`
        ) : prompt.number({
            title: `Mute ${actions.name}?`,
            min: 1, placeholder: 5, max: 10,
            body: actions.pollMute ? "Note: this will start a poll" : "",
            label: "Mute duration (minutes)"
        })).then((duration: boolean | number) => {
            if (duration) socket.emit("mute or kick",
                actions.roomId,
                true,
                actions.userId,
                typeof duration === "number" ? Math.round(duration) : 0,
                actions.bot
            );
        }).catch())
    }

    if (actions.canKick) {
        const kick = div.appendChild(document.createElement("button"));
        kick.className = "dialog-no-style kick-button";
        kick.appendChild(document.createElement("i")).className =
            `fa-solid fa-person-walking-dashed-line-arrow-right${actions.unKick ? "" : " reverse"}`;
        kick.append(actions.unKick ? "Unkick" : "Kick");
        if (actions.pollKick)
            kick.appendChild(document.createElement("i")).className = "small fa-solid fa-chart-pie"

        kick.addEventListener("click", () => (actions.unKick ? confirm(
            `Re-add ${actions.name} to the room?`,
            `Unkick ${actions.name}?`
        ) : prompt.number({
            title: `Kick ${actions.name}?`,
            min: 1, placeholder: 5, max: 10,
            body: actions.pollKick ? "Note: this will start a poll" : "",
            label: "Kick duration (minutes)"
        })).then((duration: boolean | number) => {
            if (duration) socket.emit("mute or kick",
                actions.roomId,
                false,
                actions.userId,
                typeof duration === "number" ? Math.round(duration) : 0
            )
        }).catch());
    }

    if (modal)
        return div;

    div.style.left = Math.min((Math.max(x - div.offsetWidth, 0)), window.innerWidth - div.offsetWidth) + "px";
    //@ts-expect-error
    div.style.top = Math.min(Math.max(y - div.offsetHeight, 0), window.innerHeight - div.offsetHeight) + "px";

    const click = (event?: MouseEvent) => {
        if (event && (div.contains(event.target as HTMLElement) || div.dataset.opening === "true"))
            return;

        window.removeEventListener("click", click);
        window.removeEventListener("contextmenu", click);
        div.remove();
    }

    window.addEventListener("click", click);
    window.addEventListener("contextmenu", click);

    setTimeout(() => {
        delete div.dataset.opening;
    }, 1);

    return div;
}

export function showKickedNotification({ roomId, roomName, kickLength, kickTime, kickedBy }: KickNotification) {
    const dialog = document.body.appendChild(document.createElement("dialog"));
    dialog.className = "alert kicked";

    dialog.appendChild(document.createElement("h1")).innerText =
        `Kicked from ${roomName}`;

    const formatter = new Intl.DateTimeFormat("en-US", {
        timeStyle: "short"
    })

    dialog.appendChild(document.createElement("p")).innerText =
        `${kickedBy} kicked you from ${roomName} at ${formatter.format(kickTime)}.\n` +
        `You will be re-added to ${roomName} in ${kickLength} minute${kickLength === 1 ? "" : "s"}, ` +
        `at ${formatter.format(kickTime + (60 * 1000 * kickLength))}.\n If you do not wish to be ` +
        `re-added, you can leave the room below.\n`;

    const buttons = dialog.appendChild(document.createElement("div"));
    buttons.className = "buttons";

    const leave = buttons.appendChild(document.createElement("button"));
    leave.className = "leave red";
    leave.innerText = `Leave`;
    dialog.showModal();

    const close = buttons.appendChild(document.createElement("button"));
    close.innerText = "Close";
    close.addEventListener("click", () => {
        closeDialog(dialog);
    })

    return new Promise<boolean>(res => {
        leave.addEventListener("click", async () => {
            closeDialog(dialog);
            if (
                !await confirm(`You will not be able to rejoin unless you are invited back`, `Leave ${roomName}?`)
            ) return showKickedNotification({
                roomId, roomName, kickedBy, kickLength, kickTime
            });

            socket.emit("leave room", roomId);
            res(true);
        });
    })
}

export function peopleOrBots(people: () => any, bots: () => any) {
    const dialog = document.body.appendChild(document.createElement("dialog"));
    dialog.className = "people-or-bots";

    const peopleButton = dialog.appendChild(document.createElement("button"));
    peopleButton.appendChild(document.createElement("i")).className =
        "fa-solid fa-person";
    peopleButton.append("Invite Someone");
    peopleButton.addEventListener("click", () => {
        closeDialog(dialog);
        people();
    })

    const botButton = dialog.appendChild(document.createElement("button"));
    botButton.appendChild(document.createElement("i")).className =
        "fa-solid fa-robot";
    botButton.append("Add a Bot");
    botButton.addEventListener("click", () => {
        closeDialog(dialog);
        bots();
    })

    const cancelButton = dialog.appendChild(document.createElement("button"));
    cancelButton.appendChild(document.createElement("i")).className =
        "fa-solid fa-xmark";
    cancelButton.append("Cancel");
    cancelButton.addEventListener("click", () => closeDialog(dialog))

    dialog.showModal();
}

export function showCredits(): Promise<void> {
    const dialog = document.body.appendChild(document.createElement("dialog"));
    dialog.className = "credits";

    {
        const holder = dialog.appendChild(document.createElement("div"));
        holder.className = "title section";
        holder.appendChild(document.createElement("img")).src = "/public/logo.svg";
        const div = holder.appendChild(document.createElement("div"));
        div.appendChild(document.createElement("h1")).innerText = "Backup Google Chat";
        const a = div.appendChild(document.createElement("a"));
        a.innerText = `${UpdateData.version.name} (v${UpdateData.version.number})`;
        a.href = UpdateData.logLink;
        a.target = "_blank";
        a.appendChild(document.createElement("i")).className = "fa-solid fa-up-right-from-square fa-fw";
        div.appendChild(document.createElement("span")).innerText = UpdateData.date;
        holder.appendChild(document.createElement("img")).src = UpdateData.imageLink;
    }

    dialog.appendChild(document.createElement("h1")).innerText = "Created By"

    {
        const holder = dialog.appendChild(document.createElement("div"));
        holder.className = "credits section";

        {
            const div = holder.appendChild(document.createElement("div"));
            div.appendChild(document.createElement("h2")).innerText = "Jason Mayer";
            div.appendChild(document.createElement("p")).innerText = "Lead Developer";
            const a = div.appendChild(document.createElement("a"));
            a.href = "https://github.com/one23four56";
            a.target = "_blank";
            a.appendChild(document.createElement("i")).className = "fa-brands fa-github";
            a.appendChild(document.createElement("i")).className = "fa-solid fa-up-right-from-square fa-fw";
        }

        {
            const div = holder.appendChild(document.createElement("div"));
            div.appendChild(document.createElement("h2")).innerText = "Felix Singer";
            div.appendChild(document.createElement("p")).innerText = "Developer";
            const a = div.appendChild(document.createElement("a"));
            a.href = "https://github.com/codeforfunfelix";
            a.target = "_blank";
            a.appendChild(document.createElement("i")).className = "fa-brands fa-github";
            a.appendChild(document.createElement("i")).className = "fa-solid fa-up-right-from-square fa-fw";
        }
    }

    dialog.appendChild(document.createElement("h1")).innerText = "Powered By";

    const imageGenerator = (holder: HTMLElement) => (light: string, dark: string, link: string) => {
        const a = holder.appendChild(document.createElement("a"));
        a.appendChild(document.createElement("img")).src = settings.get.themeType() === "dark" ? light : dark;
        a.href = link;
        a.target = "_blank";
    };

    {
        const holder = dialog.appendChild(document.createElement("div"));
        holder.className = "credits section";
        const add = imageGenerator(holder);

        add(
            "https://nodejs.org/static/logos/nodejsLight.svg",
            "https://nodejs.org/static/logos/nodejsDark.svg",
            "https://nodejs.org/"
        );

        add(
            "/public/express-l.svg",
            "/public/express-d.svg",
            "https://expressjs.com/"
        );

        add(
            "/public/socket-io-l.svg",
            "/public/socket-io-d.svg",
            "https://socket.io/",
        );
    }

    dialog.appendChild(document.createElement("h1")).innerText = "Built With";

    {
        const holder = dialog.appendChild(document.createElement("div"));
        holder.className = "credits section";
        const add = imageGenerator(holder);

        add(
            "/public/ts.svg",
            "/public/ts.svg",
            "https://www.typescriptlang.org/"
        );

        add(
            "/public/sass.svg",
            "/public/sass.svg",
            "https://sass-lang.com/"
        );

        add(
            "/public/esbuild-l.svg",
            "/public/esbuild-d.svg",
            "https://esbuild.github.io/",
        );
    }

    dialog.appendChild(document.createElement("h1")).innerText = "All Dependencies";

    {
        const holder = dialog.appendChild(document.createElement("div"));
        holder.className = "credits section wrap";

        const dependencies = [
            "body-parser",
            "cookie-parser",
            "dotenv",
            "esbuild",
            "express",
            "highlight.js",
            "markdown-it",
            "markdown-it-anchor",
            "nodemailer",
            "sass",
            "socket.io",
            "socket.io-client",
            "temporal-polyfill",
            "typescript",
            "uuid",
            "emoji-mart",
            "wordcloud"
        ].sort();

        for (const dependency of dependencies) {
            const a = holder.appendChild(document.createElement("a"));
            a.innerText = dependency;
            a.href = `https://npmjs.com/package/${dependency}`;
            a.target = "_blank";
        }
    };

    {
        const p = dialog.appendChild(document.createElement("p"));
        p.append("Icons by ");
        const a = p.appendChild(document.createElement("a"));
        a.appendChild(document.createElement("i")).className = "fa-brands fa-font-awesome fa-fw";
        a.append("Font Awesome");
        a.href = "https://fontawesome.com/";
        a.target = "_blank";
    }

    // dialog.appendChild(document.createElement("h1")).innerText = "Special Thanks To";

    // {
    //     const holder = dialog.appendChild(document.createElement("div"));
    //     holder.className = "credits section";

    //     {
    //         const div = holder.appendChild(document.createElement("div"));
    //         div.appendChild(document.createElement("h2")).innerText = "Oliver Boyden";
    //         div.appendChild(document.createElement("p")).innerText = "Original Logo Design";
    //     }

    //     {
    //         const div = holder.appendChild(document.createElement("div"));
    //         div.appendChild(document.createElement("h2")).innerText = "Dominic Cottrill";
    //         div.appendChild(document.createElement("p")).innerText = "Bug Reporting & Testing";
    //     }
    // }

    const close = dialog.appendChild(document.createElement("button"));
    close.addEventListener("click", () => closeDialog(dialog));
    close.appendChild(document.createElement("i")).className = "fa-solid fa-xmark";
    close.append("Close");

    dialog.showModal();
    return new Promise(res => dialog.addEventListener("close", () => res(), { once: true }));
}

export function setProfilePicture(image: string) {
    const dialog = document.body.appendChild(document.createElement("dialog"));
    dialog.className = "profile-picture";

    const img = dialog.appendChild(document.createElement("img"));
    img.src = image;

    const upload = dialog.appendChild(document.createElement("button"));
    upload.appendChild(document.createElement("i")).className = "fa-solid fa-upload fa-fw";
    upload.append("Upload");
    upload.className = "submit";

    upload.addEventListener("click", async () => {
        const files = document.createElement("input");
        files.type = "file";
        files.accept = Object.entries(TypeCategories).filter(([t, c]) => c === MediaCategory.image).join(",");
        files.click();

        const file: File = await new Promise((res) => files.addEventListener("change", () => {
            res(files.files[0]);
        }));

        if (!file) return;

        if (file.size > 2e6)
            return alert(`Your profile picture must be less than 2 MB`, "File too Large");

        const response = await fetch(`/media/profile/set?type=${file.type}`, {
            method: "POST",
            body: await file.arrayBuffer(),
            headers: {
                "Content-Type": "application/octet-stream"
            }
        }).catch(err => String(err));

        if (typeof response === "string")
            return alert(response, "Error");

        if (!response.ok)
            return alert(response.statusText, response.status.toString());

        const url = URL.createObjectURL(file);
        img.src = url;
        URL.revokeObjectURL(url);

        // alert("Your profile picture has been changed.\nIt may take a couple minutes for it to update across the site.", "Upload Completed");
    });

    const close = dialog.appendChild(document.createElement("button"));
    close.appendChild(document.createElement("i")).className = "fa-solid fa-xmark fa-fw";
    close.append("Close");
    close.addEventListener("click", () => closeDialog(dialog));

    dialog.showModal();

    return new Promise<void>((res) => {
        dialog.addEventListener("close", () => res());
    })
}