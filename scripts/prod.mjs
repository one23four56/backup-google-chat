//@ts-check
import esbuild from 'esbuild';
import * as sass from 'sass';
import fs from 'fs';
import { exec } from 'child_process';

const dirs = ["chat", "media", "bots", "stats"]

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

const scss = ["chat", "bots"];

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

process.exit(0);