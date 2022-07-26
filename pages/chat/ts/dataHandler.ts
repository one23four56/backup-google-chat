import { LoadData } from "../../../ts/lib/misc";
import { getSetting, id, updateStatus } from "./functions";
import { socket } from "./script";
import { confirm, prompt, alert } from "./popups";

function check(prompt = "Check?") {
    let alert = document.querySelector("div.alert-holder[style='display:none;']").cloneNode(true) as HTMLDivElement
    alert.classList.add('check-alert')
    let checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'checkbox';
    checkbox.id = 'checkbox';
    checkbox.checked = false;
    let label = document.createElement('label');
    label.innerText = prompt
    label.setAttribute('for', 'checkbox')
    let button = document.createElement("button")
    button.innerText = "OK"
    alert.firstElementChild.appendChild(checkbox)
    alert.firstElementChild.appendChild(label)
    alert.firstElementChild.appendChild(button)
    alert.style.display = "flex"
    document.body.appendChild(alert)
    return new Promise((resolve, reject) => {
        button.onclick = () => { alert.remove(); resolve(checkbox.checked) }
    })
}


export default async function getLoadData() {
    const data: LoadData = await (await fetch('../data')).json();

    document.getElementById('online-users').innerHTML = ''
    data.online.forEach(item => {
        const div = document.createElement('div')
        div.classList.add("online-user")
        div.setAttribute('data-user-name', item.name);

        if (item.afk) 
            div.classList.add("afk")

        const span = document.createElement('span')
        span.innerText = item.name
        const img = document.createElement('img')
        img.src = item.img
        let status;
        if (item.status) {
            status = document.createElement('p');
            status.innerText = item.status.char
        }
        let editOption;
        let dmOption;
        if (item.name === globalThis.me.name) {
            editOption = document.createElement('i');
            editOption.className = "fa-regular fa-face-meh-blank fa-fw"
            editOption.style.cursor = "pointer";
            div.addEventListener('click', e => updateStatus());
        } else {
            // if (!globalThis.channels[item.name]) makeChannel(item.name, `DM with ${item.name}`, false).msg.handle({
            //     text: `You are in a DM conversation with ${item.name}. Messages here are saved in your browser, not on the server. `,
            //     author: {
            //         name: "",
            //         img: "https://jason-mayer.com/hosted/favicon.png"
            //     },
            //     time: new Date(),
            //     archive: false,
            //     mute: true,
            // })
            // dmOption = document.createElement("i")
            // dmOption.classList = "far fa-comment fa-fw"
            // let channel = globalThis.channels[item.name]
            // div.style.cursor = "pointer"
            // div.title = `DM conversation with ${item.name}`
            // channel.msg.secondary = () => {
            //     span.style.fontWeight = "bold"
            //     dmOption.classList = "fas fa-comment fa-fw"
            // }
            // div.addEventListener("click", () => {
            //     setMainChannel(channel.id)
            //     span.style.fontWeight = "normal"
            //     dmOption.classList = "far fa-comment fa-fw"
            // })
            // div.addEventListener("contextmenu", e => {
            //     e.preventDefault()
            //     socket.emit("send ping", item.id)
            // })
        }
        div.appendChild(img)
        div.appendChild(span)
        if (editOption) div.appendChild(editOption);
        if (dmOption) div.appendChild(dmOption);
        if (status) {
            div.appendChild(status);
            div.title = `${item.status.char}: ${item.status.status}`
        }
        document.getElementById('online-users').appendChild(div)
    })
    document.getElementById("online-users-count").innerHTML = `<i class="fas fa-user-alt fa-fw"></i>Currently Online (${data.online.length}):`


    // // used to be onload data

    // if // this is the most elegant looking if statement in the entire codebase
    // (
    //     globalThis.selectedWebhookGID 
    //     &&
    //     (
    //         data.webhooks.filter(item => item.globalId === globalThis.selectedWebhookGID).length === 0 
    //         ||
    //         data.webhooks.filter(item => item.globalId === globalThis.selectedWebhookGID)[0].id !== globalThis.selectedWebhookId
    //     )
    //     // only reset if the webhook is gone or has been edited
    // ) 
    // {
    //     console.log(document.querySelector(`[data-webhook-gid="${globalThis.selectedWebhookGID}"]`), globalThis.selectedWebhookGID)
    //     delete globalThis.selectedWebhookId
    //     id<HTMLInputElement>('text').placeholder = "Enter a message...";
    //     document.getElementById("webhook-options").style.display = "none";
    //     id<HTMLImageElement>("profile-pic-display").src = data.me.img;
    // }

    // sessionStorage.removeItem("attached-image-url");
    // if (document.getElementById("webhook-options")) document.getElementById("webhook-options").innerHTML = "";

    // sessionStorage.setItem("profile-pic", data.me.img);

    // let profilePicDisplay = id<HTMLImageElement>("profile-pic-display");
    // profilePicDisplay.src = data.me.img;
    // profilePicDisplay.style.display = "block";

    // id<HTMLImageElement>("header-profile-picture").src = data.me.img;

    // // profilePicDisplay.onclick = e => {
    // //     if (globalThis.messageToEdit) return;
    // //     let webhookOptionsDisplay = document.getElementById("webhook-options");
    // //     webhookOptionsDisplay.style.display = webhookOptionsDisplay.style.display == "block" ? "none" : "block";
    // // };

    // // {
    // //     let elmt = document.createElement("div");
    // //     elmt.classList.add("webhook-option");
    // //     elmt.setAttribute("data-type", "user");

    // //     let imageDisp = document.createElement("img");
    // //     imageDisp.src = data.me.img;
    // //     imageDisp.alt = data.me.name + " (Icon)";
    // //     elmt.appendChild(imageDisp);

    // //     let nameDisp = document.createElement("h2");
    // //     nameDisp.innerText = data.me.name;
    // //     elmt.appendChild(nameDisp);

    // //     elmt.addEventListener('click', e => {
    // //         delete globalThis.selectedWebhookId
    // //         id<HTMLInputElement>('text').placeholder = "Enter a message...";
    // //         document.getElementById("webhook-options").style.display = "none";
    // //         id<HTMLImageElement>("profile-pic-display").src = data.me.img;
    // //     });

    // //     document.getElementById("webhook-options").appendChild(elmt);
    // // }

    // // if (data.webhooks.length >= 5) document.getElementById("webhook-options").style["overflow-y"] = "scroll";

    // // for (const option of data.webhooks) {
    // //     let hasAccess = ((globalThis.me.name == option.owner) || !option.private);
    // //     let elmt = document.createElement("div");
    // //     elmt.classList.add("webhook-option");
    // //     elmt.setAttribute("data-type", "webhook");
    // //     elmt.setAttribute("data-webhook-id", option.id);
    // //     elmt.setAttribute("data-image-url", option.image);
    // //     elmt.setAttribute("data-webhook-name", option.name);
    // //     elmt.setAttribute("data-webhook-gid", option.globalId)

    // //     let imageDisp = document.createElement("img");
    // //     imageDisp.src = option.image;
    // //     imageDisp.alt = option.name + " (Icon)";
    // //     elmt.appendChild(imageDisp);

    // //     let nameDisp = document.createElement("h2");
    // //     nameDisp.innerText = option.name + " (Bot)";
    // //     if (!hasAccess) nameDisp.innerHTML += ` <i class="fa fa-lock"></i>`;
    // //     elmt.appendChild(nameDisp);

    // //     let optionsDisp = document.createElement("div");
    // //     optionsDisp.classList.add("options");

    // //     let editOption = document.createElement("i");
    // //     editOption.className = "far fa-edit fa-fw"
    // //     editOption.onclick = _ => {
    // //         prompt('What do you want to rename the webhook to?', 'Rename Webhook', elmt.getAttribute('data-webhook-name'), 50).then(name => {
    // //             prompt('What do you want to change the webhook avatar to?', 'Change Avatar', elmt.getAttribute('data-image-url'), 9999999).then(avatar => {
    // //                 let webhookData = {
    // //                     newName: name,
    // //                     newImage: avatar,
    // //                 };
    // //                 socket.emit('edit-webhook', {
    // //                     webhookData: webhookData,
    // //                     id: elmt.getAttribute('data-webhook-gid')
    // //                 });
    // //             })
    // //                 .catch()
    // //         })
    // //             .catch()
    // //     }

    // //     let copyOption = document.createElement("i");
    // //     copyOption.className = "far fa-copy fa-fw"
    // //     copyOption.onclick = _ => {
    // //         navigator.clipboard.writeText(`${location.origin}/webhookmessage/${elmt.getAttribute("data-webhook-id")}`)
    // //             .then(_ => alert('The link to programmatically send webhook messages has been copied to your clipboard.\nPlease do not share this link with anyone, including members of this chat.', 'Link Copied'))
    // //             .catch(_ => alert(`The link to programmatically send webhook messages could not be copied. It is:\n${`${location.origin}/webhookmessage/${elmt.getAttribute("data-webhook-id")}`}\nPlease do not share this link with anyone, including members of this chat.`, 'Link not Copied'))
    // //     }

    // //     let deleteOption = document.createElement("i");
    // //     deleteOption.className = "far fa-trash-alt fa-fw"
    // //     deleteOption.onclick = _ => {
    // //         if (hasAccess) {
    // //             confirm(`Are you sure you want to delete webhook ${elmt.getAttribute('data-webhook-name')}?`, 'Delete Webhook?')
    // //                 .then(res => {
    // //                     if (res) socket.emit('delete-webhook', elmt.getAttribute('data-webhook-gid'));
    // //                 })
    // //         } else {
    // //             socket.emit('start delete webhook poll', elmt.getAttribute('data-webhook-gid'))
    // //         }
    // //     }

    // //     if (hasAccess) optionsDisp.appendChild(editOption);
    // //     if (hasAccess) optionsDisp.appendChild(copyOption);
    // //     optionsDisp.appendChild(deleteOption);

    // //     elmt.appendChild(optionsDisp);

    // //     elmt.addEventListener('click', e => {
    // //         if (!hasAccess) return;

    // //         globalThis.selectedWebhookId = elmt.getAttribute('data-webhook-id');
    // //         globalThis.selectedWebhookGID = elmt.getAttribute('data-webhook-gid');
    // //         id<HTMLInputElement>('text').placeholder = "Send message as " + elmt.getAttribute('data-webhook-name') + "...";
    // //         document.getElementById("webhook-options").style.display = "none";
    // //         id<HTMLImageElement>("profile-pic-display").src = elmt.getAttribute('data-image-url');
    // //     });


    // //     if (!getSetting("misc", "hide-private-webhooks") || hasAccess) document.getElementById("webhook-options").appendChild(elmt);
    // // }

    // // {
    // //     let elmt = document.createElement("div");
    // //     elmt.classList.add("webhook-option");

    // //     let imageDisp = document.createElement("img");
    // //     imageDisp.src = "https://img.icons8.com/ios-filled/50/000000/plus.png";
    // //     imageDisp.alt = "Add Webhook (Icon)";
    // //     elmt.appendChild(imageDisp);

    // //     let nameDisp = document.createElement("h2");
    // //     nameDisp.innerText = "Add Webhook";
    // //     elmt.appendChild(nameDisp);

    // //     elmt.onclick = _ => {
    // //         prompt("What do you want to name this webhook?", "Name Webhook", "unnamed webhook", 50).then(name => {
    // //             prompt("What do you want the webhook avatar to be?", "Set Avatar", "https://img.icons8.com/ios-glyphs/30/000000/webcam.png", 9999999).then(avatar => {
    // //                 check("Make this a PRIVATE webhook").then(checked => {
    // //                     socket.emit('add-webhook', {
    // //                         name: name,
    // //                         image: avatar,
    // //                         private: checked
    // //                     });
    // //                 });
    // //             })
    // //                 .catch()
    // //         })
    // //             .catch()
    // //     }

    // //     document.getElementById("webhook-options").appendChild(elmt);
    // // }
}