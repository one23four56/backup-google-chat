import { reqHandlerFunction } from ".";
import * as fs from "fs";
import * as path from 'path';
import * as MarkdownIt from 'markdown-it';
import * as markdownItAnchor from 'markdown-it-anchor';
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
markdown.use(markdownItAnchor)

export const updates: reqHandlerFunction = (req, res) => {
    let response = `<head><title>Backup Google Chat Update Logs</title>`
    response += `<style>li {font-family:monospace} h1 {font-family:sans-serif}</style></head><h1>Backup Google Chat Update Logs</h1><ul>`
    const updates = JSON.parse(fs.readFileSync('updates.json', "utf-8"))
    for (const update of updates.reverse())
        response += `<li><a target="_blank" href="${update.logLink}">${update.version}</a>: ${update.updateName}</li><br>`
    response += `</ul>`
    res.send(response)
}

export const updateName: reqHandlerFunction = (req, res) => {
    if (req.query.parse === 'true') {
        if (fs.existsSync(path.join(__dirname, '../../../updates', req.params.name))) {
            res.send(
                '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.5.0/styles/dark.min.css">' + 
                "<style>@import url('https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300;1,400;1,500;1,600;1,700;1,800&family=Source+Sans+Pro:ital,wght@0,200;0,300;0,400;0,600;0,700;0,900;1,200;1,300;1,400;1,600;1,700;1,900&display=swap');\n" +
                "p, li, td, th {font-family: 'Source Sans Pro', sans-serif}\n h1, h2, h3 {font-family: 'Open Sans', sans-serif}" + 
                "table {width: 100%}</style>" +
                markdown.render(fs.readFileSync(path.join(__dirname, '../../../updates', req.params.name), 'utf-8')))
        } else res.status(404).send(`The requested file was not found on the server.`)
    } else {
        res.sendFile(req.params.name, {
            root: path.join(__dirname, '../../../updates'),
            dotfiles: 'deny'
        }, err => {
            if (err) res.status(404).send(`The requested file was not found on the server.`)
        });
    }
}