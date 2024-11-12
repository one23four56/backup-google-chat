//@ts-check
import esbuild from 'esbuild';
import * as sass from 'sass';
import fs from 'fs';
import UpdateData from '../ts/update.json' with { type: "json" };

const es = ["chat", "media", "bots", "stats", "login", "updates"];

for (const dir of es) {
    const c = await esbuild.context({
        bundle: true,
        outfile: `pages/${dir}/script.js`,
        sourcemap: true,
        format: 'esm',
        platform: "browser",
        entryPoints: [`pages/${dir}/ts/script.ts`],
        banner: {
            'js': `/**!\n\t@name ${dir}\n\t@version ${UpdateData.version.number}-dev\n\t@timestamp ${new Date().toISOString()}\n\tBackup Google Chat - https://chat.jason-mayer.com/\n*/`,
        }
    });
    c.watch();
}

const scss = ["chat", "bots", "updates"];

// call npx sass pages/chat/scss/style.scss:pages/chat/style.css

for (const dir of scss) {
    fs.watch(`pages/${dir}/scss/`, () => compile());

    const compile = () => {
        try {
            const res = sass.compile(`pages/${dir}/scss/style.scss`, { sourceMap: true });
            fs.writeFileSync(`pages/${dir}/style.css`, res.css, "utf-8");
            fs.writeFileSync(`pages/${dir}/style.css.map`, JSON.stringify(res.sourceMap), "utf-8");
            console.log("sass: compile success")
        } catch (err) {
            console.warn(err);
        }
    };

    compile();
}

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

{
    if (!fs.existsSync("pages/updates/versions"))
        fs.mkdirSync("pages/updates/versions");

    const template = fs.readFileSync("pages/updates/template.html", "utf-8");

    const updates = () => {
        console.time("rendered updates");

        fs.rmSync("pages/updates/versions", { force: true, recursive: true });
        fs.mkdirSync("pages/updates/versions");

        for (const name of fs.readdirSync("updates")) {
            if (!name.endsWith(".md")) {
                fs.copyFileSync(`updates/${name}`, `pages/updates/versions/${name}`);
                continue;
            }

            const output = markdown.render(
                fs.readFileSync(`updates/${name}`, "utf-8")
            );

            const text = String(template).replace("<!--content-->", output);

            fs.writeFileSync(`pages/updates/versions/${name}.html`, text, "utf-8");
        }
        console.timeEnd("rendered updates");
    };

    updates();
    fs.watch("updates", () => updates());
}