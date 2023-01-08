@echo off
cd ..
call npm run --silent ts-check-client
echo Packing Typescript...
call npx esbuild pages/chat/ts/script.ts --bundle --outfile=pages/chat/script.js --format=esm --sourcemap
echo Typescript Packed!
echo Packing SCSS...
call npx sass pages/chat/scss/style.scss:pages/chat/style.css
echo SCSS Packed!
echo Starting watchers...
start npx sass --watch pages/chat/scss/style.scss:pages/chat/style.css
start npx esbuild pages/chat/ts/script.ts --bundle --outfile=pages/chat/script.js --format=esm --sourcemap --watch
echo Watchers started!