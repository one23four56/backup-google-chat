import type { UserBot, UserBotArg, UserBotCommand } from "../../../ts/modules/userBots";
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

function button(text: string, click: (error: (error: string) => void) => Promise<any>, buttonIcon: string = "fa-pencil") {
    const button = document.createElement("button");
    button.append(icon`fa-solid ${buttonIcon} fa-fw`, text);

    const error = (error: string) => alert(error, "Error"); // for now

    const onClick = async () => {
        button.innerText = "";
        button.append(icon`fa-solid fa-gear fa-spin fa-fw`, text);

        await click(error);

        button.innerText = "";
        button.append(icon`fa-solid ${buttonIcon} fa-fw`, text);
        button.addEventListener("click", onClick, { once: true })
    }

    button.addEventListener("click", onClick, { once: true });

    return button;
}

function post(url: string, body: Object, method: string = "POST") {
    return new Promise<string>((res, rej) => {
        fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        }).catch(err => rej(err)).then(async response => {
            if (!response) return;
            if (!response.ok) return rej(await response.text());
            res(await response.text());
        })
    })
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
    submit?: (value: string, error: (error: string) => void) => Promise<any>;
    type?: string;
}

function input({ label, charLimit, placeholder, submitText, submitIcon, submit, value, wide, change, type }: InputSettings, parent?: HTMLElement) {
    const holder = document.createElement("label");
    holder.innerText = label + ":";

    const input = append(holder, "input");
    input.type = type ?? "text";
    input.maxLength = charLimit;
    input.placeholder = placeholder;
    input.value = value;
    if (type === "checkbox")
        input.checked = value as any as boolean;
    input.minLength = 0;

    if (wide)
        input.classList.add("wide");

    if (change)
        input.addEventListener("input", change);

    if (submit) holder.append(button(
        submitText ?? "Update",
        async (error) => {
            await submit(input.value, error);
        },
        submitIcon ?? "fa-pencil"
    ));

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
        manage.append(button("Disable Bot", async error => {
            const res = await post(`/bots/${bot.id}/disable`, {}).catch(error);
            if (!res) return;

            bot.enabled = false;
            loadBots();
            div.replaceWith(botOptions(bot));
        }, "fa-ban"))

        manage.append(button("Publish Bot", async error => {
            const res = await post(`/bots/${bot.id}/publish`, {}).catch(error);
            if (!res) return;

            alert(`${bot.name} has been published successfully.`, "Publish Success");
        }, "fa-arrow-right-from-bracket"))
    } else
        manage.append(button("Enable Bot", async error => {
            const res = await post(`/bots/${bot.id}/enable`, {}).catch(error);
            if (!res) return;

            bot.enabled = true;
            loadBots();
            div.replaceWith(botOptions(bot));
        }, "fa-power-off"));


    return div;
}

function commands(bot: UserBot): HTMLDivElement {
    const div = document.createElement("div");

    div.className = "commands";

    const addCommand = (index: number, command: UserBotCommand) => {
        const holder = append(div, "div");
        holder.className = "command";

        input({
            label: `Command ${index + 1}`,
            charLimit: 20,
            placeholder: "example",
            value: command.name,
            change() {
                command.name = this.value;
            },
        }, holder);

        input({
            label: `Description`,
            charLimit: 100,
            placeholder: "Enter a description...",
            value: command.description,
            wide: true,
            change() {
                command.description = this.value;
            },
        }, holder);

        holder.append(button("Delete", async error => {
            if (!await confirm(`Are you sure you want to delete command ${index + 1}?`, "Delete Command?"))
                return;

            bot.commands = bot.commands?.filter((_, i) => i !== index);
            div.replaceWith(commands(bot));
        }, "fa-trash"))

        const argHolder = append(holder, "div");
        argHolder.className = "commands arguments";

        const addArg = addArguments(argHolder, command);

        argHolder.append(button("Add Argument", async error => {
            if (command.args.length >= 5)
                return error("You can't add more than 5 arguments");

            const arg: UserBotArg = {
                description: "",
                name: ""
            };

            const index = command.args.push(arg) - 1;

            addArg(index, arg);
        }, "fa-plus"));

        for (const [index, arg] of command.args.entries())
            addArg(index, arg);
    }

    const addArguments = (_holder: HTMLDivElement, command: UserBotCommand) => (index: number, argument: UserBotArg) => {
        const holder = append(_holder, "div");
        holder.className = "argument";

        input({
            label: `Argument ${index + 1}`,
            charLimit: 20,
            placeholder: "example",
            value: argument.name,
            change() {
                argument.name = this.value;
            },
        }, holder);

        input({
            label: `Description`,
            charLimit: 100,
            placeholder: "Enter a description...",
            value: argument.description,
            wide: true,
            change() {
                argument.description = this.value;
            },
        }, holder);

        holder.append(button("Delete", async error => {
            command.args = command.args.filter((_, i) => i !== index);
            div.replaceWith(commands(bot));
        }, "fa-trash"));

        const options = append(holder, "div");
        options.className = "arguments";

        input({
            type: "checkbox",
            charLimit: 0,
            placeholder: "",
            label: "Optional",
            //@ts-expect-error
            value: argument.optional,
            change(ev) {
                argument.optional = this.checked
            },
        }, options);

        append(options, "br");

        input({
            type: "checkbox",
            charLimit: 0,
            placeholder: "",
            label: "Multi-word",
            //@ts-expect-error
            value: argument.multiWord,
            change(ev) {
                argument.multiWord = this.checked
            },
        }, options);
    }

    const buttons = append(div, "div");
    buttons.className = "buttons";

    buttons.append(button("Add Command", async error => {
        if (bot.commands && bot.commands.length >= 10)
            return error("You can't add more then 10 commands");

        const command: UserBotCommand = {
            args: [],
            description: "",
            name: ""
        };

        if (!bot.commands)
            bot.commands = [];

        const index = bot.commands.push(command) - 1;
        addCommand(index, command);
    }, 'fa-plus'));

    buttons.append(button("Save Commands", async error => {
        const res = await post(`/bots/${bot.id}/commands`, bot.commands ?? []).catch(error);
        if (!res) return;

        alert("Commands saved successfully", "Commands saved")
    }, 'fa-floppy-disk'))

    append(div, "p").innerText = "Note: do not include the '/' when typing commands";

    if (bot.commands)
        for (const [index, command] of bot.commands.entries())
            addCommand(index, command);

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

    append(holder, "span").innerText = `Bot ${bot.id}`
    holder.append(botOptions(bot));
    append(holder, "hr");

    input({
        label: "Bot Name",
        charLimit: 20,
        placeholder: "My Bot",
        value: bot.name,
        async submit(name, error) {
            await post(`/bots/${bot.id}/name`, { name }).catch(error);
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
            await post(`/bots/${bot.id}/image`, { image }).catch(error);
            bot.image = image;
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
            await post(`/bots/${bot.id}/description`, { description }).catch(error);
            bot.description = description;
            loadBots();
        },
    }, holder);

    append(holder, "hr");

    const tokenHolder = append(holder, "div");
    tokenHolder.append(button("Generate Token",
        async error => {
            if (!await confirm("Are you sure you want to generate a token?\nThis will invalidate all old tokens", "Generate Token?"))
                return;

            const token = await post(`/bots/${bot.id}/token`, {}).catch(error);
            if (!token) return;

            tokenDisplay.innerText = "Bot Token: ";
            append(tokenDisplay, "code").innerText = token;
            append(tokenDisplay, "b").innerText = " (keep this secret!)";
        },
        "fa-key"
    ));
    const tokenDisplay = append(tokenHolder, "span");
    append(tokenHolder, "br");
    append(tokenHolder, "br");
    append(tokenHolder, "span").innerText = "Note: Generating a new token will invalidate any old tokens that were previously set.";

    append(holder, "hr");

    input({
        charLimit: 500,
        label: "Command Server URL",
        placeholder: "https://example.com",
        value: bot.commandServer || "",
        wide: true,
        async submit(server, error) {
            await post(`/bots/${bot.id}/server`, { server }).catch(error);
            bot.commandServer = server;
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

    holder.append(commands(bot));

    append(holder, "hr");

    append(holder, "b").innerText = "Events";

    input({
        type: "checkbox",
        charLimit: 0,
        placeholder: "",
        label: "Command sent (command)",
        //@ts-expect-error
        value: true,
        change(ev) {
            this.checked = true;
        },
    }, holder);

    input({
        type: "checkbox",
        charLimit: 0,
        placeholder: "",
        label: "Added to room (added)",
        //@ts-expect-error
        value: bot.events.added,
        async change(ev) {
            await post(`/bots/${bot.id}/event`, {
                event: "added",
                enabled: this.checked
            }).catch(err => alert(err, "Error"));
            loadBots();
        },
    }, holder);

    //    input({
    //         type: "checkbox",
    //         charLimit: 0,
    //         placeholder: "",
    //         label: "User joins room (join)",
    //         //@ts-expect-error
    //         value: true,
    //         async change(ev) {
    //             await post(`/bots/${bot.id}/event`, {
    //                 event: "join",
    //                 enabled: this.checked
    //             }).catch(err => alert(err));
    //             loadBots();
    //         },
    //     }, holder);

    append(holder, "hr");

    append(holder, "b").innerText = "API Endpoint Quick Reference";

    const docLink = document.createElement("a");
    docLink.href = "/bots/docs/api-docs.md.html";
    docLink.target = "_blank";
    docLink.innerText = "API Documentation"

    append(holder, "p").append(
        "See the full ",
        docLink,
        " for more information."
    )

    {
        const div = append(holder, "div");
        div.className = "indent";
        append(append(div, "h2"), "code").innerText = "GET /bots/api/rooms/";
        append(div, "p").innerText = "Get all rooms that this bot is in."
    }

    {
        const div = append(holder, "div");
        div.className = "indent";
        append(append(div, "h2"), "code").innerText = "GET /bots/api/[roomID]/archive";
        append(div, "p").innerText = "Get all messages sent in a room. Note: will return 403 Forbidden if the room owner turned off archive access."
    }

    {
        const div = append(holder, "div");
        div.className = "indent";
        append(append(div, "h2"), "code").innerText = "GET /bots/api/[roomID]/messages";
        append(div, "p").innerText = "Get the last 50 messages sent in a room. Note: not affected by room archive access settings."
    }

    {
        const div = append(holder, "div");
        div.className = "indent";
        append(append(div, "h2"), "code").innerText = "POST /bots/api/send/";
        append(div, "p").innerText = "Send a message. Note: recipient rooms are specified in the request body. Defaults to all rooms."
    }

}