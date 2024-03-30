import { DefaultSettings, isBoolItem, SettingsCategory, SettingsMetaData } from "../../../ts/lib/settings"
import { confirm } from "./popups";
import { blocklist, closeDialog, me, socket } from "./script";
import UpdateData from '../../../update.json';
import userDict from "./userDict";
import { searchUsers } from "./ui";

let settings: typeof DefaultSettings = await fetch('/me/settings').then(r => r.json())

const root = document.querySelector(":root")

function update() {
    root.classList.remove("light", "dark", "ukraine");
    root.classList.add(["light", "dark", "ukraine"][settings.theme]);

    root.classList.remove("fit-all", "fit-width", "fit-height");
    root.classList.add(["fit-all", "fit-height"][settings["image-display"]]);

    root.classList.remove("animated-messages");
    settings["animate-new-messages"] && root.classList.add("animated-messages");

    root.classList.remove("hide-invites");
    settings["show-invites-on-sidebar"] || root.classList.add("hide-invites");

    root.classList.remove("hide-offline");
    settings["show-offline-on-sidebar"] || root.classList.add("hide-offline");

    root.classList.remove("bordered", "borderless");
    root.classList.add(["bordered", "borderless"][settings["site-style"]]);

    root.classList.remove("animated-popups")
    settings["animate-popups"] && root.classList.add("animated-popups");

    root.classList.remove("ignore-inactive", "gray-inactive", "hide-inactive")
    root.classList.add(["ignore-inactive", "gray-inactive", "hide-inactive"][settings["inactive-users"]])

    root.classList.remove("hide-send");
    settings["send-button"] || root.classList.add("hide-send");

    root.classList.remove("hide-tips");
    settings["show-tips"] || root.classList.add("hide-tips");

}

update();

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

    update();
    userDict.syntheticChangeAll();
}

/**
 * Open the settings popup
 * @param category optional category to open to
 */
function open(category?: string) {

    const div = document.body.appendChild(document.createElement("dialog"));
    div.classList.add("settings-menu")
    div.showModal();

    const list = div.appendChild(document.createElement("div"))
    list.className = "list"

    const categories: Record<string, HTMLElement> = {};

    const loadAccountPage = (item: HTMLDivElement) => {
        item.classList.add("account");

        item.appendChild(document.createElement("img")).src = me.img;
        item.appendChild(document.createElement("h1")).innerText = me.name;
        item.appendChild(document.createElement("h2")).innerText = me.email;

        {
            const holder = item.appendChild(document.createElement("div"));
            const
                securityLink = holder.appendChild(document.createElement("a")),
                security = securityLink.appendChild(document.createElement("button"));

            security.innerText = "Account Security";
            securityLink.href = "/security";
            securityLink.target = "_blank";

            const profile = holder.appendChild(document.createElement("button"));
            profile.innerText = "Manage Profile";
            profile.addEventListener("click", () => {
                closeDialog(div);
                userDict.generateUserCard(me).showModal();
            })
        }

        item.appendChild(document.createElement("hr"));

        item.appendChild(document.createElement('h3')).innerText = `You have blocked ${blocklist[0].length} ${blocklist[0].length === 1 ? "person" : "people"}`

        {
            const
                holder = item.appendChild(document.createElement("div")),
                add = holder.appendChild(document.createElement("button")),
                remove = holder.appendChild(document.createElement("button"));

            add.innerText = "Block Someone"
            remove.innerText = "Unblock Someone"

            add.addEventListener("click", async () => {
                closeDialog(div);
                searchUsers({
                    title: "Block Someone",
                    excludeList: blocklist[0]
                }).then(async data => {
                    if (await confirm(`Are you sure you want to block ${data.name}?`, `Block ${data.name}?`)) {
                        socket.emit("block", data.id, true);
                        blocklist[0].push(data.id)
                    }
                    open();
                }).catch(() => open());
            })

            remove.addEventListener("click", () => {
                closeDialog(div);
                searchUsers({
                    title: "Unblock Someone",
                    includeList: blocklist[0]
                }).then(async data => {
                    if (await confirm(`Are you sure you want to unblock ${data.name}?`, `Unblock ${data.name}?`)) {
                        socket.emit("block", data.id, false);
                        blocklist[0] = blocklist[0].filter(i => i !== data.id);
                    }
                    open();
                }).catch(() => open());
            })
        }

        item.appendChild(document.createElement("hr"));

        item.appendChild(document.createElement("p")).innerText = `Backup Google Chat v${UpdateData.version.number} (${UpdateData.version.name})`
    }

    for (const value of ["Account", ...Object.values(SettingsCategory)]) {

        const listItem = list.appendChild(document.createElement("span"))
        listItem.innerText = value;
        listItem.tabIndex = 0;

        const item = div.appendChild(document.createElement("div"))
        item.className = "item";

        categories[value] = item;

        if (value === "Account")
            loadAccountPage(item);

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

        if ((category || "Account") === value) {
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
        close.addEventListener("click", () => closeDialog(div))

        const resetHolder = div.appendChild(document.createElement("div"))
        const reset = resetHolder.appendChild(document.createElement("button"))

        resetHolder.className = "button reset"

        reset.innerText = "Reset";
        reset.addEventListener("click", async () => {
            if (await confirm("Are you sure you want to reset all settings to the defaults?", "Reset Settings")) {
                for (const name in DefaultSettings)
                    set(name as keyof typeof DefaultSettings, DefaultSettings[name]);

                open(list.querySelector<HTMLSpanElement>(".main").innerText)
                closeDialog(div);
            }
        })
    }

}

export default {
    get,
    open,
    set
}
