

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
        document.querySelectorAll<TopBar>('view-top-bar').forEach(bar => {
            bar.isMain = false;
            bar.style.display = 'none';
        })

        this.isMain = true;
        this.style.display = 'flex';
    }
}