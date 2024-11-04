//@ts-check
import esbuild from 'esbuild';
import * as sass from 'sass';
import fs from 'fs';

const es = ["chat", "media", "bots", "stats"]

for (const dir of es) {
    const c = await esbuild.context({
        bundle: true,
        outfile: `pages/${dir}/script.js`,
        sourcemap: true,
        format: 'esm',
        platform: "browser",
        entryPoints: [`pages/${dir}/ts/script.ts`]
    });
    c.watch();
}

const scss = ["chat", "bots"];

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