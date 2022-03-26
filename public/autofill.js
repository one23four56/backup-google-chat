/**
 * Autofill version 1 
 */
const constLink = '/public/const.json'

const scan = async () => {
    try {
        const response = await fetch(constLink)
        const constants = await response.json();
        document.querySelectorAll("[autofill_search]").forEach(child => {
            for (const match of child.innerHTML.matchAll(/%#:/g)) {
                let string = child.innerHTML.substring(child.innerHTML.search(match), child.innerHTML.length)
                string = string.substring(0, string.search(/:#%/g)+3)
                if (constants.hasOwnProperty(string.replace(/(%#:)|(:#%)/g, ''))) {
                    child.innerHTML = child.innerHTML.replace(new RegExp(string, 'g'), constants[string.replace(/(%#:)|(:#%)/g, '')])
                }
            }
        })
    } catch (err) {
        console.log(err)
    }
}

window.addEventListener('load', scan)