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
const { messages, size, words, meta, media } = await req.json();

/**
 * @returns {HTMLElement}
 */
const id = i => document.getElementById(i);

id('title').innerText = `${meta.emoji} ${meta.name} Stats`

id('messages').innerText = messages.numbers.allTime.toString()
id('media-size').innerText = ((size.media + size.messages) / 1e6).toFixed(3) + " MB"

id('today-msg').innerText = messages.numbers.last7[0].toString()
id('tvy-label').innerText = (messages.numbers.last7[0] - messages.numbers.last7[1] > 0 ? "📈" : "📉")

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

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const maxPast = messages.numbers.last7.reduce((arr, cur) => arr > cur ? arr : cur, 0)
for (const [index, total] of messages.numbers.last7.entries()) {

    let caption = index === 0 ? 'Today' : index === 1 ? 'Yesterday' : ago(index).toLocaleDateString('en-US', { weekday: 'long' })
    caption += ' ' + ago(index).toLocaleDateString('en-US', { month: 'numeric', 'day': 'numeric' })

    id('last7').prepend(makeP(maxPast, caption, total))

}

{
    const avg = messages.numbers.last7.reduce((acc, cur) => acc + cur, 0) / messages.numbers.last7.length
    id('7-day-avg-msg').innerText = avg.toFixed(0)
    id('7-day-avg-rank').innerText = avg - messages.numbers.last7[0] > 0 ? 'below' : 'above'
}

{
    const today = messages.numbers.last7[0], day = new Date().getDay();
    let percent = (today - messages.days.average[day]) / messages.days.average[day];
    isNaN(percent) && (percent = 0)

    id('dow-avg-today').innerText = today.toString();

    if (percent !== 0) {
        id('dow-avg-percent').innerText = Math.abs(percent * 100).toFixed(0) + "%";
        id('dow-avg-text').innerText = percent > 0 ? "higher than average" : "lower than average";
    }

    id('dow-avg').append(
        weekdays[day] + "."
    )

}

{
    const avg = messages.numbers.today.reduce((acc, cur) => acc + cur, 0) / messages.numbers.today.length
    id('12-h-avg-msg').innerText = avg.toFixed(0)
    id('12-h-avg-rank').innerText = avg - messages.numbers.today[0] > 0 ? 'below' : 'above'
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

const maxHours = messages.numbers.today.reduce((arr, cur) => arr > cur ? arr : cur, 0)
for (const [index, total] of messages.numbers.today.entries()) {
    const hours = new Date(Date.now() - index * 60 * 60 * 1000).getHours()
    const caption = hours > 12 ? `${hours - 12} PM` : `${hours} AM`

    id('last12').prepend(makeP(maxHours, caption, total))
}

// leaderboards

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

// weekdays

{
    const max = Math.max(...messages.days.total), min = Math.min(...messages.days.total);
    for (const [index, day] of weekdays.entries()) {
        const total = messages.days.total[index], active = messages.days.active[index];
        id('weekday-totals').append(makeP(max, day, total));
        id('active-totals').append(makeP(Math.max(...messages.days.active), day, active))

        if (total === max)
            id('weekday-most-active').innerText = day;

        if (total === min)
            id('weekday-least-active').innerText = day;
    }

    id('active-days').innerText = messages.days.active.reduce((a, c) => a + c, 0)
}

// media

{
    id('media-total').innerText = messages.numbers.withMedia;
    id('media-percent').innerText = ((messages.numbers.withMedia / messages.numbers.allTime) * 100)
        .toFixed(2) + "%";

    id('media-size-2').innerText = (size.media / 1e6).toFixed(2) + " MB";
    id('media-size-percent').innerText = (size.media / (size.messages + size.media) * 100).toFixed(2) + "%"
    id('media-count').innerText = media.total;

    if (media.largest.size !== 0) {
        id('largest-file').innerText = media.largest.name;
        id('largest-file').href = media.largest.link;
        id('largest-file').target = "_blank";

        id('largest-size').innerText = (media.largest.size / 1e6).toFixed(2) + " MB";
        id('largest-author').innerText = media.largest.author;
        id('largest-text').append(
            new Date(media.largest.timestamp).toLocaleString('en-US', {
                dateStyle: 'long',
                timeStyle: 'short'
            }) + "."
        )
    } else id('largest-text').remove();
}

// wordcloud

function generateWordCloud() {
    id('words').height = 2880
    id('words').width = 5120

    id('words').style.display = 'block'

    id('words').scrollIntoView()

    const shift = Math.floor(Math.random() * 360);

    WordCloud(id('words'), {
        list: words,
        gridSize: 50 + Math.floor(Math.random() * 30),
        drawOutOfBound: false,
        shrinkToFit: true,
        backgroundColor: `hsl(${shift}, 30%, 15%)`,
        weightFactor: !id('same').checked ?
            size => ((size / words[0][1]) * Number(id('weight').value)) :
            _size => Number(id('weight').value) * 0.05,
        rotationRatio: 0.5,
        rotationSteps: 2,
        minSize: 20,
        color: (_word, weight) => `hsl(${Math.floor((weight / words[0][1]) * 360) + shift}, ${50 + Math.floor(Math.random() * 20)}%, ${70 + Math.floor((weight / words[0][1]) * 30)}%)`
    })

    id('words').dataset.genTime = (Date.now() / 1000).toFixed(0)

    id('save-words-wrapper').style.display = "block"
}

id('gen-words').onclick = generateWordCloud

id('save-words').onclick = () => id('words').toBlob(blob => {

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `${meta.name.replace(/ /g, "_")}-wordcloud-${id('words').dataset.genTime}`;
    a.style.display = 'none';

    document.body.appendChild(a).click();

    URL.revokeObjectURL(blob);
    a.remove();

}, `image/${id('save-words-format').value}`)

id('copy-words').onclick = async () => id('words').toBlob(async blob => {
    try {
        await navigator.clipboard.write([
            new ClipboardItem({
                [blob.type]: blob
            })
        ]);

        alert('The word cloud has been copied to your clipboard')
    } catch {
        alert('Sorry, your browser does not support one-click image copying. The image will open in a new tab, and you can copy it from there')
        window.open(URL.createObjectURL(blob));
        URL.revokeObjectURL(blob)
    }
})

id('word-m1').innerText = words[0][0]
id('uses-m1').innerText = words[0][1]

id('word-m2').innerText = words[1][0]
id('uses-m2').innerText = words[1][1]

id('word-m3').innerText = words[2][0]
id('uses-m3').innerText = words[2][1]

id('loading').remove();
document.body.classList.remove('loading')