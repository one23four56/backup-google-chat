import { types } from "sass/types/legacy/function";
import { DefaultSettings, isBoolItem, SettingsCategory, SettingsMetaData } from "../../../ts/lib/settings"
import { confirm } from "./popups";

let settings: typeof DefaultSettings;

function loadSettings() {
    settings = DefaultSettings;
    return settings;
}

function get<Key extends keyof typeof DefaultSettings>(key: Key): typeof DefaultSettings[Key] {
    if (!settings)
        loadSettings();

    return settings[key];
}

/**
 * Sets an item in the settings and updates it on the server
 * @param key key to set
 * @param value value to set it to
 */
function set<Key extends keyof typeof DefaultSettings>(key: Key, value: typeof DefaultSettings[Key]) {

    if (!settings)
        loadSettings()

    settings[key] = value;

    // alert(`set ${key} to ${value}`)

}


function open(category?: string) {

    const holder = document.body.appendChild(document.createElement('div'))
    holder.className = "settings-holder"

    const div = holder.appendChild(document.createElement("div"))

    const list = div.appendChild(document.createElement("div"))
    list.className = "list"

    const categories: Record<string, HTMLElement> = {};

    for (const value of [...Object.values(SettingsCategory), "About"].sort()) {

        const listItem = list.appendChild(document.createElement("span"))
        listItem.innerText = value;
        listItem.tabIndex = 0;

        const item = div.appendChild(document.createElement("div"))
        item.className = "item";

        categories[value] = item;

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

        sub.appendChild(document.createElement("br"))

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
    open
}

export default Settings;