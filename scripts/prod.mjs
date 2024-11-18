//@ts-check
import esbuild from 'esbuild';
import * as sass from 'sass';
import fs from 'fs';
import { exec } from 'child_process';
import UpdateData from '../ts/update.json' with { type: "json" };

const dirs = ["chat", "media", "bots", "stats", "login", "updates"]

for (const dir of dirs) {
    esbuild.buildSync({
        bundle: true,
        outfile: `pages/${dir}/script.js`,
        sourcemap: false,
        minify: true,
        format: 'esm',
        platform: "browser",
        drop: ['console', 'debugger'],
        dropLabels: ["DEV"],
        entryPoints: [`pages/${dir}/ts/script.ts`],
        banner: {
            'js': `/**!\n\t@name ${dir}\n\t@version ${UpdateData.version.number}-prod\n\t@timestamp ${new Date().toISOString()}\n\tBackup Google Chat - https://chat.jason-mayer.com/\n*/`,
        }
    })

}

const scss = ["chat", "bots", "updates"];

// call npx sass pages/chat/scss/style.scss:pages/chat/style.css

for (const dir of scss) {
    const res = sass.compile(`pages/${dir}/scss/style.scss`, { sourceMap: false, style: 'compressed' });
    fs.writeFileSync(`pages/${dir}/style.css`, res.css, "utf-8");
}

await new Promise((res, rej) => exec("npx tsc", (err) => err ? rej() : res(0)));

esbuild.buildSync({
    bundle: true,
    outfile: `out/index.min.js`,
    sourcemap: false,
    minify: true,
    platform: "node",
    target: "es2020",
    entryPoints: [`out/index.js`],
});

import MarkdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
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
});
markdown.use(markdownItAnchor);

/**
 * 
 * @param {string} inDir 
 * @param {string} outDir 
 * @param {string} templateFile
 */
function processMarkdown(inDir, outDir, templateFile) {
    if (!fs.existsSync(outDir))
        fs.mkdirSync(outDir);

    const template = fs.readFileSync(templateFile, "utf-8");

    console.time(`rendered ${outDir}`);

    fs.rmSync(outDir, { force: true, recursive: true });
    fs.mkdirSync(outDir);

    for (const name of fs.readdirSync(inDir)) {
        if (!name.endsWith(".md")) {
            fs.copyFileSync(`${inDir}${name}`, `${outDir}${name}`);
            continue;
        }

        const output = markdown.render(
            fs.readFileSync(`${inDir}${name}`, "utf-8")
        );

        const text = String(template)
            .replace("<!--content-->", output)
            .replace("<!--name-->", name.replace(".md", ""));

        fs.writeFileSync(`${outDir}${name}.html`, text, "utf-8");
    }
    console.timeEnd(`rendered ${outDir}`);
}

processMarkdown("updates/", "pages/updates/versions/", "pages/updates/template.html");
processMarkdown("docs/bots/", "pages/bots/docs/", "pages/bots/template.html");

process.exit(0);