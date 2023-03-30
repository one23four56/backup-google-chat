/**
 * All things related to the home page go here
 */
import Channel, { channelReference } from "./channels";

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
            `${unread} new messages ${isDM ? 'from' : 'in'} ${isDM ? (channel as any).userData.name : channel.name}`,
            channel.time,
            isDM ? 'image' : 'emoji',
            isDM ? (channel as any).userData.img : (channel as any).emoji,
            () => {
                if (channelReference[channel.id])
                    channelReference[channel.id].makeMain()
            }
        ])

        notifications.sort((a, b) => b[2] - a[2])
        console.log(notifications)

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

        const change = () => {

            const
                dif = time - Date.now(),
                // copy and pasted from polls.ts lol
                // a little bit was changed tho
                formatter = new Intl.RelativeTimeFormat('en-US', {
                    style: 'narrow',
                }),
                units = Object.entries({
                    year:   1000 * 60 * 60 * 24 * 365, // i doubt this will ever happen
                    month:  1000 * 60 * 60 * 24 * 30,  // even this is stretching it
                    week:   1000 * 60 * 60 * 24 * 7,
                    day:    1000 * 60 * 60 * 24,
                    hour:   1000 * 60 * 60,
                    minute: 1000 * 60
                });


            const ending = Math.abs(dif) < 1000 * 60 ? 'now' : (function getEnding(index: number): string {
                if (Math.abs(dif) > units[index][1] || index >= 5) // index >= 3 stops infinite loop
                    return formatter.format(Math.trunc(dif / units[index][1]), units[index][0] as any);

                return getEnding(index + 1);
            })(0)

            element.innerText = ending;

        }

        change();

        changeArray.push(change)

    }

    update();

}