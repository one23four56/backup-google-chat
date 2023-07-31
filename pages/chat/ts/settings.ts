import { DefaultSettings, isBoolItem, SettingsCategory, SettingsMetaData } from "../../../ts/lib/settings"
import { confirm } from "./popups";
import { socket } from "./script";
import { WhatsNewData } from "./ui";

let settings: typeof DefaultSettings = await fetch('/me/settings').then(r => r.json())

const root = document.querySelector(":root")

root.classList.add(["light", "dark", "ukraine"][settings.theme])
root.classList.add(["fit-all", "fit-height"][settings["image-display"]])
root.classList.remove("animated-messages")
settings["animate-new-messages"] && root.classList.add("animated-messages")

/**
 * gets a setting
 * @param key getting to get
 * @returns the value of the setting
 */
function get<Key extends keyof typeof DefaultSettings>(key: Key): typeof DefaultSettings[Key] {
    return settings[key];
}

/**
 * Sets an item in the settings and updates it on the server
 * @param key key to set
 * @param value value to set it to
 */
function set<Key extends keyof typeof DefaultSettings>(key: Key, value: typeof DefaultSettings[Key]) {
    settings[key] = value;
    socket.emit("update setting", key, value)

    // update styles
    root.classList.remove("light", "dark", "ukraine")
    root.classList.add(["light", "dark", "ukraine"][settings.theme])

    root.classList.remove("fit-all", "fit-width", "fit-height")
    root.classList.add(["fit-all", "fit-height"][settings["image-display"]])

    root.classList.remove("animated-messages")
    settings["animate-new-messages"] && root.classList.add("animated-messages")

}

/**
 * Open the settings popup
 * @param category optional category to open to
 */
function open(category?: string) {

    const holder = document.body.appendChild(document.createElement('div'))
    holder.className = "settings-holder"

    const div = holder.appendChild(document.createElement("div"))

    const list = div.appendChild(document.createElement("div"))
    list.className = "list"

    const categories: Record<string, HTMLElement> = {};

    const loadAboutPage = async (item: HTMLDivElement) => {
        item.classList.add("about")

        const
            whatsNew: WhatsNewData = await fetch("/public/whats-new.json").then(res => res.json()),
            logo = item.appendChild(document.createElement("img")),
            versionImage = item.appendChild(document.createElement("img"))

        logo.src = "/public/favicon.png"
        logo.alt = "Backup Google Chat Logo"
        versionImage.src = whatsNew.imageLink
        versionImage.alt = `v${whatsNew.version.number}`

        item.appendChild(document.createElement("h1")).innerText =
            `Backup Google Chat ${whatsNew.version.name} ${whatsNew.version.patch ? `Patch ${whatsNew.version.patch}` : ""}`

        const a = document.createElement("a")
        a.href = whatsNew.logLink;
        a.target = "_blank";
        a.innerText = "View update log"

        item.appendChild(document.createElement("p")).append(
            `Update name: ${whatsNew.version.name}`,
            document.createElement("br"),
            `Update number: ${whatsNew.version.number.substring(0, 3)}`,
            document.createElement("br"),
            `Patch number: ${whatsNew.version.patch}`,
            document.createElement("br"),
            `Release date: ${whatsNew.date}`,
            document.createElement("br"),
            a
        )

        item.appendChild(document.createElement("p")).innerText =
            `Credits:\n` +
            `Jason Mayer - Lead Developer\n` +
            `Felix Singer - Developer\n` +
            `Oliver Boyden - Logo Designer`

    }

    for (const value of [...Object.values(SettingsCategory), "About"].sort()) {

        const listItem = list.appendChild(document.createElement("span"))
        listItem.innerText = value;
        listItem.tabIndex = 0;

        const item = div.appendChild(document.createElement("div"))
        item.className = "item";

        categories[value] = item;

        if (value === "About")
            loadAboutPage(item);

        const listener = () => {

            for (const object of Object.values(categories))
                object.classList.remove("main")

            for (const object of list.querySelectorAll(".main"))
                object.classList.remove("main")


            item.classList.add("main")
            listItem.classList.add("main")

        }

        listItem.addEventListener("click", listener)
        listItem.addEventListener("keydown", listener)

        if ((category || "About") === value) {
            item.classList.add("main")
            listItem.classList.add("main")
        }

    }

    for (const [id, data] of Object.entries(SettingsMetaData)) {

        // get category and subcategory

        const category = categories[data.category];

        // if not yet created, create subcategory
        if (!category.querySelector(`[data-id="${data.sub}"]`)) {
            const sub = category.appendChild(document.createElement("span"))
            sub.dataset.id = data.sub;
            sub.appendChild(document.createElement("b")).innerText = data.sub
            sub.appendChild(document.createElement("br"))
        }

        const sub = category.querySelector<HTMLSpanElement>(`[data-id="${data.sub}"]`);

        // load actual option picker based on setting type

        if (isBoolItem(data)) {

            const
                label = sub.appendChild(document.createElement("label")),
                box = label.appendChild(document.createElement("input"))

            box.type = "checkbox"
            box.name = id;

            label.append(data.description)

            box.checked = get(id as keyof typeof DefaultSettings) as boolean

            box.addEventListener("input", () =>
                set(id as keyof typeof DefaultSettings, box.checked
                ))

            sub.appendChild(document.createElement("br"))

        } else {

            for (const [index, option] of data.options.entries()) {

                const
                    label = sub.appendChild(document.createElement("label")),
                    box = label.appendChild(document.createElement("input"));

                box.type = "radio";
                box.name = id;
                box.dataset.index = index.toString();

                label.append(option)

                box.checked = (get(id as keyof typeof DefaultSettings) as number) === index;

                sub.appendChild(document.createElement("br"))

                box.addEventListener("input", () =>
                    set(id as keyof typeof DefaultSettings, index)
                )

            }

        }

    }

    {
        const closeHolder = div.appendChild(document.createElement("div"))
        const close = closeHolder.appendChild(document.createElement("button"))

        closeHolder.className = "button close"

        close.innerText = "Save";
        close.addEventListener("click", () => holder.remove())

        const resetHolder = div.appendChild(document.createElement("div"))
        const reset = resetHolder.appendChild(document.createElement("button"))

        resetHolder.className = "button reset"

        reset.innerText = "Reset";
        reset.addEventListener("click", async () => {
            if (await confirm("Are you sure you want to reset all settings to the defaults?", "Reset Settings"))
                for (const name in DefaultSettings)
                    set(name as keyof typeof DefaultSettings, DefaultSettings[name]);

            open(list.querySelector<HTMLSpanElement>(".main").innerText)
            holder.remove()
        })
    }

}

const Settings = {
    get,
    open,
    set
}

export default Settings;