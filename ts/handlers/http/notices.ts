import { reqHandlerFunction } from ".";
import * as fs from 'fs'
import * as MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
const markdown = MarkdownIt({
    highlight: (str, lang) => {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return `<pre class="hljs"><code>${hljs.highlight(str, {
                    language: lang,
                    ignoreIllegals: true
                }).value}</code></pre>`;
            }
            catch (__) { }
        }
        return `<pre class="hljs"><code>${markdown.utils.escapeHtml(str)}</code></pre>`;
    },
    html: true, // so comments work
})

export const notices: reqHandlerFunction = (req, res) => {
    let result = fs.readFileSync('pages/notices/index.html', 'utf-8')

    let notices: {
        content: string, 
        date: Date
    }[] = []

    for (const notice of fs.readdirSync("notices")) {
        const content = fs.readFileSync(`notices/${notice}`, 'utf-8')
        const title = content.slice(content.search("<!--title:") + 10, content.search(":title-->"))
        const date = new Date(content.slice(content.search("<!--date:") + 9, content.search(":date-->")))
        notices.push({
            content: `<div onclick="location += '/${notice}'">${title} (${date.toLocaleDateString()})</div>\n`,
            date: date
        }) 
    }

    notices.sort((a, b) => b.date.getTime() - a.date.getTime())
    
    result = result.replace("<!--notices-->", notices.map(notice => notice.content).join(""))

    res.send(result)
}

export const noticeName: reqHandlerFunction = (req, res) => {
    if (!fs.existsSync(`notices/${req.params.name}`)) {
        res.status(404).send(`The requested file was not found on the server.`)
        return
    }

    res.send(
        '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.5.0/styles/dark.min.css">' + 
       "<style>@import url('https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&family=Source+Sans+Pro:ital,wght@0,200;0,300;0,400;0,600;0,700;0,900;1,200;1,300;1,400;1,600;1,700;1,900&display=swap');\n" +
       "p, li, th, td {font-family: 'Source Sans Pro', sans-serif}\n h1, h2, h3, h4 {font-family: 'Open Sans', sans-serif}" +
       "table {width: 100%}</style>" +
       markdown.render(fs.readFileSync(`notices/${req.params.name}`, 'utf-8'))
   )
}