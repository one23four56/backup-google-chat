let queue = []
let current = 0;
async function load() {
    document.getElementById("load").onclick = null
    let res = await fetch('/archive.json', {
        headers: {
            'cookie': document.cookie
        }
    })
    let json = await res.json()
    if (confirm("Show archive in reverse?")) json.messages = json.messages.reverse()
    let search = prompt("Filter (leave blank to show all):")
    json.messages.forEach((data, _index) => {
        if (data.text.includes(search) || data.author.name.includes(search)) {
            delete data.image
            queue.push(data)
        }
    })
    document.getElementById('load-div').style.top = '-100%'
}

/*
This whole queue thing is stupid but if you show all the messages at once the site crashes. 
If you have a better method, feel free to implement it. 
*/

setInterval(() => {
    document.getElementById("disp-div").innerText += `${queue[0].author.name} ${queue[0].tag?`(${queue[0].tag.text})`:''}: ${queue[0].text} \n`
    queue.shift()
    current++
    document.getElementById("showing").innerText = `Showing ${current} Messages`
}, 0);