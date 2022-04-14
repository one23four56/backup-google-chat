/**
 * Displays a custom alert message
 * @param content Content of alert message
 * @param title Title of alert message
 */
export function alert(content: string, title: string = "Alert") {
    const alert = document.querySelector("div.alert-holder[style='display:none;']").cloneNode(true) as HTMLDivElement
    const h1 = document.createElement("h1")
    const p = document.createElement("p")
    const button = document.createElement("button")

    h1.innerText = title
    p.innerText = content
    button.innerText = "OK"
    button.onclick = () => alert.remove()
    
    const clickListener = (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== 'Escape') return;
        event.preventDefault();
        button.click();
        document.removeEventListener('keydown', clickListener);
    }
    document.addEventListener('keydown', clickListener)

    alert.firstElementChild.appendChild(h1)
    alert.firstElementChild.appendChild(p)
    alert.firstElementChild.appendChild(button)
    alert.style.display = "flex"

    document.body.appendChild(alert)
}

/**
 * Displays a custom alert message with yes/no options
 * @param content Content of alert message
 * @param title Title of alert message
 * @returns A promise that will resolve with true/false when the user chooses
 */
export function confirm(content: string, title: string = "Confirm") {
    const alert = 
        document.querySelector("div.alert-holder[style='display:none;']").cloneNode(true) as HTMLDivElement,
        h1 = document.createElement("h1"),
        p = document.createElement("p"),
        yes = document.createElement("button"),
        no = document.createElement("button");

    h1.innerText = title
    p.innerText = content
    yes.innerText = "YES"
    no.innerText = "NO"
    yes.setAttribute('style', "width:49%;--bg-col:#97f597;")
    no.setAttribute('style', "width:49%;margin-left:51%;;--bg-col:#f78686;")

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

    alert.firstElementChild.appendChild(h1)
    alert.firstElementChild.appendChild(p)
    alert.firstElementChild.appendChild(yes)
    alert.firstElementChild.appendChild(no)
    alert.style.display = "flex"

    document.body.appendChild(alert)

    return new Promise<boolean>((resolve, reject) => {
        yes.onclick = () => { alert.remove(); resolve(true) }
        no.onclick = () => { alert.remove(); resolve(false) }
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
    const alert = document.querySelector("div.alert-holder[style='display:none;']").cloneNode(true) as HTMLDivElement
    const h1 = document.createElement("h1")
    const p = document.createElement("p")
    const text = document.createElement('input')
    const yes = document.createElement("button")
    const no = document.createElement("button")

    h1.innerText = title
    p.innerText = content
    yes.innerText = "OK"
    no.innerText = "CANCEL"
    yes.setAttribute('style', "width:49%;--bg-col:#97f597;")
    no.setAttribute('style', "width:49%;margin-left:51%;;--bg-col:#f78686;")

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

    alert.firstElementChild.appendChild(h1)
    alert.firstElementChild.appendChild(p)
    alert.firstElementChild.appendChild(text)
    alert.firstElementChild.appendChild(yes)
    alert.firstElementChild.appendChild(no)
    alert.style.display = "flex"

    document.body.appendChild(alert)
    text.focus()

    return new Promise<string>((resolve, reject) => {
        yes.onclick = () => { alert.remove(); resolve(text.value) }
        no.onclick = () => { alert.remove(); reject() }
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
    const expire = () => alert.remove()

    text.innerText = msg
    img.src = icon

    alert.appendChild(img)
    alert.appendChild(text)
    alert.style.visibility = 'initial'
    document.getElementById("sidebar_alert_holder").appendChild(alert)

    if (expires) setTimeout(expire, expires);
    return expire
}