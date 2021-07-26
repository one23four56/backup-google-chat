const socket = io();
if (Notification.permission !== 'granted' && Notification.permission !== 'blocked') {
    Notification.requestPermission()
}
document.getElementById("connectbutton").addEventListener('click', _ => {
    document.getElementById("connectdiv-holder").removeEventListener('click', this)
    socket.emit('connected-to-chat', document.cookie)
    document.getElementById("connectdiv-holder").remove()
})
document.getElementById("send").addEventListener('submit', event => {
    event.preventDefault()
    const formdata = new FormData(document.getElementById("send"))
    document.getElementById("text").value = ""
    socket.emit('message', {
        cookie: document.cookie,
        text: formdata.get('text'),
        archive: document.getElementById('save-to-archive').checked
    })
})
class Message {
    constructor(data) {
        let msg = document.createElement('div')
        msg.classList.add('message')
    
        let words = data.text.split(" ")
        let links = []
        words.forEach(item => {
            var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
                '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
                '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
                '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
                '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
                '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
            if (pattern.test(item)) links.push(item)
        })
    
        let p = document.createElement('p');
        p.innerText = `${data.author.name}: ${data.text}`
    
        if (links.length!==0) {
            p.innerText += `\nLinks in this message: `
            links.forEach((item, index)=>{
                let link = document.createElement('a')
                link.innerText += ` ${item}, `
                link.href = item.indexOf("https://")!==-1?item:`https://${item}`
                link.target = "_blank"
                p.appendChild(link)
            })
        }
    
        let img = document.createElement('img')
        img.src = data.author.img
    
        //I have no clue why, but when I made this a p the alignment broke
        let i = document.createElement('i')
        i.innerText = new Date(data.time).toLocaleString()
    
        let archive = document.createElement('i')
        if (data.archive === false) archive.classList.add('fas', 'fa-user-secret', 'fa-fw');
        else archive.classList.add('fas', 'fa-cloud', 'fa-fw');

        msg.appendChild(img)
        msg.appendChild(p)
        msg.appendChild(i)
        msg.appendChild(archive)
        this.msg = msg
    }
}
socket.on('incoming-message', data => {

    if (Notification.permission === 'granted' && document.cookie.indexOf(data.author.name) === -1)
        new Notification(`${data.author.name} (Backup Google Chat)`, {
            body: data.text,
            icon: data.author.img,
            silent: document.hasFocus(),
        })

    document.querySelector('link[rel="shortcut icon"]').href = 'https://jason-mayer.com/hosted/favicon2.png'
    clearTimeout(globalThis.timeout)
    globalThis.timeout = setTimeout(() => {
        document.querySelector('link[rel="shortcut icon"]').href = 'https://jason-mayer.com/hosted/favicon.png'
    }, 5000);

    let msg = new Message(data).msg
    document.getElementById("msgSFX").play()
    msg.addEventListener('contextmenu', event => {
        if (confirm('Delete message? (This will only affect YOU!)')) event.target.remove()
    })
    document.getElementById('content').appendChild(msg)
    if (document.getElementById("autoscroll").checked) document.getElementById('content').scrollTop = document.getElementById('content').scrollHeight
    msg.style.opacity = 1
})
socket.on('archive-updated', _ => {
    clearInterval(globalThis.archiveint)
    document.getElementById('archive-update').innerHTML = 'Archive Last Updated 0s Ago <i class="fas fa-download fa-fw"></i>'
    let counter = 0;
    globalThis.archiveint = setInterval(() => {
        counter++
        document.getElementById('archive-update').innerHTML = `Archive Last Updated ${counter}s Ago <i class="fas fa-download fa-fw"></i>`
    }, 1000)
})

document.getElementById('archive-update').addEventListener('click', async _ => {
    const res = await fetch('/archive.json')
    const data = await res.text()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = 'archive.json'
    link.style.display = 'none'
    link.target = '_blank'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)
})

function lockPage() {
    document.getElementById("lockdiv-holder").style.display = "initial"
    document.getElementById('lockform').addEventListener('submit', event => {
        event.preventDefault()
        const formdata = new FormData(document.getElementById("lockform"))
        if (formdata.get("passcode") === localStorage.getItem('passphrase')) {
            localStorage.removeItem('passphrase')
            document.getElementById("lockdiv-holder").style.display = "none"
            document.getElementById("passcode").value = ""
            socket.emit('page-unlocked', document.cookie)
            window.onblur = () => { }
        }
    })
}
document.getElementById('lock').addEventListener('click', _ => {
    const passphrase = prompt('Please enter a passphrase (remember this):')
    if (prompt("Enter the passphrase again:") === passphrase && confirm("Are you sure you want to lock this? If you forget the passphrase you will not be able to use this site again")) {
        socket.emit('page-locked', document.cookie)
        localStorage.setItem('passphrase', passphrase)
        lockPage()
        setTimeout(() => {
            window.onblur = () => {
                socket.emit('tamper-lock-broken', document.cookie)
                window.onblur = () => { }
            }
        }, 2000);
    }
})

window.onload = _ => {
    if (localStorage.getItem("passphrase")) {
        lockPage()
        socket.emit('tamper-lock-broken', document.cookie)
    }
}

document.getElementById('archive-button').addEventListener('click', async _ => {
    console.time('Archive loaded in')
    document.getElementById('archive').innerHTML = ''
    document.getElementById('archive').style.visibility = 'initial'
    document.getElementById("content").style.visibility = 'hidden'
    document.getElementById('send').style.display = 'none'
    document.getElementById('search').style.display = 'grid'
    let res = await fetch('/archive.json')
    let json = await res.json()
    globalThis.reallylongarraywiththeentirearchiveonit = []
    json.messages.forEach((data, _index) => {
       let msg = new Message(data).msg
        globalThis.reallylongarraywiththeentirearchiveonit.push({
            text: `${data.author.name}: ${data.text} (${new Date(data.time).toLocaleString()})`,
            html: msg
        })
        document.getElementById('archive').appendChild(msg)
        msg.style.opacity = 1
    })
    console.timeEnd('Archive loaded in')
    document.getElementById('archive').scrollTop = document.getElementById('archive').scrollHeight
})
document.getElementById('chat-button').addEventListener('click', async _ => {
    document.getElementById('archive').style.visibility = 'hidden'
    document.getElementById("content").style.visibility = 'initial'
    document.getElementById('archive').innerHTML = ''
    document.getElementById('send').style.display = 'grid'
    document.getElementById('search').style.display = 'none'
})

document.getElementById('search').addEventListener('submit', event => {
    try {
        event.preventDefault()
        const formdata = new FormData(document.getElementById("search"))
        let rescount = 0;
        console.time('Search completed in')
        globalThis.reallylongarraywiththeentirearchiveonit.forEach(value => {
            value.html.style.display = 'flex'
        })
        globalThis.reallylongarraywiththeentirearchiveonit.forEach(value => {
            let search_regex = new RegExp(formdata.get('search-text'), formdata.get('regex-flags'))
            if (!search_regex.test(value.text)) value.html.style.display = 'none'
            else rescount++
        })
        console.timeEnd('Search completed in')
        alert(`Search done. ${rescount} results found for /${formdata.get('search-text')}/${formdata.get('regex-flags')}`)
    } catch (err) {
        alert(`Search failed: ${err}`)
    }
})

socket.on('online-check', userinfo => {
    document.getElementById('online-users').innerHTML = ''
    userinfo.forEach(item => {
        const div = document.createElement('div')
        div.classList.add("online-user")
        const span = document.createElement('span')
        span.innerText = item.name
        const img = document.createElement('img')
        img.src = item.img
        div.appendChild(img)
        div.appendChild(span)
        document.getElementById('online-users').appendChild(div)
    })
    document.getElementById("online-users-count").innerHTML = `<i class="fas fa-user-alt fa-fw"></i>Currently Online (${userinfo.length}):`
})

document.body.addEventListener('keyup', event => {
    if (event.ctrlKey && event.key === ';') document.getElementById('lock').click()
})