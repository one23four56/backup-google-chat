# New Node.js Version Required

If you are running a local copy of the site, you must use a Node.js version of 17.5 or above, otherwise the site will not work.

## Changes

The InspiroBot uses the fetch API to grab the images it generates. Instead of using node-fetch and adding another dependency, InspiroBot uses the native fetch API build in to Node.js. This API is only available in v17.5 or higher with the `--experimental-fetch` flag.

## Required Modification

If you are running a local copy, you will need to download the latest Node.js version [here](https://nodejs.org/en/download/current/). Make sure to download the 'Current' version, not the 'LTS' version.
