# API Documentation

<title>API Documentation - Bots - Backup Google Chat</title>

For full type definitions, see the [Interfaces](/bots/docs/interfaces.md.html) page.

First time? See the [Getting Started Guide](/bots/docs/getting-started.md.html).

<hr>

## Table of Contents

- [Events](#events)

  - [command](#command)

  - [added](#added)

- [API Endpoints](#api-endpoints)

  - [rooms](#rooms)

  - [messages](#messages)

  - [archive](#archive)

  - [send](#send)

<hr>

## Events

### `command`

Sent when a command is used.

POST body data:

```ts
{
    event: "command",
    data: {
        command: string,
        arguments: string[],
        areArgumentsValid: boolean,
        message: Message,
        room: Room,
    }
}
```

- `command` (string) - The command that was used, without the slash ("/example arg" -> `"example"`).

- `arguments` (string[]) - The arguments used with the command in an array ("/example arg" -> `["arg"]`).

- `areArgumentsValid` (boolean) - Whether or not all required arguments are present. Should not be used as a substitute for other input validation, as this says nothing about argument types or contents.

- `message` (Message) - The message that contained the command.

- `room` (Room) - The room in which the message was sent

### `added`

Sent when the bot is added to a room.

POST body data:

```ts
{
    event: "added",
    data: {
        room: Room,
        addedBy: UserData,
        time: number
    }
}
```

- `room` (Room) - The room that the bot was added to.

- `addedBy` (UserData) - The user that added the bot to the room.

- `time` (number) - The time that the bot was added (in unix timestamp form)

<hr>

## API Endpoints

### `rooms`

```none
> GET /bots/api/rooms
```

Returns all the rooms that the bot is a member of as a `Room[]`.

### `messages`

```none
> GET /bots/api/[roomID]/messages
```

Returns the last 50 messages sent in a room as a `Message[]`.

Parameters:

- `[roomId]` (string) - The ID of the room to get messages from

### `archive`

```none
> GET /bots/api/[roomID]/archive
```

Returns all messages sent in a room as a `Message[]`. _Note: will return 403/Forbidden if bot archive access is disabled in the room._

Parameters:

- `[roomID]` (string) - The ID of the room to get messages from

### `send`

```none
> POST /bots/api/send
```

Sends a message to the designated rooms. Returns a `Record<string, boolean>`, where each entry is a room ID and the corresponding `boolean` indicates whether or not the message was successfully sent to that room.

Request Body:

```ts
{
    data: {
        text: string,
        image?: string,
        replyTo?: number
    },
    include?: string[],
    exclude?: string[],
    wake?: boolean
}
```

- `data` (BotOutput) - The message to send

- `include` (string[]) (optional) - An array of room IDs to include. Any room not listed will be excluded, and no message will be sent to it.

- `exclude` (string[]) (optional) - An array of room IDs to exclude. Any room listed will be excluded, and no message will be sent to it.

- _Note:_ If neither include nor exclude are present, the message will be sent to all rooms that the bot is a member of.

- `wake` (boolean) (optional) - When a room is inactive for a long period of time, it will internally "go to sleep", which in this case means that bot messages will not be sent in it. If `wake` is `true`, then the room will be woken up to send this message. Defaults to `false` if not set.

[<img src="/public/logo.svg" alt="Backup Google Chat Logo" style="width:10%;display:block;margin-inline:auto;">](/)

<em class="last">Last updated 2024-11-17</em>
