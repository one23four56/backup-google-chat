# Getting Started

<title>Getting Started - Bots - Backup Google Chat</title>

This tutorial will guide you through the process of creating your first bot on Backup Google Chat.

<hr>

To begin, open the Bots page by opening the **<i class="fa-solid fa-gear"></i> Settings** menu and then clicking the **<i class="fa-solid fa-robot"></i> Manage Bots** button. Once you've opened the Bots page, you can create your first bot by clicking the **<i class="fa-solid fa-plus"></i> Create New Bot** button.

Right now, your bot is disabled, which means that it cannot be added to any rooms. If you click the **<i class="fa-solid fa-power-off"></i> Enable Bot** button now, you will be given a long list of errors that must be resolved before the bot can be enabled. Let's fix those.

## Basic Setup

![Basic Bot Options](../images/1.png)

***Note:***
> For the purposes of this article, the "**limited charset**" refers to characters A-Z (upper and lowercase), 0-9, and [space]. (`abcedfghijklmnopqrstuvwxyzABCEDFGHIJKLMNOPQRSTUVWXYZ 1234567890`)
>
> The "**extended charset**" refers to all characters in the "**limited charset**", *as well as* the following: `-+=~.,/:;'"|[](){}#$%&*!?_^@`

### Name

The very first item to update is the bot name. By default, it is 'My Bot'; however, this name is not actually available to be used, so you must change it.

The name criteria are as follows:

- Must be between 5 and 20 characters in length
- Must only include characters in the **limited** charset
- Must not be reserved for system purposes
- Must not be in current use by any **public** user bot

When you've entered a name, click **<i class="fa-solid fa-pencil"></i> Update** to save the changes. If the name is rejected, you will be given an error message explaining why (see criteria above).

### Image

Your bot must have a profile picture. You can set that to whatever you like by linking to it in the Bot Image URL bar. A live preview of the image will be shown below the bar.

When you click **<i class="fa-solid fa-pencil"></i> Update**, Backup Google Chat will perform some checks to ensure that the image is valid. If these fail, you will be notified via an error message.

### Description

The bot description should explain to users what your bot does. It is shown in your bot's profile and in the bot list.

The description criteria are as follows:

- Must be between 10 and 250 characters
- Must only include characters in the **extended** charset

## Bot Token

Once the basic setup is completed, you can generate a bot token. Think of this as the "password" for your bot. It is used to authenticate all API requests that your bot makes, so it is imperative that this token is kept secret.

When you click the **<i class="fa-solid fa-key"></i> Generate Token** button, your bot will be given a token. Note that if you had any previous tokens set, they will immediately be rendered invalid and stop working.

The token will be shown on the bot page, from which it can be copied and saved. **Keep this secret!** You will need to use this later when making API requests.

## Command Server Setup

The most important part of your bot is the command server. It is where all commands are processed.

All you need to do is set up and host a simple HTTP server. If you wish you can also use the [Google Apps Script Bot Template](/bots/template), which is pre-configured for Backup Google Chat and can be set up in just a couple clicks.

In order for a server to be considered valid, it must respond to HTTP GET requests with the ID of the bot it is representing. Your bot's ID can be found under the **<i class="fa-solid fa-arrow-left"></i> Back** button or in your user bot list.

![Bot ID in bot list](../images/2.png)  
*Bot ID is between the bot name and status in the bot list*

![Bot ID under back button](../images/3.png)  
*Bot ID is under the back button on the bot page*

Once your bot server is set up to respond to GET requests, it will be considered valid by Backup Google Chat, and you can enter the URL into the Command Server URL box.

Further command server setup will be explained in more detail in the [Command Server Operation](#command-server-operation) section. For now, this is all you need.

## Adding Commands

![Add commands](../images/4.png)

Commands that you add to your bot will show up in the bot's profile and autocomplete in the message bar. When used, a request will be sent to your command server containing data such as the command, arguments, message, and room.

The criteria for command and argument **names** are:

- Must be between 4 and 20 characters in length
- Must only include characters in the **limited** charset

The criteria for command and argument **descriptions** are:

- Must be between 5 and 100 characters in length
- Must only include characters in the **extended** charset

Arguments can be made optional. Optional arguments are denoted in bot profiles and autocompletion with a question mark (?). Optional arguments do not need to be included for the command to be considered valid.

Arguments can also be made multi-word. Multi-word arguments are denoted by being encased in quotes ('') rather than brackets ([]) in bot profiles and autocompletion. Multi-word arguments must be surrounded by either single ('') or double ("") quotes when used, and can contain spaces. This is in contrast to regular arguments, which **cannot** contain spaces.

***Note:***

> When two bots in a room have commands with the same name, a number will be appended to the command of the bot added later. For example, if Bot 1, which has the command /example, is added to a room, and then Bot 2, which also has /example, is added after that, then Bot 2's command will become /example1 while Bot 1's is not changed.
>
> This change is reflected in bot profiles and autocompletion, but **not** in processing. /example1 will still be sent to the command server as /example.
>
> As this process creates confusion for both the developer (you) and users, it is recommended that you use root commands to avoid intersections. For example, if you are creating a weather bot, rather than using /today and /tomorrow, you could use /weather today and /weather tomorrow. This also serves to make commands more straightforward for users.

Don't forget to click the **<i class="fa-solid fa-floppy-disk"></i> Save Commands** button when done.

## Events Setup

![Events setup](../images/5.png)

The events panel controls which events Backup Google Chat will send to your command server. Event handling will be explained in more detail in the [Command Server Operation](#command-server-operation) section.

The events that can be enabled are as follows:

- `command` - This event is triggered when a command is sent to your bot. It can't be disabled.

- `added` - This event is triggered when your bot is added to a room.

<hr>

## Enabling Your Bot

Now that the basic setup is done, you can enable your bot. This will create a beta version, accessible to only you, which can be added to select rooms for testing.

To enable your bot, click the **<i class="fa-solid fa-power-off"></i> Enable Bot** button. If everything goes right, the button will be replaced by two new ones.

![Delete, disable, and publish bot options](../images/6.png)

Your bot is actually two separate bots: the beta version, and the public version.

The beta version (denoted by a <i class="fa-solid fa-screwdriver-wrench"></i> in the bot tag) is only accessible to you. This means that you are the only one who can add it to rooms. Beta versions can only be added to rooms that explicitly allow them (Options > User Bots > Allow beta versions must be enabled). Any changes you make on the bot page will be immediately reflected as changes to the beta version. This version is intended for testing and not public use.

The only behavioral difference between beta and public versions is that when your command server sends an invalid response, the beta version will log that to chat as an error message, whereas the public version will simply drop the message.

The public version can be added to any room by anyone, and will appear on the public bot list. When you publish a bot, it will copy the beta version as the new public version. Any changes you make on the bot page will not affect the public version until the **<i class="fa-solid fa-arrow-right-from-bracket"></i> Publish Bot** button is pressed again.

This means that you can set a different command server for your public bot by changing the command server before publishing, and then switching back once the publish is done. This is recommended so that you can make changes without affecting the public version of the bot.

All API requests must specify which version of the bot they are targeting via the `x-bot-type` header, which must be set to either `prod` or `beta`.

## Disabling Your Bot

To turn off your bot, click the **<i class="fa-solid fa-ban"></i> Disable Bot** button. This will un-publish any public versions and turn off the beta version.

When your bot is disabled, it is not actually removed from any rooms. It will no longer appear on the members page or in autocompletion, but is still considered a member. If/when it is re-enabled or re-published, it will reappear.

When a bot is disabled, it can then be deleted with the **<i class="fa-solid fa-trash"></i> Delete Bot** button. When this is done, the bot will be irreversibly removed from all rooms that it is a member of. Additionally, all data associated with the bot will be deleted, and the bot ID will be retired.

<hr>

## Command Server Operation

When an event is triggered, a POST request will be sent to your command server, with a JSON body in the following format:

```json
{
    "event": event,
    "data": data
}
```

The contents of `data` change with each event. A more in-depth breakdown can be found on the [API Documentation](/bots/docs/api-docs.md.html) page.

Here is an example payload from a `command` event:

```json
{
  "event": "command",
  "data": {
    "command": "example",
    "arguments": [],
    "areArgumentsValid": true,
    "message": {
      "text": "/example",
      "author": {
        ...
      },
      "time": "2024-11-17T23:37:10.000Z",
      "id": 1
    },
    "room": {
        ...
    }
  }
}
```

Type definitions for events are provided on the [Interfaces](/bots/docs/interfaces.md.html) page.

Your command server can then process the data and return a JSON output in the following format:

```json
{
    "text": string,
    "image": string?,
    "replyTo": number?,
}
```

- `text` - The message text
- `image` - (optional) A link to an image that will be attached to the message
- `replyTo` - (optional) The ID of a message that this message will be marked as a reply to

A simple response of:

```json
{
    "text": "test message"
}
```

will produce an output of:

![Example bot message](../images/8.png)

If there are any errors in the command server response, they will be logged to chat (if beta) or the message will be dropped (if public).

## API Usage

The bot API allows your bot to access data such as the rooms that it is in and the messages sent in those rooms, as well as allowing it to send messages on demand.

In order for API requests to be let through, the following two headers must be set:

1. The `auth` header must be your bot token
2. The `x-bot-type` header must be set to either `beta` or `prod`

A quick reference for API endpoints is shown on the bot page:

![API endpoint quick reference](../images/7.png)

Full documentation for all API endpoints can be found on the [API Documentation](/bots/docs/api-docs.md.html) page.

<hr>

## Further Reading

Congratulations! You just set up your first bot. For further details, check out the [API Documentation](/bots/docs/api-docs.md.html) page.

[<img src="/public/logo.svg" alt="Backup Google Chat Logo" style="width:10%;display:block;margin-inline:auto;">](/)

<em class="last">Last updated 2024-11-17</em>
