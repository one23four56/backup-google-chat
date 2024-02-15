/**
 * All things related to the home page go here
 */
import { BasicInviteFormat } from "../../../ts/modules/invites";
import Channel, { channelReference } from "./channels";
import { sideBarAlert } from "./popups";
import { formatRelativeTime } from "./script";
import { title } from "./title";
import { openInviteMenu } from "./ui";

/**
 * Home page notification manager
 */
export namespace notifications {

    let notifications: [
        string,
        string,
        number,
        'emoji' | 'image' | 'icon',
        string,
        (ev: MouseEvent) => void | undefined
    ][] = [];

    let changeArray: (() => void)[] = [];

    let invites: string[] = [];

    setInterval(() => changeArray.forEach(i => i()), 1000 * 60)

    /**
     * sets the notifications on the home page for a channel
     * @param channel channel to set notifications for
     */
    export function setFor(channel: Channel) {

        notifications = notifications.filter(([id]) => id !== channel.id);

        const unread = channel.mostRecentMessage - (channel.lastReadMessage ?? 0)

        if (unread === 0)
            return update();

        const isDM = typeof (channel as any).userData !== "undefined"

        notifications.push([
            channel.id,
            `${unread} new message${unread === 1 ? "" : "s"} ${isDM ? 'from' : 'in'} ${isDM ? (channel as any).userData.name : channel.name}`,
            channel.time,
            isDM ? 'image' : 'emoji',
            isDM ? (channel as any).userData.img : (channel as any).emoji,
            () => {
                if (channelReference[channel.id])
                    channelReference[channel.id].makeMain()
            }
        ])

        notifications.sort((a, b) => b[2] - a[2])

        update();

    }

    function update() {

        clear();

        for (const [_id, content, time, iconType, icon, onclick] of notifications) {

            const div = document.querySelector("no-channel-background > div.notifications > div")
                .appendChild(document.createElement("div"));

            div.className = "channel-notification";

            if (iconType === "image")
                div.appendChild(document.createElement("img")).src = icon;
            else if (iconType === "emoji")
                div.appendChild(document.createElement("span")).innerText = icon;
            else
                div.appendChild(document.createElement("i")).className = icon;

            const text = div.appendChild(document.createElement("span"))
            text.innerText = content;
            text.className = "text"

            const timeDisplay = div.appendChild(document.createElement("span"))
            timeDisplay.className = "time"
            setTimeUpdate(timeDisplay, time)

            if (onclick)
                div.addEventListener("click", onclick)

        }

        if (notifications.length === 0)
            document.querySelector("no-channel-background > div.notifications > div")
                .appendChild(document.createElement("p"))
                .innerText = "You have no notifications"

    }

    function clear() {
        document.querySelector<HTMLDivElement>("no-channel-background > div.notifications > div")
            .innerText = ""

        changeArray = [];
    }

    function setTimeUpdate(element: HTMLSpanElement, time: number) {

        const change = () => element.innerText = formatRelativeTime(time, true);

        change();

        changeArray.push(change)

    }

    /**
     * Adds an invite to the notification menu on the home screen
     * @param invite invite to add
     */
    export function addInvite(invite: BasicInviteFormat) {

        if (!notifications.find(([id]) => id === invite.id))
            sideBarAlert(`You have a new invite from ${invite.from.name}`, 4000)

        notifications = notifications.filter(([id]) => id !== invite.id);
        invites = invites.filter(id => id !== invite.id);

        title.setNotifications(invite.id, 1);

        notifications.push([
            invite.id,
            invite.message,
            invite.time ?? 0,
            "icon",
            "fa-solid fa-envelope fa-beat",
            () => openInviteMenu(invite)
        ])

        notifications.sort((a, b) => b[2] - a[2])

        invites.push(invite.id);

        update();

    }

    /**
     * Removes an invite from the notification list
     * @param id id of the invite to remove
     */
    export function removeInvite(id: string) {

        notifications = notifications.filter(i => i[0] !== id);
        invites = invites.filter(i => i !== id);

        title.setNotifications(id, 0)

        update();

    }

    /**
     * Removes a channel from the notification list
     * @param channelId Channel ID to remove
     */
    export function removeChannel(channelId: string) {
        notifications = notifications.filter(([id]) => id !== channelId);
        update();
    }

    /**
     * Clears all invites from the notification list
     */
    export function clearInvites() {
        invites.forEach(i => removeInvite(i));
    }

    update();

}