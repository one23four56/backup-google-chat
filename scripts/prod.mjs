//@ts-check
import esbuild from 'esbuild';
import * as sass from 'sass';
import fs from 'fs';

const dirs = ["chat", "media"]

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
        entryPoints: [`pages/${dir}/ts/script.ts`]
    })

}

const scss = ["chat"];

// call npx sass pages/chat/scss/style.scss:pages/chat/style.css

for (const dir of scss) {
    const res = sass.compile(`pages/${dir}/scss/style.scss`, { sourceMap: false, style: 'compressed' });
    fs.writeFileSync(`pages/${dir}/style.css`, res.css, "utf-8");
}

process.exit(0);