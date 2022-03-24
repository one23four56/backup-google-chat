const socket = io();
globalThis.viewList = []
globalThis.channels = {}

let
    messageCount = 0,
    inMessageCoolDown = false;

if (Notification.permission !== 'granted' && Notification.permission !== 'blocked') {
    Notification.requestPermission()
}

/**
 * Makes the view corresponding to the given ID main
 * @param {string} mainViewId View to make main
 */
const setMainView = (mainViewId) => {
    globalThis.mainViewId = mainViewId
    for (let viewId of globalThis.viewList) {
        if (viewId!==mainViewId) {document.getElementById(viewId).style.display="none";continue}
        else document.getElementById(mainViewId).style.display = "initial"
    }
}

/**
 * Creates a view with a given ID
 * @param {string} viewId ID of the view that will be created
 * @param {boolean} setMain If true, the view will be made main
 * @returns {HTMLDivElement} The view that has been created
 */
const makeView = (viewId, setMain) => {
    let view = document.createElement('div')
    view.id = viewId
    view.classList.add("view")
    view.style.display = "none"
    document.body.appendChild(view)
    globalThis.viewList.push(viewId)
    if (setMain) setMainView(viewId) 
    return view
}

const setMainChannel = (mainChannelId) => {
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
const makeChannel = (channelId, dispName, setMain) => {
    if (setMain) globalThis.mainChannelId = channelId
    let channel = {
        id: channelId, 
        name: dispName,
        view: makeView(channelId, setMain),
        msg: {
            /**
             * Handles a message.
             * @param data Message data
             */
            main: (data) => {
                if (Notification.permission === 'granted' && document.cookie.indexOf(data.author.name) === -1 && !data.mute && getSetting('notification', 'desktop-enabled'))
                    new Notification(`${data.author.name} (${dispName} on Backup Google Chat)`, {
                        body: data.text,
                        icon: data.author.img,
                        silent: document.hasFocus(),
                    })

                document.querySelector('link[rel="shortcut icon"]').href = '/public/alert.png'
                clearTimeout(globalThis.timeout)
                globalThis.timeout = setTimeout(() => {
                    document.querySelector('link[rel="shortcut icon"]').href = '/public/favicon.png'
                }, 5000);

                let message = new Message(data, channelId)
                let msg = message.msg
                msg.setAttribute('data-message-index', data.index);
                if (!data.mute && getSetting('notification', 'sound-message')) document.getElementById("msgSFX").play()
                document.getElementById(channelId).appendChild(msg)
                if (getSetting('notification', 'autoscroll')) document.getElementById(channelId).scrollTop = document.getElementById(channelId).scrollHeight
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
                else {channel.msg.main(data);channel.msg.secondary(data)};
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
            }
         },
        messages: [],
        messageObjects: []
    }
    globalThis.channels[channelId] = channel
    return channel
}

/**
 * Creates a popup on the sidebar with a given icon and text, that expires after a given time
 * @param {string} msg The message to display
 * @param {string} icon The icon to go along with the message
 * @param {number?} expires The time until the popup goes away (null for never)
 * @returns {()=>void} A function that removes the popup
 */
const sidebar_alert = (msg, expires, icon = "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png") => {
    let alert = document.getElementById("alert").cloneNode()
    let text = document.createElement("p")
    let img = document.createElement("img")
    text.innerText = msg
    img.src = icon
    alert.appendChild(img)
    alert.appendChild(text)
    alert.style.visibility = 'initial'
    document.getElementById("sidebar_alert_holder").appendChild(alert)
    let expire = () => alert.remove()
    if (expires) setTimeout(expire, expires);
    return expire
}

/**
 * Loads the settings from local storage. If they are not set, it sets them to the defaults and retries.
 */
const loadSettings = async () => {
    if (!localStorage.getItem("settings")) {
        const request = await fetch("/public/defaults.json")
        const defaults = await request.text()
        localStorage.setItem("settings", defaults)
        loadSettings()
    } else {
        let settings = JSON.parse(localStorage.getItem("settings"))
        for (const name in settings) {
            if (!document.getElementById(name)) continue
            document.getElementById(name).checked = settings[name]
        }
    }
}

/**
 * Gets a setting that the user set.
 * @param {string} category The name of the category that the setting is in
 * @param {string} setting The name of the setting
 * @returns {boolean} The value of the setting
 */
const getSetting = (category, setting) => {
    if (!localStorage.getItem("settings")) loadSettings().then(_=>getSetting())
    else {
        const settings = JSON.parse(localStorage.getItem("settings"))
        return settings[`${category}-settings-${setting}`]
    }
}

window.alert = (content, title) => {
    let alert = document.querySelector("div.alert-holder[style='display:none;']").cloneNode(true)
    let h1 = document.createElement("h1")
    h1.innerText = title || "Alert"
    let p = document.createElement("p")
    p.innerText = content
    let button = document.createElement("button")
    button.innerText = "OK"
    button.onclick = () => alert.remove()
    alert.firstElementChild.appendChild(h1)
    alert.firstElementChild.appendChild(p)
    alert.firstElementChild.appendChild(button)
    alert.style.display = "flex"
    document.body.appendChild(alert)
}

window.confirm = (content, title, result) => {
    let alert = document.querySelector("div.alert-holder[style='display:none;']").cloneNode(true)
    let h1 = document.createElement("h1")
    h1.innerText = title || "Confirm"
    let p = document.createElement("p")
    p.innerText = content
    let yes = document.createElement("button")
    yes.innerText = "YES"
    yes.style = "width:49%;--bg-col:#97f597;"
    let no = document.createElement("button")
    no.innerText = "NO"
    no.style = "width:49%;margin-left:51%;;--bg-col:#f78686;"
    yes.onclick = () => {alert.remove();result(true)}
    no.onclick = () => {alert.remove();result(false)}
    alert.firstElementChild.appendChild(h1)
    alert.firstElementChild.appendChild(p)
    alert.firstElementChild.appendChild(yes)
    alert.firstElementChild.appendChild(no)
    alert.style.display = "flex"
    document.body.appendChild(alert)
}

window.prompt = (content, title = "Prompt", defaultText = "", charLimit = 50) => {
    let alert = document.querySelector("div.alert-holder[style='display:none;']").cloneNode(true)
    let h1 = document.createElement("h1")
    h1.innerText = title
    let p = document.createElement("p")
    p.innerText = content
    let text = document.createElement('input')
    text.type = "text"
    text.value = defaultText
    if (charLimit) text.maxLength = charLimit
    let yes = document.createElement("button")
    yes.innerText = "OK"
    yes.style = "width:49%;--bg-col:#97f597;"
    let no = document.createElement("button")
    no.innerText = "CANCEL"
    no.style = "width:49%;margin-left:51%;;--bg-col:#f78686;"
    alert.firstElementChild.appendChild(h1)
    alert.firstElementChild.appendChild(p)
    alert.firstElementChild.appendChild(text)
    alert.firstElementChild.appendChild(yes)
    alert.firstElementChild.appendChild(no)
    alert.style.display = "flex"
    document.body.appendChild(alert)
    text.focus()
    return new Promise((resolve, reject) => {
        yes.onclick = () => { alert.remove(); resolve(text.value) }
        no.onclick = () => { alert.remove(); reject() }
    })
}

fetch(`/archive.json?reverse=true&start=0&count=50`, {
    headers: {
        'cookie': document.cookie
    }
}).then(res=>{
    if (!res.ok) {alert("Error loading previous messages");return}
    res.json().then(messages=>{
        messageCount += messages.length;
        for (let data of messages.reverse()) {
            if (data?.tag?.text==="DELETED") continue
            data.mute = true
            globalThis.channels.content.msg.handle(data);
        }
        document.getElementById("connectbutton").innerText = "Continue"
        document.getElementById("connectbutton").addEventListener('click', _ => {
                    document.getElementById("connectdiv-holder").removeEventListener('click', this)
                    document.getElementById("connectdiv-holder").remove()
        })
    })
}).catch(_=>alert("Error loading previous messages"))

document.getElementById("attach-image").addEventListener('click', _ => {
    document.getElementById("image-box").style.display = "flex";
    document.getElementById("attached-image-preview").setAttribute('hidden', true)
});

document.getElementById("send").addEventListener('submit', event => {
    event.preventDefault()
    const formdata = new FormData(document.getElementById("send"))
    document.getElementById("text").value = ""
    if (globalThis.messageToEdit) {
        socket.emit('edit-message', {
            messageID: globalThis.messageToEdit, 
            text: formdata.get('text').trim()
        })
        delete globalThis.messageToEdit
        document.getElementById('profile-pic-display').src = document.getElementById('profile-pic-display').getAttribute('data-old-src')
    } else if (globalThis.selectedWebhookId) {
        if (globalThis.mainChannelId!=="content") {alert("Webhooks are currently not supported in DMs", "Error");return}
        socket.emit('send-webhook-message', {
            data: {
                id: globalThis.selectedWebhookId,
                text: formdata.get('text').trim(),
                archive: document.getElementById('save-to-archive').checked,
                image: sessionStorage.getItem("attached-image-url")
            }
        });
    } else {
        socket.emit('message', {
            text: formdata.get('text').trim(),
            archive: document.getElementById('save-to-archive').checked,
            image: sessionStorage.getItem("attached-image-url"),
            recipient: globalThis.mainChannelId === 'content' ? 'chat' : globalThis.mainChannelId
        }, data => {
            data.mute = getSetting('notification', 'sound-send-message')? false : true
            if (data.channel && data.channel.to === 'chat') globalThis.channels.content.msg.handle(data);
            else globalThis.channels[data.channel.to].msg.handle(data);
        })
    }
    sessionStorage.removeItem("attached-image-url");
    document.getElementById("attached-image-preview").setAttribute('hidden', true)
    document.getElementById("image-box-display").src = "";
})

makeChannel("content", "Main", true);

let flash_interval;
globalThis.channels.content.msg.secondary = (data) => {
    clearInterval(flash_interval)
    flash_interval = setInterval(() => {
        document.querySelector('#chat-button i').className = "far fa-comments fa-fw"
        setTimeout(() => {
            document.querySelector('#chat-button i').className = "fas fa-comments fa-fw"
        }, 500);
    }, 1000);
    document.getElementById("chat-button").addEventListener('click', () => {
        clearInterval(flash_interval)
        document.querySelector('#chat-button i').className = "fas fa-comments fa-fw"
    }, {
        once: true
    })
}

socket.on('incoming-message', data => {
    if (data.channel && data.channel.to === 'chat') {
        globalThis.channels.content.msg.handle(data);
        messageCount++;
    }

    else if (data.channel) globalThis.channels[data.channel.origin].msg.handle(data);
    else {globalThis.channels.content.msg.handle(data);console.warn(`${data.id? `Message #${data.id}` : `Message '${data.text}' (message has no id)`} has no channel. It will be displayed on the main channel.`)};
})

socket.on('onload-data', data => {
    if (data.userName !== document.cookie.match('(^|;)\\s*' + "name" + '\\s*=\\s*([^;]+)')?.pop() || '') return;

    sessionStorage.removeItem("attached-image-url");
    if (document.getElementById("webhook-options")) document.getElementById("webhook-options").innerHTML = "";

    sessionStorage.setItem("profile-pic", data.image);

    let profilePicDisplay = document.getElementById("profile-pic-display");
    profilePicDisplay.src = data.image;
    profilePicDisplay.style.display = "block";

    document.getElementById("header-profile-picture").src = data.image;

    profilePicDisplay.onclick = e => {
        if (globalThis.messageToEdit) return;
        let webhookOptionsDisplay = document.getElementById("webhook-options");
        webhookOptionsDisplay.style.display = webhookOptionsDisplay.style.display == "block" ? "none" : "block";
    };

    {
        let elmt = document.createElement("div");
        elmt.classList.add("webhook-option");
        elmt.setAttribute("data-type", "user");

        let imageDisp = document.createElement("img");
        imageDisp.src = data.image;
        imageDisp.alt = data.name + " (Icon)";
        elmt.appendChild(imageDisp);

        let nameDisp = document.createElement("h2");
        nameDisp.innerText = data.name;
        elmt.appendChild(nameDisp);

        elmt.addEventListener('click', e => {
            delete globalThis.selectedWebhookId
            document.getElementById('text').placeholder = "Enter a message...";
            document.getElementById("webhook-options").style.display = "none";
            document.getElementById("profile-pic-display").src = data.image;
        });

        document.getElementById("webhook-options").appendChild(elmt);
    }

    if (data.webhooks.length >= 5) document.getElementById("webhook-options").style["overflow-y"] = "scroll";

    for (option of data.webhooks) {
        let elmt = document.createElement("div");
        elmt.classList.add("webhook-option");
        elmt.setAttribute("data-type", "webhook");
        elmt.setAttribute("data-webhook-id", option.id);
        elmt.setAttribute("data-image-url", option.image);
        elmt.setAttribute("data-webhook-name", option.name);

        let imageDisp = document.createElement("img");
        imageDisp.src = option.image;
        imageDisp.alt = option.name + " (Icon)";
        elmt.appendChild(imageDisp);

        let nameDisp = document.createElement("h2");
        nameDisp.innerText = option.name + " (Bot)";
        elmt.appendChild(nameDisp);

        let optionsDisp = document.createElement("div");
        optionsDisp.classList.add("options");

        let editOption = document.createElement("i");
        editOption.className = "far fa-edit fa-fw"
        editOption.onclick = _ => {
            prompt('What do you want to rename the webhook to?', 'Rename Webhook', elmt.getAttribute('data-webhook-name'), 25).then(name=>{
                prompt('What do you want to change the webhook avatar to?', 'Change Avatar', elmt.getAttribute('data-image-url'), false).then(avatar=>{
                    let webhookData = {
                        oldName: elmt.getAttribute('data-webhook-name'),
                        newName: name,
                        newImage: avatar,
                    };
                    socket.emit('edit-webhook', { webhookData });
                })
                .catch()
            })
            .catch()
        }

        let copyOption = document.createElement("i");
        copyOption.className = "far fa-copy fa-fw"
        copyOption.onclick = _ => {
            navigator.clipboard.writeText(`${location.origin}/webhookmessage/${elmt.getAttribute("data-webhook-id")}`)
            .then(_=>alert('The link to programmatically send webhook messages has been copied to your clipboard.\nPlease do not share this link with anyone, including members of this chat.', 'Link Copied'))
            .catch(_ => alert(`The link to programmatically send webhook messages could not be copied. It is:\n${`${location.origin}/webhookmessage/${elmt.getAttribute("data-webhook-id")}`}\nPlease do not share this link with anyone, including members of this chat.`, 'Link not Copied'))
        }

        let deleteOption = document.createElement("i");
        deleteOption.className = "far fa-trash-alt fa-fw"
        deleteOption.onclick = _ => {
            confirm(`Are you sure you want to delete webhook ${elmt.getAttribute('data-webhook-name')}?`, 'Delete Webhook?', res=>{
                if (res) socket.emit('delete-webhook', { webhookName: elmt.getAttribute('data-webhook-name') });
            })
            //location.reload();
        }

        optionsDisp.appendChild(editOption);
        optionsDisp.appendChild(copyOption);
        optionsDisp.appendChild(deleteOption);
        elmt.appendChild(optionsDisp);

        elmt.addEventListener('click', e => {
            globalThis.selectedWebhookId = elmt.getAttribute('data-webhook-id');
            document.getElementById('text').placeholder = "Send message as " + elmt.getAttribute('data-webhook-name') + "...";
            document.getElementById("webhook-options").style.display = "none";
            document.getElementById("profile-pic-display").src = elmt.getAttribute('data-image-url');
        });

        document.getElementById("webhook-options").appendChild(elmt);
    }

    {
        let elmt = document.createElement("div");
        elmt.classList.add("webhook-option");

        let imageDisp = document.createElement("img");
        imageDisp.src = "https://img.icons8.com/ios-filled/50/000000/plus.png";
        imageDisp.alt = "Add Webhook (Icon)";
        elmt.appendChild(imageDisp);

        let nameDisp = document.createElement("h2");
        nameDisp.innerText = "Add Webhook";
        elmt.appendChild(nameDisp);
        
        elmt.onclick = _ => {
            prompt("What do you want to name this webhook?", "Name Webhook", "unnamed webhook", 50).then(name=>{
                prompt("What do you want the webhook avatar to be?", "Set Avatar", "https://img.icons8.com/ios-glyphs/30/000000/webcam.png", false).then(avatar=>{
                    socket.emit('add-webhook', {
                        name: name,
                        image: avatar,
                    });
                })
                .catch()
            })
            .catch()
        }

        document.getElementById("webhook-options").appendChild(elmt);
    }
});

let alert_timer = null
socket.on('connection-update', data=>{
    if (getSetting('notification', 'sound-connect')) document.getElementById("msgSFX").play()
    sidebar_alert(`${data.name} has ${data.connection ? 'connected' : 'disconnected'}`, 5000)
})

socket.on("disconnect", ()=>{
    document.getElementById("msgSFX").play()
    let close_popup = sidebar_alert(`You have lost connection to the server`)
    let msg = {
        text: `You have lost connection to the server. You will automatically be reconnected if/when it is possible.`,
        author: {
            name: "Info",
            img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png"
        },
        time: new Date(new Date().toUTCString()),
        archive: false
    }
    globalThis.channels.content.msg.handle(msg)

    socket.once("connect", () => {
        document.getElementById("msgSFX").play()
        let msg = {
            text: `You have been reconnected.`,
            author: {
                name: "Info",
                img: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png"
            },
            time: new Date(new Date().toUTCString()),
            archive: false
        }
        globalThis.channels.content.msg.handle(msg)
        close_popup()
    })
})

document.getElementById('chat-button').addEventListener('click', async _ => {
    setMainChannel("content")
})

socket.on('online-check', userinfo => {
    document.getElementById('online-users').innerHTML = ''
    userinfo.forEach(item => {
        const div = document.createElement('div')
        div.classList.add("online-user")
        div.setAttribute('data-user-name', item.name);
        const span = document.createElement('span')
        span.innerText = item.name
        const img = document.createElement('img')
        img.src = item.img
        let editOption;
        let dmOption;
        if (item.name === document.cookie.match('(^|;)\\s*' + "name" + '\\s*=\\s*([^;]+)')?.pop() || '') {
            editOption = document.createElement('i');
            editOption.className = "fas fa-edit fa-fw"
            editOption.style.cursor = "pointer";
            div.addEventListener('click', e => {
                prompt('What do you want to change your profile picture to?', 'Change Profile Picture', item.img, false).then(image=>{
                    if (image !== item.img) {
                        socket.emit('change-profile-pic', { cookieString: document.cookie, img: image })
                    } else alert('New profile picture cannot be the same as old one', 'Error')
                })
                .catch()         
            });
        } else {
            if (!globalThis.channels[item.name]) makeChannel(item.name, `DM with ${item.name}`, false).msg.handle({
                    text: `You are in a DM conversation with ${item.name}. Messages sent here are not saved. `,
                    author: {
                        name: "",
                        img: "https://jason-mayer.com/hosted/favicon.png"
                    },
                    time: new Date(),
                    archive: false,
                    mute: true,
            })
            dmOption = document.createElement("i")
            dmOption.classList = "far fa-comment fa-fw"
            let channel = globalThis.channels[item.name]
            div.style.cursor = "pointer"
            div.title = `DM conversation with ${item.name}`
            channel.msg.secondary = ()=>{
                span.style.fontWeight = "bold"
                dmOption.classList = "fas fa-comment fa-fw"
            }
            div.addEventListener("click", ()=>{
                setMainChannel(channel.id)
                span.style.fontWeight = "normal"
                dmOption.classList = "far fa-comment fa-fw"
            })
        }
        div.appendChild(img)
        div.appendChild(span)
        if (editOption) div.appendChild(editOption);
        if (dmOption) div.appendChild(dmOption)
        document.getElementById('online-users').appendChild(div)
    })
    document.getElementById("online-users-count").innerHTML = `<i class="fas fa-user-alt fa-fw"></i>Currently Online (${userinfo.length}):`
})

const logout = () => {
    confirm(`Are you sure you want to log out? \nNote: This will terminate all active sessions under your account.`, "Log Out?", res=>{
        if (res) {
            socket.emit("logout", document.cookie)
            document.cookie = "pass=0;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax;Secure;SameParty;"
            document.cookie = "email=0;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax;Secure;SameParty;"
            location.reload()
        }
    })
}

socket.on("forced_disconnect", reason=>{
    alert(`Your connection has been ended by the server, which provided the following reason: \n${reason}`, "Disconnected")
    socket = null
})

document.querySelector("#image-box").onpaste = function (event) {
    let items = (event.clipboardData || event.originalEvent.clipboardData).items;
    for (let index in items) {
        let item = items[index];
        if (item.kind === 'file') {
            let blob = item.getAsFile();
            let reader = new FileReader();
            reader.onload = function (event) {
                 document.getElementById('image-box-display').src = event.target.result;
                 sessionStorage.setItem("attached-image-url", event.target.result);
            }; 
            reader.readAsDataURL(blob);
        }
    }
}

document.getElementById("close-image-box").onclick = _ => {
    document.querySelector("#image-box").style.display = "none";
    if (sessionStorage.getItem("attached-image-url")) {
        document.getElementById("attached-image-preview").src = sessionStorage.getItem("attached-image-url")
        document.getElementById("attached-image-preview").removeAttribute("hidden")
    }
}

document.querySelector("#image-box #clear-image-box").onclick = _ => {
    document.getElementById('image-box-display').src = "";
    sessionStorage.removeItem("attached-image-url");
}

socket.on("message-deleted", messageID => {
    let message = document.querySelector(`[data-message-id="${messageID}"]`)
    const channel = message.parentElement.id
    message.remove()
    globalThis.channels[channel].messageObjects = globalThis.channels[channel].messageObjects.filter(item => {
        if (item.msg === message) {
            globalThis.channels[channel].messages = globalThis.channels[channel].messages.filter(message => message !== item.data)
            return false; 
        } else return true;
    })
    globalThis.channels[channel].messageObjects.forEach(message => message.update())
    messageCount -= 1;
});

socket.on("message-edited", data => {
    let message = document.querySelector(`[data-message-id="${data.id}"]`);
    if (message) {
        const channel = message.parentElement.id
        for (let item of globalThis.channels[channel].messageObjects) {
            if (item.msg !== message) continue; 
            globalThis.channels[channel].messages[globalThis.channels[channel].messages.indexOf(item.data)] = data;
            item.data = data;
        }
        globalThis.channels[channel].messageObjects.forEach(message => message.update())
    }
});

socket.on("profile-pic-edited", data => {
    let elmt = document.querySelector(`.online-user[data-user-name="${data.name}"] img:first-of-type`);
    if (!elmt) return;
    elmt.src = data.img;
    if (data.name === document.cookie.match('(^|;)\\s*' + "name" + '\\s*=\\s*([^;]+)')?.pop() || '') {
        sessionStorage.setItem("profile-pic", data.img);
        document.getElementById("profile-pic-display").src = data.img;
    }
});

socket.on("auto-mod-update", data => {
    sidebar_alert(data, 5000, "https://jason-mayer.com/hosted/mod.png")
})

document.getElementById("settings-header").addEventListener('click', async event=>{
    await loadSettings()
    document.getElementById("settings-holder").style.display = 'flex'
})

document.getElementById("settings-exit-button").addEventListener('click', event => {
    let settings = {};
    for (const element of document.querySelectorAll("div#settings_box input")) {
        settings[element.id] = element.checked
    }
    localStorage.setItem('settings', JSON.stringify(settings))
    document.getElementById("settings-holder").style.display = 'none'
    updateTheme()
})

document.getElementById("header-logo-image").addEventListener("click", ()=>{
    if (document.querySelector(':root').style.getPropertyValue('--view-width') === '85%' || document.querySelector(':root').style.getPropertyValue('--view-width') == '') {
        document.querySelector(':root').style.setProperty('--view-width', '100%')
        document.querySelector(':root').style.setProperty('--sidebar-left', '-15%')
    } else {
        document.querySelector(':root').style.setProperty('--view-width', '85%')
        document.querySelector(':root').style.setProperty('--sidebar-left', '0')
    }
})

let timeUpdate = setInterval(() => {
    const date =  String(new Date().getDate())
    const ending = !"123".includes(date.slice(-1)) ? 'th' : ['11', '12', '13'].includes(date) ? 'th' : date.slice(-1) === '1' ? 'st' : date.slice(-1) === '2' ? 'nd' : 'rd' //my brain hurts
    const day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]
    const month = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][new Date().getMonth()]
    document.getElementById("time-disp").innerHTML = `${new Date().toLocaleTimeString()}<br>${day}, ${month} ${date}${ending}`
}, 500);

setTimeout(_ => {

    document.getElementById("content").addEventListener('scroll', e => {
        if (inMessageCoolDown) return;

        if (document.getElementById("content").scrollTop > 20) return;

        inMessageCoolDown = true;

        fetch(`/archive.json?reverse=true&start=${messageCount}&count=50`, {
            headers: {
                'cookie': document.cookie
            }
        }).then(res => {
            res.json().then(messages => {
                messageCount += messages.length;
                for (let data of messages) {
                    if (data?.tag?.text === "DELETED") continue
                    data.mute = true
                    globalThis.channels.content.msg.appendTop(data)
                }
                globalThis.channels.content.messageObjects.forEach(message => message.update())
                setTimeout(_ => { inMessageCoolDown = false }, 500)
            });
        })
    }, { passive: true });
}, 1000)