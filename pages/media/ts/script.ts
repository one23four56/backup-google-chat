import { methods, sort } from "./sorting";

let method: keyof typeof methods = "time";
let reverse = false;

const header = (index: number) => document.querySelector(".file.header")?.children.item(index) as HTMLElement;

const sorter = (m: keyof typeof methods) => {
    if (m === "reverse") throw new Error(); // type safety lol

    if (method !== m) {
        method = m;
        sort(methods[m]);
        return "down"
    }

    if (reverse) {
        reverse = false;
        sort(methods[m]);
        return "down"
    }

    reverse = true;
    sort(methods.reverse(methods[m]));
    return "up";
}

const setIcon = (dir: "up" | "down") => {
    const icon = document.getElementById("icon") as HTMLElement;
    icon.classList.remove("fa-caret-up", "fa-caret-down");
    icon.classList.add(`fa-caret-${dir}`);
    return icon;
}

for (const [index, item] of Object.keys(methods).entries()) {
    if (index === 0) continue;
    header(index).addEventListener("click", () => {
        const icon = setIcon(sorter(item as keyof typeof methods));
        header(index).appendChild(icon);
    })
}