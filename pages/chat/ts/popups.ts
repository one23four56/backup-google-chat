import { closeDialog } from "./script";

/**
 * Displays a custom alert message
 * @param content Content of alert message
 * @param title Title of alert message
 * @returns A promise that resolves when the alert is closed
 */
export function alert(content: string, title: string = "Alert"): Promise<void> {
    const alert = document.body.appendChild(document.createElement("dialog")),
        h1 = alert.appendChild(document.createElement("h1")),
        p = alert.appendChild(document.createElement("p")),
        button = alert.appendChild(document.createElement("button"))

    alert.className = "alert";
    h1.innerText = title;
    p.innerText = content;
    button.innerText = "Ok";

    const clickListener = (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== 'Escape') return;
        event.preventDefault();
        button.click();
        document.removeEventListener('keydown', clickListener);
    }
    document.addEventListener('keydown', clickListener)

    alert.showModal();

    return new Promise(resolve => {
        button.onclick = () => {
            resolve()
            closeDialog(alert);
        }
    })
}

/**
 * Displays a custom alert message with yes/no options
 * @param content Content of alert message
 * @param title Title of alert message
 * @returns A promise that will resolve with true/false when the user chooses
 */
export function confirm(content: string, title: string = "Confirm") {
    const alert = document.body.appendChild(document.createElement("dialog")),
        h1 = alert.appendChild(document.createElement("h1")),
        p = alert.appendChild(document.createElement("p")),
        buttons = alert.appendChild(document.createElement("div"));


    alert.className = "alert";
    h1.innerText = title;
    p.innerText = content;
    buttons.className = "buttons";

    const yes = buttons.appendChild(document.createElement("button"));
    yes.appendChild(document.createElement("i")).className = "fa-solid fa-check"
    yes.title = "Yes";
    yes.className = "green";

    const no = buttons.appendChild(document.createElement("button"));
    no.appendChild(document.createElement("i")).className = "fa-solid fa-xmark"
    no.title = "No";
    no.className = "red";

    const clickListener = (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            yes.click();
            document.removeEventListener('keydown', clickListener);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            no.click();
            document.removeEventListener('keydown', clickListener);
        }
    }
    document.addEventListener('keydown', clickListener)

    alert.showModal()

    return new Promise<boolean>((resolve) => {
        yes.onclick = () => { closeDialog(alert); resolve(true) }
        no.onclick = () => { closeDialog(alert); resolve(false) }
    })
}

/**
 * Displays a custom alert message with a text box and yes/no options
 * @param content Content of alert message
 * @param title Title of alert message
 * @param defaultText Placeholder text in text box
 * @param charLimit Character limit
 * @returns A promise that will resolve with the user's input or reject if they decline
 */
export function prompt(content: string, title: string = "Prompt", defaultText: string = "", charLimit: number = 50) {
    const alert = document.body.appendChild(document.createElement("dialog")),
        h1 = alert.appendChild(document.createElement("h1")),
        p = content ? alert.appendChild(document.createElement("p")) : null,
        text = alert.appendChild(document.createElement('input')),
        buttons = alert.appendChild(document.createElement("div"));
    
    alert.className = "alert";
    h1.innerText = title;
    content && (p.innerText = content);
    buttons.className = "buttons";

    const yes = buttons.appendChild(document.createElement("button"));
    yes.title = "Ok";
    yes.appendChild(document.createElement("i")).className = "fa-solid fa-check";
    yes.className = "green"

    const no = buttons.appendChild(document.createElement("button"));
    no.title = "Cancel";
    no.appendChild(document.createElement("i")).className = "fa-solid fa-xmark";
    no.className = "red";

    text.type = "text"
    text.value = defaultText
    text.maxLength = charLimit

    const clickListener = (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            yes.click();
            document.removeEventListener('keydown', clickListener);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            no.click();
            document.removeEventListener('keydown', clickListener);
        }
    }
    document.addEventListener('keydown', clickListener)

    alert.showModal()
    text.focus()

    return new Promise<string>((resolve, reject) => {
        yes.onclick = () => { closeDialog(alert); resolve(text.value) }
        no.onclick = () => { closeDialog(alert); reject() }
    })
}

/**
 * Displays a popup on the sidebar
 * @param msg Message to display
 * @param expires Time (in ms) until message is removed (optional)
 * @param icon Icon to display next to the message
 * @returns A function that removes the popup
 */
export function sideBarAlert(msg: string, expires?: number, icon: string = "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Infobox_info_icon.svg/1024px-Infobox_info_icon.svg.png") {
    const alert = document.getElementById("alert").cloneNode() as HTMLDivElement
    const text = document.createElement("p")
    const img = document.createElement("img")
    const expire = () => alert.remove();

    text.innerText = msg
    img.src = icon

    alert.appendChild(img)
    alert.appendChild(text)
    alert.style.visibility = 'initial'
    alert.style.display = 'flex'
    document.getElementById("sidebar_alert_holder").appendChild(alert)

    if (expires) setTimeout(expire, expires);
    return expire
}