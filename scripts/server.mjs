import { exec } from 'child_process';
import esbuild from 'esbuild';

await new Promise((res, rej) => exec("npx tsc", (err) => err ? rej() : res()));

esbuild.buildSync({
    bundle: true,
    outfile: `out/index.js`,
    sourcemap: true,
    platform: "node",
    target: "es2020",
    entryPoints: [`out/index.js`],
    allowOverwrite: true
});

process.exit(0);

