// this whole script is the worst thing i have written in recent history
// i feel bad for anyone in the future who has to update this
// sorry 


const req = await fetch("../stats.json");

if (!req.ok) {
    document.write(`<h1>Error: Invalid Response</h1>A critical request received an invalid response. Details are listed below.<hr><pre>\> GET ${req.url}</pre><pre>${req.status}/${req.statusText}: ${await req.text()}</pre><hr>This request is critical to site function, so this error cannot be recovered from`);
    throw new Error()
}

/**
 * @type import('../../ts/handlers/http/stats').StatsObject
 */
const { messages, size, meta } = await req.json();

const id = i => document.getElementById(i);

id('title').innerText = `${meta.emoji} ${meta.name} Stats`

id('messages').innerText = messages.allTime
id('media-size').innerText = ((size.media + size.messages) / 1e6).toFixed(3) + " MB"

id('today-msg').innerText = messages.past[0].toString()
id('tvy-label').innerText = (messages.past[0] - messages.past[1] > 0 ? "📈" : "📉")

const ago = (day) => new Date(Date.now() - day * 24 * 60 * 60 * 1000)


function makeP(max, caption, total) {
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = ((total / max) * 175) + "%";

    const p = document.createElement("p")
    p.appendChild(document.createElement("span")).innerText = total;
    p.append(document.createElement("br"), caption, bar);

    if (max === total && total !== 0)
        p.classList.add("max")

    return p;
}

const maxPast = messages.past.reduce((arr, cur) => arr > cur ? arr : cur, 0)
for (const [index, total] of messages.past.entries()) {

    let caption = index === 0 ? 'Today' : index === 1 ? 'Yesterday' : ago(index).toLocaleDateString('en-US', { weekday: 'long' })
    caption += ' ' + ago(index).toLocaleDateString('en-US', { month: 'numeric', 'day': 'numeric' })

    id('last7').prepend(makeP(maxPast, caption, total))

}

{
    const avg = messages.past.reduce((acc, cur) => acc + cur, 0) / messages.past.length
    id('7-day-avg-msg').innerText = avg.toFixed(0)
    id('7-day-avg-rank').innerText = avg - messages.past[0] > 0 ? 'below' : 'above'
}
{
    const avg = messages.hours.reduce((acc, cur) => acc + cur, 0) / messages.hours.length
    id('12-h-avg-msg').innerText = avg.toFixed(0)
    id('12-h-avg-rank').innerText = avg - messages.hours[0] > 0 ? 'below' : 'above'
}

{
    const most = Object.keys(messages.authors.last7).reduce(
        (pre, cur) => messages.authors.last7[pre] > messages.authors.last7[cur] ? pre : cur, 'Nobody'
    )
    id('l7-most-active').innerText = most;
    id('l7-ma-msg').innerText = messages.authors.last7[most] || 0
}
{
    const most = Object.keys(messages.authors.today).reduce(
        (pre, cur) => messages.authors.today[pre] > messages.authors.today[cur] ? pre : cur, 'Nobody'
    )
    id('l12-most-active').innerText = most;
    id('l12-ma-msg').innerText = messages.authors.today[most] || 0
}

const maxHours = messages.hours.reduce((arr, cur) => arr > cur ? arr : cur, 0)
for (const [index, total] of messages.hours.entries()) {
    const hours = new Date(Date.now() - index * 60 * 60 * 1000).getHours()
    const caption = hours > 12 ? `${hours - 12} PM` : `${hours} AM`

    id('last12').prepend(makeP(maxHours, caption, total))
}

for (const name in messages.authors) {

    const sorted = Object.entries(messages.authors[name])
        .filter(v => !v[0].includes("[EDITED]"))
        .sort((a, b) => b[1] - a[1]);

    const element = id(`l-${name}`);

    const sum = sorted.reduce((acc, cur) => acc + cur[1], 0)

    const loadFrom = num => {

        // clear element
        element.textContent = ''

        element.appendChild(document.createElement("h3")).innerText = name === 'allTime' ? 'All Time' : name === 'last7' ? 'Last 7 Days' : 'Today'

        const ol = document.createElement("ol")

        for (const [index, item] of sorted.entries()) {

            if (index >= num)
                break;

            const li = document.createElement("li")
            li.innerText = `${index + 1}. ${item[0]}`
            li.appendChild(document.createElement("span")).innerText = `${((item[1] / sum) * 100).toFixed(2)}% / ${item[1]}`

            ol.appendChild(li)

        }

        element.append(ol)

        if (sorted.length - num <= 0)
            return;

        const button = document.createElement("button")
        button.innerText = "Load More"
        button.onclick = () => loadFrom(num + 10)

        element.append(button)

    }

    loadFrom(10)

}

id('loading').remove();
document.body.classList.remove('loading')