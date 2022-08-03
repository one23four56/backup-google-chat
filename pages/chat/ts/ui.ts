import { UserData } from "../../../ts/lib/authdata";
import { id } from "./functions";
import { socket } from "./script";


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


export function searchUsers(stringTitle: string, hideUsers?: string[]): Promise<UserData> {

    return new Promise((resolve, reject) => {

        const div = document.createElement("div");
        div.classList.add("modal", "search-users");

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

                    if (hideUsers && hideUsers.includes(user.id))
                        continue;

                    const holder = document.createElement("div"), image = document.createElement("img"), name = document.createElement("b")

                    holder.className = "user"

                    name.innerText = user.name;
                    image.src = user.img

                    holder.append(image, name)

                    holder.addEventListener("click", () => {
                        div.remove();
                        id("modal-cover").style.display = "none";
                        resolve(user);
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

        id("modal-cover").addEventListener("click", ()=>{
            div.remove();
            id("modal-cover").style.display = "none";
            reject();
        }, { once: true })

        id("modal-cover").style.display = "block"
        document.body.appendChild(div)

    })

}