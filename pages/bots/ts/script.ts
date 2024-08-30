import type { UserBot } from "../../../ts/modules/userBots";
import { alert, confirm, prompt } from "./alerts";

const id = <type extends HTMLElement>(id: string) => document.getElementById(id) as type;
const append = <name extends keyof HTMLElementTagNameMap>(element: HTMLElement, type: name): HTMLElementTagNameMap[name] =>
    element.appendChild(document.createElement(type));
const icon = (icon: TemplateStringsArray, ...args): HTMLElement => {
    const i = document.createElement("i");
    i.className = icon.map((n, i) => n + (args[i] ?? "")).join("");
    return i;
}

async function loadBots(): Promise<UserBot[]> {
    const bots: UserBot[] = await fetch('/bots/all').then(res => res.json());
    const holder = id("bots");

    holder.innerText = "";
    id("bot-count").innerText = `My Bots (${bots.length} /  10)`;

    for (const bot of bots) {
        const item = append(holder, "div");
        item.className = "bot";
        append(item, "img").src = bot.image;
        append(item, "span").innerText = bot.name;
        append(item, "span").innerText = bot.id;
        const tag = append(item, "span");
        tag.append(
            icon`fa-solid fa-${bot.enabled ? "check" : "xmark"} fa-fw`,
            bot.enabled ? "ENABLED" : "DISABLED"
        )
        tag.className = bot.enabled ? "enabled" : "disabled";
        item.append(icon`fa-solid fa-pen`);
        item.addEventListener("click", () => openBot(bot.id));
    }

    return bots;
}

await loadBots(); // initial load

id<HTMLButtonElement>("add-bot").addEventListener("click", async () => {
    const res = await fetch("/bots/create", { method: 'POST' });
    const id = await res.text();
    if (!res.ok) return alert(id, "Error");
    loadBots();
    await openBot(id);
})

function setMain(name: string = "home") {
    if (name === "home") loadBots();
    document.querySelectorAll("div.body").forEach(d => d.classList.remove("main"));
    id(name).classList.add("main");
}

interface InputSettings {
    label: string;
    charLimit: number;
    placeholder: string;
    value: string;
    submitText?: string;
    submitIcon?: string;
    wide?: true,
    change?: (this: HTMLInputElement, ev: Event) => any;
    submit: (value: string, error: (error: string) => void) => Promise<any>;
}

function input({ label, charLimit, placeholder, submitText, submitIcon, submit, value, wide, change }: InputSettings, parent?: HTMLElement) {
    const holder = document.createElement("label");
    holder.innerText = label + ":";

    const input = append(holder, "input");
    input.type = "text";
    input.maxLength = charLimit;
    input.placeholder = placeholder;
    input.value = value;
    input.minLength = 0;

    if (wide)
        input.classList.add("wide");

    if (change)
        input.addEventListener("input", change);

    const button = append(holder, "button");
    button.append(icon`fa-solid ${submitIcon ?? "fa-pencil"} fa-fw`, submitText ?? "Update");

    const error = (error: string) => alert(error, "Error"); // for now

    const click = async () => {
        button.innerText = "";
        button.append(icon`fa-solid fa-gear fa-spin fa-fw`, submitText ?? "Update");

        await submit(input.value, error);

        button.innerText = "";
        button.append(icon`fa-solid ${submitIcon ?? "fa-pencil"} fa-fw`, submitText ?? "Update");
        button.addEventListener("click", click, { once: true })
    }

    button.addEventListener("click", click, { once: true });

    if (parent)
        parent.appendChild(holder);

    return holder;
}

function botOptions(bot: UserBot): HTMLDivElement {
    const div = document.createElement("div");
    div.className = "buttons";

    const manage = append(div, "div");
    manage.classList.add("buttons");

    const remove = append(manage, "button");
    remove.append(
        icon`fa-solid fa-trash fa-fw`,
        "Delete Bot"
    );

    remove.addEventListener("click", async () => {
        if (await prompt(`Type '${bot.name}' to continue`, `Delete ${bot.name}?`) !== bot.name)
            return;

        if (!await confirm(`Are you sure you want to delete ${bot.name}?`, `Delete ${bot.name}?`))
            return;

        const res = await fetch(`/bots/${bot.id}`, { method: 'DELETE' });
        if (!res.ok)
            return alert(await res.text(), "Error");

        loadBots();
        setMain();
    })

    if (bot.enabled) {
        const disable = append(manage, "button");
        disable.append(
            icon`fa-solid fa-ban fa-fw`,
            "Disable Bot"
        );
        disable.addEventListener("click", async () => {
            if (!await confirm(
                `Are you sure you want to disable ${bot.name}?`,
                `Disable ${bot.name}?`
            )) return;

            
        })
    } else {
        const publish = append(manage, "button");
        publish.append(
            icon`fa-solid fa-power-off fa-fw`,
            "Enable Bot"
        );
        publish.addEventListener("click", async () => {
            const res = await fetch(`/bots/${bot.id}/enable`, { method: 'POST' });
            if (!res.ok)
                return alert(await res.text(), "Error");

            bot.enabled = true;
            loadBots();
            div.replaceWith(botOptions(bot));
        });
    }

    return div;
}

async function openBot(id: string) {
    const res = await fetch(`/bots/${id}`).catch();
    if (!res.ok) return alert(await res.text());
    const bot: UserBot = await res.json();

    const holder = append(document.body, "div");
    holder.className = "body indent edit-bot";
    holder.id = bot.id;
    setMain(bot.id);

    const back = append(holder, "button");
    back.append(icon`fa-solid fa-arrow-left fa-fw`, "Back");
    back.addEventListener("click", () => {
        holder.remove();
        setMain();
    });

    append(holder, "span").innerText = `Bot #${bot.id}`
    holder.append(botOptions(bot));
    append(holder, "hr");

    input({
        label: "Bot Name",
        charLimit: 20,
        placeholder: "My Bot",
        value: bot.name,
        async submit(name, error) {
            const res = await fetch(`/bots/${bot.id}/name`, {
                method: 'post',
                body: JSON.stringify({ name }),
                headers: {
                    'Content-Type': 'application/json'
                }
            }).catch();
            if (!res.ok) return error(await res.text());
            bot.name = name;
            loadBots();
        }
    }, holder);

    input({
        label: "Bot Image URL",
        charLimit: 500,
        placeholder: "https://example.com/image",
        value: bot.image,
        wide: true,
        async submit(image, error) {
            const res = await fetch(`/bots/${bot.id}/image`, {
                method: 'post',
                body: JSON.stringify({ image }),
                headers: {
                    'Content-Type': 'application/json'
                }
            }).catch();
            if (!res.ok) return error(await res.text());
            loadBots();
        },
        change() {
            image.src = this.value;
        },
    }, holder);

    const image = append(holder, "img");
    image.src = bot.image;

    input({
        label: "Bot Description",
        charLimit: 250,
        placeholder: "Enter a description...",
        wide: true,
        value: bot.description,
        async submit(description, error) {
            const res = await fetch(`/bots/${bot.id}/description`, {
                method: 'post',
                body: JSON.stringify({ description }),
                headers: {
                    'Content-Type': 'application/json'
                }
            }).catch();
            if (!res.ok) return error(await res.text());
            loadBots();
        },
    }, holder);

    append(holder, "hr");

    const tokenHolder = append(holder, "div");
    const tokenButton = append(tokenHolder, "button");
    tokenButton.append(
        icon`fa-solid fa-key fa-fw`,
        "Generate Token"
    );
    const tokenDisplay = append(tokenHolder, "span");
    append(tokenHolder, "br");
    append(tokenHolder, "br");
    append(tokenHolder, "span").innerText = "Note: Generating a new token will invalidate any old tokens that were previously set.";

    tokenButton.addEventListener("click", async () => {
        if (!await confirm("Are you sure you want to generate a token?\nThis will invalidate all old tokens", "Generate Token?"))
            return;

        const res = await fetch(`/bots/${bot.id}/token`, { method: 'post' }).catch();
        const token = await res.text();

        if (!res.ok)
            return alert(token, "Error");

        tokenDisplay.innerText = "Bot Token: ";
        append(tokenDisplay, "code").innerText = token;
        append(tokenDisplay, "b").innerText = " (keep this secret!)";
    })

    append(holder, "hr");

    input({
        charLimit: 500,
        label: "Command Server URL",
        placeholder: "https://example.com",
        value: bot.commandServer || "",
        wide: true,
        async submit(server, error) {
            const res = await fetch(`/bots/${bot.id}/server`, {
                method: 'post',
                body: JSON.stringify({ server }),
                headers: {
                    'Content-Type': 'application/json'
                }
            }).catch();
            if (!res.ok) return error(await res.text());
            loadBots();
        },
    }, holder);

    const botId = document.createElement("code");
    botId.innerText = bot.id;

    append(holder, "p").append(
        "Command server must respond to GET requests with ",
        botId,
        " (the ID of this bot)"
    )

    append(holder, "hr");

}