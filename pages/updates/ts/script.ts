import Updates from '../../../updates.json';

const sidebar = document.getElementById("sidebar") as HTMLDivElement;
const iframe = document.querySelector("iframe") as HTMLIFrameElement;
const header = document.querySelector("header") as HTMLElement;

let open: string = "";

for (const update of Updates.reverse()) {
    const item = sidebar.appendChild(document.createElement("div"));
    item.className = "item";

    item.appendChild(document.createElement("span")).innerText = update.version;

    if (update.version.endsWith(".0")) {
        const name = item.appendChild(document.createElement("span"));
        name.innerText = update.updateName;
        name.className = "name";
    }

    const link = update.logLink.includes(".md") ? update.logLink.replace(".md", ".md.html") : update.logLink;

    const click = () => {
        (<HTMLElement>header.querySelector("b")).innerText = update.updateName;
        iframe.src = `/updates/versions/${link}`;
        document.title = update.updateName;
        open = link;
        document.querySelectorAll(".selected").forEach(e => e.classList.remove("selected"));
        item.classList.add("selected");
    };


    item.addEventListener("click", click);
    item.addEventListener("focus", click);

    item.id = update.version;
    item.tabIndex = 1;
};

const update = new URLSearchParams(location.search).get("v");

if (update && update.startsWith("v") && document.getElementById(update))
    document.getElementById(update)?.click();
else
    //@ts-expect-error
    sidebar.firstElementChild.click();

(<HTMLElement>document.getElementById("open")).addEventListener("click", () => {
    window.open(`/updates/versions/${open}`, "_blank");
})