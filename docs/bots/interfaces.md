# Interfaces

<title>Interfaces - Bots - Backup Google Chat</title>

Note: all types provided in [TypeScript](https://www.typescriptlang.org/).

For types in [JSDoc](https://jsdoc.app/), see `types.gs` in the [Bot Template](/bots/template).

## Basic Types

```ts
enum EventType {
    command = "command",
    added = "added"
}

type Event = {
    event: EventType.command,
    data: CommandRequest
} | {
    event: EventType.added,
    data: AddedRequest
}

interface CommandRequest {
    command: string;
    arguments: string[];
    areArgumentsValid: boolean;
    message: Message;
    room: Room;
}

interface AddedRequest {
    room: Room;
    addedBy: UserData;
    time: number;
}
```

## UserData

```ts
interface UserData {
    name: string;
    email: string;
    id: string;
    img: string;
    status?: Status;
    schedule?: string[];
    lastOnline?: number;
    activity?: string;
}

interface Status {
    status: string;
    char: string;
    updated: number;
}
```

## Messages

```ts
interface Message {
    id: number;
    author: {
        id: string;
        name: string;
        image: string;
    };
    text: string;
    time: string;
    media?: MessageMedia[];
    reactions?: {
        [key: string]: {
            id: string;
            name: string
        }[]
    };
    tags?: {
        color: string;
        text?: string;
        bgColor: string;
        icon?: string;
        temporary?: true;
    }[];
    readIcons?: UserData[];
    replyTo?: Message;
    poll?: Poll | PollResult;
    notSaved?: true;
    deleted?: true;
    muted?: true;
    links?: string[];
}

interface Poll {
    type: 'poll',
    finished: boolean,
    expires: number;
    question: string,
    options: {
        votes: number,
        option: string
        voters: string[]
    }[],
    id: number,
    creator: string,
}

interface PollResult {
    type: 'result',
    question: string,
    winner: string,
    originId: number
}

type MessageMedia = {
    type: "media" | "link";
    location: string;
    clickURL?: string;
    icon?: MediaIcon;
}

interface MediaIcon {
    name: string;
    alwaysShowing: boolean;
    title: string;
    color?: string;
    outlineColor?: string;
    text?: string;
    isLink?: true;
}
```

## Rooms

```ts
interface Room {
    name: string;
    emoji: string;
    rules: string[];
    description: string;
    id: string;
    owner?: UserData;
    members: MemberUserData[];
    bots: BotData[];
}

interface MemberUserData extends UserData {
    type: "member" | "invited";
    mute?: number;
    kick?: number;
}

interface BotData {
    name: string;
    image: string;
    description: string;
    id: string;
    by: {
        id: string,
        name: string,
        image: string,
    };
    check: boolean;
    roomCount: number;
    mute?: number;
    commands?: Command[];
    beta?: boolean;
    private?: string[];
}

interface Command {
    command: string;
    args: [string, string][];
    description: string;
}
```

## Output / Response Types

```ts
interface BotOutput {
    text: string;
    image?: string;
    replyTo?: number;
}

// Expected by POST /bots/api/send
interface SendMessageRequest {
    data: BotOutput,
    include?: string[],
    exclude?: string[],
    wake?: boolean;
}
```

[<img src="/public/logo.svg" alt="Backup Google Chat Logo" style="width:10%;display:block;margin-inline:auto;">](/)

<em class="last">Last updated 2024-11-17</em>
