# Backup Google Chat

How to set up:
Run command `npm run init` (make sure not to do `npm init` by accident, it does something different)

There are also some npm scripts that make it easier to run. They are:

- `npm start` - Runs the latest build of the program
- `npm run build` - Builds the Typescript into Javascript
- `npm test` -  Builds the program, then runs it

If you are going to add a feature make an issue describing it first so we don't accidentally do the same thing. Also, if you are adding a feature make a new branch and add it there. When you are done, make a pull request with master but do not merge it.

## How to use webhooks programmatically

**(!!!) Programmatically sending webhook messages is currently broken.**  
To send a webhook message programmatically, do the following steps:

1. Open the list of webhooks and find the webhook you want to use.
2. Click the Copy icon (it looks like two pieces of paper on top of each other).
3. Copy the link that pops up on screen.
4. Send a post request the the link you copied with this body:

```json
{
  "message": "[string]",
  "archive": "[boolean]"
}
```

The 'message' field specifies the message's text, and the 'archive' field (optional) specifies whether or not to save the message to the archive.
