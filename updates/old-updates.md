# Backup Google Chat Old Updates

All of these updates were before the update log was added.

<hr>

<!-- ## The 2nd Banning (February 9th, 2022 @ 11:45 AM)

At around 11:45 AM on February 9th, 2022, the district removed the ability to add multiple accounts to a school chromebook, blocking the usage of Google Chat in school.  
The exact time is known because we were in the middle of a conversation when it happened.  
This renewed demand for the Backup Google Chat, which lead to a scramble to find a new host (ngrok was blocked), renewal and re-cancellation of BGC2, and many new updates. -->

## UserAuth Version 1 (November 29th, 2021)

Successor to AuthData2 authentication system  
This update was not added to the update logs. The following is copied+pasted from its github page:

**Note:** This page is for an update to the authentication system, not to the site itself.  
**Note 2:** This page is meant for developer reference.

The UserAuth authentication system is the successor to the AuthData2 authentication system. ~~It was released as part of the Account Update.~~ (was actually released on its own)

### Updates

- **Passwords**
  - Adds support for passwords
  - Passwords are now the primary authentication method
  - Passwords are not stored in plain text; they are salted and hashed
- **Two-Factor Authentication**
  - Adds defense against cookie-stealing, password-guessing, and brute-force attacks
  - **Note:** If someone were to get your password, 2FA would not fully prevent them from accessing your account; however, they would only be able to create a session and use functions that use `auth` + a session ID for authentication. They would be prevented from accessing the home page and most other pages, so any usage of the site would be very tedious.
- **Internal Security**
  - Unlike AuthData and AuthData2, UserAuth is composed of two separate interfaces- one which is good purely for authentication (UserAuth, hence the name), and one which is good purely for accessing user data (UserData). AuthData & AuthData2's single interface structure gave some functions unessescary access to a user's CDID or MPID.

## Style Update (October 30th, 2021)

- First update on the update logs
- Find update details there

## Direct Message Update Patch 1 (October 26th, 2021)

- Bug fixes
- Last update before updates were tracked on the update logs

## Direct Message Update (October 24th, 2021)

- Added multi-view system
- Added channel system
- Added direct messages
  - Click on someone's name in the online list to send a DM to them.
- Remade auto moderator system
- Images are now self-hosted

## Content Update 3 Patch 1 (August 5th, 2021)

- Past message load count reduced to 50 due to lag
- Bug fixes
- Last update for a while
- Screenshot  
<img src="/public/images/content-1.png" width="600" alt="Screenshot of v1.8.1">

## Content Update 3 (August 4th, 2021)

- Added to ability to edit your profile picture
- Added new archive loader and viewer on a separate page
- Attempt to remove Oliver's ability to ban people
- The archive is now updated whenever a message is sent, instead of every 15 seconds
- The past 100 messages now load in upon connection
- Bug fixes

## Edit and Delete Update (August 3rd, 2021)

- Messages now have IDs
- Added the ability to edit/delete messages
- Decreased the potency of anti-spam for webhooks
- Oliver's first code-related contribution
- Removed private messages

## Image & Private Message Update (August 2nd, 2021)

- Added the ability to attach images to messages
- Added private messages (different from direct messages (DMs), which were added later)
- Bug fixes

## Content Update 2 (July 30th, 2021)

- Added custom alert and confirm messages
- Added message tags
- Added a log out button
- Bug fixes

## Authentication Update (July 29th, 2021)

- Removed page locking
- Added automatic reconnection
- New 'AuthData2' authentication system, replaces old 'AuthData' system
  - Added session-based authentication
  - Technical Changes:
    - Current Device ID (CDID) renamed to Multi-Purpose Identifier (MPID)
    - 'authname' replaced with 'email'
  - Improved security

## Webhook Update (July 27th, 2021)

- Added Webhooks
- First update by Felix
- [Video of webhooks in-development](https://drive.google.com/file/d/1lmDMJyJulJcyRW9jiwxmHpEtYGZcndNu/view?usp=sharing) (changes were made before they were published)

## Content Update 1 (May 10th or 11th, 2021)

- [Video](https://drive.google.com/file/d/14nNBcKzi07YC-N9a-vuNuD8_iRCgnPB6/view?usp=sharing)
- Added Tamper Lock
- Added Ctrl+; keyboard shortcut to lock your page
- Added Auto Moderator
  - Anti-spam rate-limiter
  - Blocks you from sending the same message twice
- Added Icons
  - Show if messages were saved
  - Icons are next to buttons
- You can now search the archive
- You can now download the archive
- Added a ban system
- Added the online list
- Added desktop notifications
- Last major update for a while
- Image of the old update logs (no updates after this were ever added to it)  
<img src="/public/images/old-update-logs.png" height="300" alt="Image of the old update logs">

## Archive Update Patch 1 (May 7th, 2021)

- Added page locking
- Bug fixes
- Earliest known screenshot:  
<img src="/public/images/earliest-screenshot.png" width="600" alt="The earliest known screenshot">

## Archive Update (May 7th, 2021)

- Added the archive; messages are now saved
- Added the sidebar

## Backup Google Chat Official Launch (May 6th, 2021)

On Thursday, May 6th, 2021, the original Backup Google Chat was launched.

## Backup Google Chat Development Begins (May 5th, 2021)

On Wednesday, May 5th, 2021, development started on Backup Google Chat.
