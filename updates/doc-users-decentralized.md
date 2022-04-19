# Users JSON Decentralized

4/9/2022  

The users JSON has been decentralized as part of refactors. This means that is has been deleted and added to .gitignore

## Changes

If you are running a local copy, users.json will be deleted when you pull the latest version from the repo. You must create a new users.json file, otherwise the site will not function. Every version will now have its own local user.json file, instead of sharing one.

## Reasoning

The users json was decentralized for 2 main reasons:

- Increased Versatility
  - With a decentralized users file, any developer can add their own test accounts without affecting others. Additionally, the live version of the site no longer has to have test accounts on it, as a test account can be added to a local development version without affecting the live version.
- User Data Changes
  - With a centralized users file, whenever a user changed their profile picture, it would update it on the live version, which would then have to push that change on to other versions. If that didn't happen, development versions would override the live version and revert the change. A decentralized file prevents this from happening.

## Required Modification

If you are running a local copy, you must create a new user.json file. This can easily be done by running the `npm run users` command, which allows you to easily add users to the users.json file. You could also copy and paste the old file into the new one. The old file (at the time of decentralization) can be found below.

## Old File

```json
{
    "fd9c0445-c09c-41ca-ab6d-878ed71f4ada": {
        "email": "25jason.mayer@wfbschools.com",
        "name": "Jason Mayer",
        "id": "fd9c0445-c09c-41ca-ab6d-878ed71f4ada",
        "img": "https://lh3.googleusercontent.com/a-/AOh14Ghbi-Mn9eSxeDehceDhSEcY7eXvXCgq2VFAZTIBEQ=s88-w88-h88-c-k"
    },
    "5d8263fe-5f1b-4d98-b768-d37eede802a8": {
        "email": "28emily.mayer@wfbschools.com",
        "name": "Emily Mayer",
        "id": "5d8263fe-5f1b-4d98-b768-d37eede802a8",
        "img": "https://lh3.googleusercontent.com/a-/AOh14GjF_cn_mLAIgw5XBUYkawfElUufyuREjl4PDJFZ2A=s88-w88-h88-c-k"
    },
    "b2151a47-2c16-4a96-b5e6-2869eec8b774": {
        "name": "jonathan mayer",
        "id": "b2151a47-2c16-4a96-b5e6-2869eec8b774",
        "email": "27jonathan.mayer@wfbschools.com",
        "img": "https://th.bing.com/th/id/OIP.x1Hj9D7j-ImL3iTZ34X6DgHaJ3?w=151&h=201&c=7&r=0&o=5&pid=1.7",
        "hooligan": true
    },
    "28bb34ed-e298-476f-b332-b88a119fb5d7": {
        "email": "25dominic.cottrill@wfbschools.com",
        "name": "Dominic Cottrill",
        "id": "28bb34ed-e298-476f-b332-b88a119fb5d7",
        "img": "https://lh3.googleusercontent.com/a-/AOh14Gh614yvwbXGjjgLXxiD8CiYUNiEgQ2qFDveY8OXng=s88-w88-h88-c-k"
    },
    "c3d6b784-7fe4-4d84-a0b8-c885e6dba797": {
        "email": "25felix.singer@wfbschools.com",
        "name": "Felix Singer",
        "id": "c3d6b784-7fe4-4d84-a0b8-c885e6dba797",
        "img": "https://lh3.googleusercontent.com/a-/AOh14GjiWS6zaSwCv5q6Zlp96dJ3a2Et61RUK69W4IHnuQ=s96-c-rg-br100"
    },
    "2b668c1f-d549-4100-9bdb-b5bc9841bc20": {
        "email": "25oliver.boyden@wfbschools.com",
        "name": "Oliver Boyden",
        "id": "2b668c1f-d549-4100-9bdb-b5bc9841bc20",
        "img": "https://lh3.google.com/u/0/ogw/ADea4I72dq4ym0_u0c1Eb3JP_GxH4YDGWl04INtSk1Yj=s83-c-mo"
    },
    "b58a780b-046f-4fbc-8da5-2cfb478d0bb1": {
        "email": "25theodore.hill@wfbschools.com",
        "name": "Theodore Hill",
        "id": "b58a780b-046f-4fbc-8da5-2cfb478d0bb1",
        "img": "https://lh3.googleusercontent.com/a-/AOh14GglkC2zdZUrof7EDVSVpt3RncGplxT5QwBXtwb7MQ=s88-w88-h88-c-k"
    },
    "c620ef8c-25e4-4620-bdf4-e315beeb4d36": {
        "email": "25tyler.ricks@wfbschools.com",
        "name": "Tyler Ricks",
        "id": "c620ef8c-25e4-4620-bdf4-e315beeb4d36",
        "img": "https://lh3.googleusercontent.com/a-/AOh14GhTZ_-yNReu9X1MjF58OItHu7PUjXmOZpT9QNe2gA=s88-w88-h88-c-k"
    },
    "00a3686a-1d1c-4c2a-a803-50cf847c4350": {
        "email": "27hugo.boyden@wfbschools.com",
        "name": "hugo boyden",
        "id": "00a3686a-1d1c-4c2a-a803-50cf847c4350",
        "img": "https://lh3.googleusercontent.com/a-/AOh14Gi6fKne19lYrxDoqSQHSqDRH5jsLFB0hRao1D-FjQ=s272-p-k-no",
        "hooligan": true
    },
    "15770aaf-bf35-4366-8dac-fb2093d9076f": {
        "email": "felixosinger@gmail.com",
        "name": "Felix McTest",
        "id": "15770aaf-bf35-4366-8dac-fb2093d9076f",
        "img": "https://upload.wikimedia.org/wikipedia/commons/d/de/TestScreen_square.svg"
    }
}
```
