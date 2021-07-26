# Backup Google Chat

This takes a little work to set up but it is not that hard.

How to set up:
1. Clone repo this to your pc 
2. Make a file in the root directory called `messages.json` and paste `{"messages":[]}` into it
3. Make a file in the root directory called `.env` and paste <br>
`EMAIL_PASS="`[email password]`"` <br>
`EMAIL="`[email address]`"` <br>
into it
4. Make a folder in the root directory called `auths`
5. Run `npm run build` in the command line

There are also some npm scripts that make it easier to run. They are:

- `npm start` - Runs the latest build of the program
- `npm run build` - Builds the Typescript into Javascript
- `npm test` -  Builds the program, then runs it

If you are going to add a feature make an issue describing it first so we don't accidentally do the same thing
