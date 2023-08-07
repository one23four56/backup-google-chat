/**
 * userDict (user dictionary) uses reactive containers for state management 
 * of user data on the client side
 */
import ReactiveContainer from "./reactive";
import { OnlineStatus, OnlineUserData, UserData } from '../../../ts/lib/authdata';
import DM from './dms';
import SideBar, { SideBarItem, SideBars } from "./sideBar";
import { formatRelativeTime, me, socket } from "./script";
import { getCurrentPeriod, getElapsedPeriods, setRepeatedUpdate } from "./schedule";
import { openScheduleSetter, openStatusSetter } from "./ui";
import { confirm } from './popups'

export interface UserDictData {
    userData: OnlineUserData;
    dm?: DM;
    unread?: boolean;
}

const userDict = new Map<string, ReactiveContainer<UserDictData>>();

/**
 * Get user dict data
 * @param id Id of user to get
 * @returns User dict data
 */
function getData(id: string): UserDictData | undefined {
    return userDict.get(id)?.data;
}

/**
 * Get raw use dict data inside a ReactiveContainer
 * @param id ID of user to get
 * @returns ReactiveContainer with data
 */
function get(id: string) {
    return userDict.get(id);
}

/**
 * Sets data on the user dict, override what was previously there
 * @param id ID of user to set
 * @param data Data to set to
 */
function set(id: string, data: UserDictData) {
    const container = userDict.get(id);

    if (container)
        container.data = data;
    else
        userDict.set(id, new ReactiveContainer(data))
}

/**
 * Sets part of a user's data on the user dict, keeping the rest
 * @param id ID of the user to set
 * @param part Part of the UserDictData to set
 * @param data Data to set
 */
function setPart<part extends keyof UserDictData>(id: string, part: part, data: UserDictData[part]) {
    const container = userDict.get(id);

    if (container) {
        const item = container.data;
        item[part] = data;

        container.data = item;
    } else throw new Error(
        `Cannot set part "${part}" of user ${id} since user is not in the user dict`
    )

}

/**
 * Checks whether or not a user is on the user dict
 * @param id ID to check
 * @returns Whether or not that user is on the user dict
 */
function has(id: string): boolean {
    return userDict.has(id);
}

/**
 * Shorthand for set/setPart. See important notes below:  
 * If data for a user does not exist, creates it  
 * If data does exist, **it will only override it if override is true!!!**  
 * *This only changes userData. For any other data, you must use set/setPart*
 * @param userData UserData to update to
 * @param override Whether or not to override old data (default: false)
 */
function update(userData: OnlineUserData, override: boolean = false) {

    if (!has(userData.id))
        set(userData.id, { userData })
    else if (override)
        setPart(userData.id, "userData", userData)

}

/**
 * Generates a user sidebar item. Replacement for `getUserSideBarItem()` that uses
 * [reactive containers](./reactive.ts) + [userDict](./userDict.ts) for state management
 * @param id ID of user to generate the item for
 * @param forDM *don't touch this!* true to allow sorting and override default user card behavior
 * @returns A user sidebar item
 */
function generateItem(id: string, forDM: boolean = false): SideBarItem {

    const container = get(id);

    if (!container)
        throw new Error(`No entry for user ${id} in user dict`)

    const { userData, dm, unread } = container.data;

    const icon: string = userData.id === me.id ?
        `fa-regular fa-face-smile` : dm ?
            `fa-regular fa-comment` : `fa-solid fa-user-plus`

    const schedule: { span: HTMLSpanElement, stop?: () => void } = {
        span: (() => {
            const holder = document.createElement("span")
            holder.innerText = userData.online

            return holder;
        })()
    };

    if (userData.schedule) {
        const span = document.createElement("span")
        schedule.span.appendChild(span)

        schedule.stop = setRepeatedUpdate(userData.schedule, span)
    }

    const item = SideBar.createImageItem({
        image: userData.img,
        title: userData.name,
        emoji: userData.status ? userData.status.char : undefined,
        subTitle: schedule.span,
        icon,
        clickEvent: () => {
            // if (dm) {
            //     dm.makeMain()
            //     // left.collapseIfMobile();
            // }
            // else if (userData.id !== me.id)
            //     confirm(`You do not have a direct message conversation with ${userData.name}. Would you like to start one?`, `Start Direct Message Conversation?`).then(res => {
            //         if (res)
            //             socket.emit("start dm", userData.id)
            //     })
            // else
            //     openStatusSetter()

            // if (forDM)
            //     dm.makeMain();
            // else
            generateUserCard(userData, dm).showModal();

        }
    })

    if (userData.status)
        item.title = userData.status.status

    if (forDM) {
        item.dataset.channelId = dm.id;
        SideBars.right.collections["dms"].updateOrderItem(item, dm.id)
    }

    if (unread)
        item.classList.add("unread")

    switch (userData.online) {
        case OnlineStatus.online:
            item.classList.add("online");
            break;
        case OnlineStatus.offline:
            item.classList.add("offline");
            break;
        case OnlineStatus.idle:
            item.classList.add("idle");
            break;
        case OnlineStatus.active:
            item.classList.add("active");
            break;
        default:
            item.classList.add("offline");
    }

    item.dataset.userId = userData.id

    const remove = container.onChange(() => {
        schedule.stop && schedule.stop();
        item.replaceWith(generateItem(id, forDM));
        remove();
    })

    return item;
}

function generateUserCard(userData: UserData | OnlineUserData, dm?: DM) {

    const dialog = document.body.appendChild(document.createElement("dialog"));
    dialog.className = "user-card";

    dialog.appendChild(document.createElement("img")).src = userData.img;
    dialog.appendChild(document.createElement("h1")).innerText = userData.name;

    const p = dialog.appendChild(document.createElement("p")), online = p.appendChild(document.createElement("span"));

    if ("online" in userData && userData.id !== me.id) {
        online.classList.add("online-status", userData.online.toLowerCase());
        online.innerText = userData.online;

        if (userData.online === OnlineStatus.offline && userData.lastOnline)
            p.append(`Last online ${formatRelativeTime(userData.lastOnline)}. `);
    } else if (me.id === userData.id) {
        online.innerText = "YOU";
        online.classList.add("blue");
    }

    if (userData.schedule && typeof getCurrentPeriod() === "number")
        p.append(`Currently in ${userData.schedule[getCurrentPeriod()]}.`)

    if (userData.status) {

        const status = dialog.appendChild(document.createElement("div"));
        status.className = "status"

        status.appendChild(document.createElement("span")).innerText = userData.status.char;
        status.appendChild(document.createElement("span")).innerText = userData.status.status;

    }

    if (userData.schedule) {

        const schedule = dialog.appendChild(document.createElement("div"));
        schedule.className = "schedule"

        for (const [index, item] of userData.schedule.entries()) {
            const span = schedule.appendChild(document.createElement("span"));
            span.innerText = `Period ${index + 1} - ${item}`;

            if (index === getCurrentPeriod()) {
                span.appendChild(document.createElement("i")).className = "fa-solid fa-caret-left";
                span.classList.add("current");
            } else if (index < getElapsedPeriods()) {
                span.appendChild(document.createElement("i")).className = "fa-solid fa-check";
                span.classList.add("done");
            }
        }


    }

    const actions = dialog.appendChild(document.createElement("div"));
    actions.className = "actions";

    // action 1
    {
        const action = actions.appendChild(document.createElement("button"));

        if (me.id !== userData.id) {
            action.appendChild(document.createElement("i"))
                .className = dm ? "fa-regular fa-comment" : "fa-solid fa-user-plus";

            action.append(`${dm ? "C" : "Start c"}hat`)

            action.addEventListener("click", () => {
                if (dm) {
                    dm.makeMain()
                    return dialog.close();
                };

                dialog.close()
                confirm(`Your chat with ${userData.name} will begin if they accept.`, `Send invite?`).then(c => {
                    if (c) socket.emit("start dm", userData.id)
                    generateUserCard(userData, dm).showModal();
                })
            })
        } else {
            action.appendChild(document.createElement("i")).className = "fa-solid fa-user-pen";
            action.append(`Update status`)
            action.addEventListener("click", () => {
                dialog.close();
                openStatusSetter().then(status =>
                    generateUserCard({ ...getData(me.id).userData, status }, dm).showModal()
                );
            })
        }
    }

    // action 2
    {
        const action = actions.appendChild(document.createElement("button"))

        if (me.id !== userData.id) {
            action.appendChild(document.createElement("i")).className = "fa-solid fa-ban";
            action.append(`Block`)
            action.classList.add("red")
        } else {
            action.appendChild(document.createElement("i")).className = "fa-solid fa-calendar-days";
            action.append(`Update schedule`)
            action.addEventListener("click", () => {
                dialog.close();
                openScheduleSetter().then(schedule =>
                    generateUserCard({ ...getData(me.id).userData, schedule }).showModal()
                );
            })
        }
    }

    // close
    {
        const close = dialog.appendChild(document.createElement("button"));
        close.className = "close";
        close.appendChild(document.createElement("i")).className = "fa-solid fa-xmark";
        close.append("Close")
        close.addEventListener("click", () => dialog.close())
    }

    dialog.addEventListener("close", () => dialog.remove())

    return dialog;

}

export default {
    get,
    getData,
    set,
    setPart,
    has,
    generateItem,
    generateUserCard,
    update
}