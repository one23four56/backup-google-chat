async function load() {
    let current = 0;
    let queue = []
    document.getElementById("load").onclick = null
    alert("Please stay on this page while the archive is being downloaded")
    document.getElementById("load").innerText = "Downloading Archive..."
    let res = await fetch('/archive.json?images=none', {
        headers: {
            'cookie': document.cookie,
        }
    })
    let json = await res.json()
    if (confirm("Show archive in reverse?")) json = json.reverse()
    let search = prompt("Filter (leave blank to show all):")
    json.forEach((data, _index) => {
        if (data.text.includes(search) || data.author.name.includes(search)) {
            queue.push(data)
        }
    })
    setInterval(() => {
        document.getElementById("disp-div").innerText += `${new Date(queue[0].time).toLocaleString()} ${queue[0].author.name} ${queue[0].tag?`(${queue[0].tag.text})`:''}: ${queue[0].text} \n`
        queue.shift()
        current++
        document.getElementById("showing").innerText = `Showing ${current} Messages`
    }, 0);
    document.getElementById('load-div').style.top = '-100%'
    setTimeout(() => {
        document.getElementById('load-div').remove()
    }, 1000);
}

/*
This whole queue thing is stupid but if you show all the messages at once the site crashes. 
If you have a better method, feel free to implement it. 
*/
