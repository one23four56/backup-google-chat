import Message from "./message.js"
import { getSetting } from './script.js'

/**
 * Makes the view corresponding to the given ID main
 * @param {string} mainViewId View to make main
 */
export const setMainView = (mainViewId) => {
    globalThis.mainViewId = mainViewId
    for (let viewId of globalThis.viewList) {
        if (viewId !== mainViewId) { document.getElementById(viewId).style.display = "none"; continue }
        else document.getElementById(mainViewId).style.display = "initial"
    }
}

/**
 * Creates a view with a given ID
 * @param {string} viewId ID of the view that will be created
 * @param {boolean} setMain If true, the view will be made main
 * @returns {HTMLDivElement} The view that has been created
 */
export const makeView = (viewId, setMain) => {
    let view = document.createElement('div')
    view.id = viewId
    view.classList.add("view")
    view.style.display = "none"

    let typing = document.createElement('div')
    typing.classList.add("typing");
    typing.style.display = "none"
    //@ts-expect-error 
    view.typing = typing
    view.appendChild(typing);

    document.body.appendChild(view)
    globalThis.viewList.push(viewId)
    if (setMain) setMainView(viewId)
    return view
}

export const setMainChannel = (mainChannelId) => {
    globalThis.mainChannelId = mainChannelId
    setMainView(mainChannelId)
}

/**
 * Creates a channel with a given ID and display name. Also creates a view to go along with said channel.
 * @param {string} channelId The ID of the channel to create
 * @param {string} dispName The channel's display name
 * @param {boolean} setMain Whether or not to make the channel main
 * @returns 
 */
export const makeChannel = (channelId, dispName, setMain) => {
    if (setMain) globalThis.mainChannelId = channelId
    let channel = {
        id: channelId,
        name: dispName,
        view: makeView(channelId, setMain),
        typingUsers: [],
        msg: {
            /**
             * Handles a message.
             * @param data Message data
             */
            main: (data) => {
                if (Notification.permission === 'granted' && data.author.name === globalThis.me.name && !data.mute && getSetting('notification', 'desktop-enabled'))
                    new Notification(`${data.author.name} (${dispName} on Backup Google Chat)`, {
                        body: data.text,
                        icon: data.author.img,
                        silent: document.hasFocus(),
                    })

                document.querySelector<HTMLLinkElement>('link[rel="shortcut icon"]').href = '/public/alert.png'
                clearTimeout(globalThis.timeout)
                globalThis.timeout = setTimeout(() => {
                    document.querySelector<HTMLLinkElement>('link[rel="shortcut icon"]').href = '/public/favicon.png'
                }, 5000);

                let message = new Message(data, channelId)
                let msg = message.msg

                const scrolledToBottom =
                    Math.abs(document.getElementById(channelId).scrollHeight - document.getElementById(channelId).scrollTop - document.getElementById(channelId).clientHeight) <= 200

                msg.setAttribute('data-message-index', data.index);
                if (!data.mute && getSetting('notification', 'sound-message')) document.querySelector<HTMLAudioElement>("#msgSFX").play()
                document.getElementById(channelId).appendChild(msg)
                if (getSetting('notification', 'autoscroll-on'))
                    document.getElementById(channelId).scrollTop = document.getElementById(channelId).scrollHeight
                else if (getSetting('notification', 'autoscroll-smart') && scrolledToBottom)
                    document.getElementById(channelId).scrollTop = document.getElementById(channelId).scrollHeight
                msg.style.opacity = 1
                globalThis.channels[channelId].messageObjects.push(message)
            },
            /**
             * Is called along with main() when the channel is not main
             * @param data Message data
             */
            secondary: (data) => {
                console.warn(`A secondary handler has not been defined for channel ${channelId}`)
            },
            /**
             * Calls the main messages handler, and the secondary one if the channel is not main
             * @param data Message data
             */
            handle: (data) => {
                if (globalThis.mainChannelId && globalThis.mainChannelId === channelId) channel.msg.main(data);
                else { channel.msg.main(data); channel.msg.secondary(data) };
            },
            /**
             * The same as the main message handler, except the messages get appended to the top of the content box and there are no notifications possible.
             * @param data Message data
             */
            appendTop: (data) => {
                let message = new Message(data, channelId, false)
                let msg = message.msg
                document.getElementById(channelId).prepend(msg)
                msg.style.opacity = 1
                globalThis.channels[channelId].messageObjects.unshift(message) // appends message to beginning of array
            },
            /**
             * Displays when a user is typing
             * @param {string} name Name of the user that is typing
             * @returns {Function} Function to call to remove the typing indicator 
             */
            typing: (name) => {
                const channel = globalThis.channels[channelId];
                const view = channel.view;

                const scrollDown =
                    Math.abs(document.getElementById(channelId).scrollHeight - document.getElementById(channelId).scrollTop - document.getElementById(channelId).clientHeight) <= 3

                channel.typingUsers.push(name)

                view.style.height = "81%";
                view.style.paddingBottom = "3%";

                view.typing.style.display = "block";

                if (scrollDown) view.scrollTop = view.scrollHeight;

                if (channel.typingUsers.length === 1)
                    view.typing.innerHTML = `${channel.typingUsers.toString()} is typing`;
                else
                    view.typing.innerHTML = `${channel.typingUsers.join(', ')} are typing`;

                return () => {
                    channel.typingUsers = channel.typingUsers.filter(user => user !== name)

                    if (channel.typingUsers.length === 1)
                        view.typing.innerHTML = `${channel.typingUsers.toString()} is typing...`;
                    else
                        view.typing.innerHTML = `${channel.typingUsers.join(', ')} are typing...`;


                    if (channel.typingUsers.length === 0) {
                        view.typing.style.display = "none";
                        view.style.height = "83%";
                        view.style.paddingBottom = "1%";
                    }
                }

            }
        },
        /**
         * Clears every message in the given channel.
        */
        clearMessages: () => {
            document.getElementById(channelId).innerHTML = '';
        },
        messages: [],
        messageObjects: []
    }
    globalThis.channels[channelId] = channel
    return channel
}