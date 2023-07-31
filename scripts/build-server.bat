@echo off
cd ..
echo Checking Typescript...
call npx tsc
echo Check passed!
call npx esbuild out/index.js --bundle --outfile=out/index.js --platform=node --target=es2020 --sourcemap --allow-overwrite
exit 0