@echo off
cd ..
call npm run --silent ts-check-client
echo Packing Typescript...
call npx esbuild pages/chat/ts/script.ts --bundle --outfile=pages/chat/script.js --format=esm --minify
call npx esbuild pages/media/ts/script.ts --bundle --outfile=pages/media/script.js --format=esm --minify
call npm run build
call npx esbuild out/index.js --bundle --outfile=out/index.min.js --target=es2020 --minify --platform=node
echo Typescript Packed!
echo Packing SCSS...
call npx sass --no-source-map pages/chat/scss/style.scss:pages/chat/style.css --style compressed
echo SCSS Packed!
echo Removing unused files...
del pages\chat\script.js.map
del pages\chat\style.css.map
echo Unused files removed!
echo Production package finished. Output file at out/index.min.js
exit 0