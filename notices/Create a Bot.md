<!--title:How to Create a Bot:title-->
<!--date:2022-04-24:date-->
# How to Create a Bot

Bots were added as part of the Account Update (v1.4.0).  
There are three types of bots:

- Command-Activated
- Filter-Activated
- Trigger-Activated

Command-activated bots are the easiest to make, but also very limited. Filter-activated bots are slightly harder but can do way more. Trigger-activated bots are the most flexible, but also the hardest to make.  

The following will explain how to make each type of bot.

## Step 1: Prepare File

This step is required for every bot.
To create a bot you first need to make a new typescript file in the modules/bots folder. The name of the file should be the name of the bot.  
In the file, import the `BotTemplate` interface from `modules/bots` (you will probably also want to import the message interface)

```ts
import { BotTemplate } from '../bots';
import Message from '../../lib/msg';
```

Once you have imported the bot template, you need to make a class that implements it.

```ts
    export default class ExampleBot implements BotTemplate {
        name: string;
        image: string;
        desc: string;

        constructor() {
            this.name = 'Example Bot';
            this.image = '../public/favicon.png';
            this.desc = 'An example bot';
        }
    }
```

This class is your bot. The bot above has no type and does nothing. The following section will explain how to give the bot functionality.

## Step 2: Give the Bot Functionality

### Command-Activated Bot

A command-activated bot is the simplest to make. Set the `commands` property to an array of objects. Each object should contain the command and its arguments.

```ts
export default class HelperBot implements BotTemplate {
    name: string;
    image: string;
    desc: string;
    commands: {
        command: string,
        args: string[],
    }[];

    constructor() {
        this.name = 'Helper Bot';
        this.image = '../public/favicon.png';
        this.desc = 'A bot that helps you with some things';
        this.commands = [{ command: 'help', args: []}];
    }

}
```

To handle the commands, use the runCommand method.

```ts
export default class HelperBot implements BotTemplate {

    //...//

    runCommand(command: string, args: string[], message: Message): string {
        return `Hello ${message.author.name}! I am a bot. You can find a list of bots in the Bot List (pfp in top right > bot list)`;
    }
} 
```

The run command method is called when a command is found in a new message. It receives three arguments:

- `command: string` - The command that activated the bot
- `args: string[]` - The arguments passed with the command
- `message: Message` - The message that triggered the bot

#### Multiple Commands

You can use a switch or if statement to determine what command was used if the bot accepts multiple.

```ts
export default class TimeBot implements BotTemplate {

    //...//

    runCommand(command: string, args: string[], message: Message): string {
        switch (command) {
            case "time tell":
                //...
            case "time help":
                //...
            case "time pd help":
                //...
            case "time school":
                //...

        }
    }
```

(Example from Time Bot)

#### Handling Arguments

The arguments are passed as an array. This can be annoying to work with. For that reason, I recommend that you use the `generateArgMap` function.

```ts
import { BotOutput, BotTemplate, BotUtilities } from '../bots';
import Message, { Poll } from '../../lib/msg';

export default class Polly implements BotTemplate {

    //...//

    runCommand(command: string, args: string[], message: Message): BotOutput | string {
        if (command === 'poll' || command === 'polly') {
            const parsedArgs = BotUtilities.generateArgMap(args, this.commands[0].args);
            //...
        }
    }
}
```

(Example from Polly)

The function generates an object containing all the arguments by name. It also validates the arguments, and returns false if they do not comply with the map that was given.

```ts
if (typeof parsedArgs === 'boolean') return 'Invalid arguments';

if 
(
    parsedArgs.option1 === parsedArgs.option2 
    || 
    parsedArgs.option1 === parsedArgs.option3 
    || 
    parsedArgs.option2 === parsedArgs.option3
) 
return 'Arguments must be different';
```

(Example from Polly)

#### Output

The runCommand function (and runFilter) can output four different types:

- `string`
- `BotOutput`
- `Promise<string>`
- `Promise<BotOutput>`

If it outputs a string, the bot message will be sent with the string as the text.  

If it outputs a BotOutput object, the message will be sent with the properties defined in the object.

```ts
export interface BotOutput {
    text: string;
    image?: string;
    poll?: Poll;
    replyTo?: Message;
}
```

(modules/bots.ts)  

If it outputs a promise, the promise will be awaited, then the message will be sent.

### Filter-Activated Bot

Filter-activated bots are essentially manual command-activated bots. Instead of checking for commands, the bot's check method is ran on every message.

```ts
    check(message: Message): boolean {
        if (message.id && (message.id + 1) % 100 === 0) return true;
        return false;
    }
```

(Example from archive bot)  

If the check method returns true, the runFilter method will be called. It is very similar to the runCommand method, however it does not have the command as an argument, it only has the message.

```ts
    runFilter(message: Message): string {
        return `Congratulations! ${message.author.name} sent message #${message.id + 1}! 🎉🎉🎉`;
    }
```

(Example from archive bot)  

The output for filter-activated bots is the same as it is for command-activated bots.

### Trigger-Activated Bots

Trigger-activated bots are the most flexible. They must have a runTrigger method, and that can be called whenever. They can optionally have a startTrigger method, which is called on bot registration.

### Hybrid

Bots can be two types at once. To become a hybrid type, just use functions from multiple types.

```ts
import { BotTemplate } from '../bots';
import Message from '../../lib/msg';
import * as fs from 'fs';
import { Archive } from '../archive';

export default class ArchiveBot implements BotTemplate {
    name: string;
    image: string;
    desc: string;
    commands: {
        command: string,
        args: string[],
    }[];

    constructor() {
        this.name = 'Archive Bot';
        this.image = '../public/archive.png';
        this.desc = 'A bot that alerts you when important messages are sent, and tells stats about the archive';
        this.commands = [{ command: 'stats', args: ["'name'?"]}];
    }

    runCommand(_command: string, args: string[], message: Message): string {
        let name;
        if (args.length === 0 || !args[0] || args[0].length === 0) name = message.author.name;
        else name = args[0];
        const size: number = fs.statSync('messages.json').size;
        const myMessages = Archive.getData().getDataReference()
            .filter(checkMessage => checkMessage.author.name === name || checkMessage.sentBy === name).length;

        if (myMessages === 0) return `${name} has not sent any messages.`;

        return `The archive currently has ${Archive.getData().getDataReference().length} messages, and it takes up ${(size / 1000000).toFixed(2)} MB. `
            + `${name} has sent ${myMessages} messages, which is ${(myMessages / Archive.getData().getDataReference().length * 100).toFixed(2)}% of the archive.`
    }

    check(message: Message): boolean {
        if (message.id && (message.id + 1) % 100 === 0) return true;
        return false;
    }

    runFilter(message: Message): string {
        return `Congratulations! ${message.author.name} sent message #${message.id + 1}! 🎉🎉🎉`;
    }
}
```

(Example from archive bot)

*Note: the example above manually validates arguments. You can do that, but `BotUtilities.generateArgMap()` is easier*

## Register a Bot

The final step of making a bot is to register it. This is very simple. All you have to do is import the bot into the bots.ts file (in modules), scroll down to the bottom, and add:

```ts
import BotName from './bots/botname'

//...//

//*------------------------------------------------------*//
//* Register bots below
//*------------------------------------------------------*//

Bots.register(new BotName())
```
