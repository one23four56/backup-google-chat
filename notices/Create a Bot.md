<!--title:How to Create a Bot:title-->
<!--date:2022-04-24:date-->
# How to Create a Bot

Bots were added as part of the Account Update (v1.4.0).  
There are 3 types of bots: command-activated, filter-activated, and trigger-activated. Filter-activated bots activate when a message meets certain criteria. Command-activated bots activate when a message contains a command. They are essentially pre-made filter-activated bots. Trigger-activated bots are activated by any custom trigger. Bots can be a mix of multiple types.

## Prepare File

To create a bot you first need to make a new typescript file in the modules/bots folder. The name of the file should be the name of the bot. Once the file is done, import the BotTemplate interface from modules/bots (you will probably also want to import the message interface)

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

## Command-Activated Bot

A command activated bot is very simple to make. Just set the commands property of the bot to an array of all commands you want the bot to be triggered on. For example, this bot will be triggered on /example:

```ts
    export default class ExampleBot implements BotTemplate {
        name: string;
        image: string;
        desc: string;
        commands: string[];
        
        constructor() {
            this.name = 'Example Bot';
            this.image = '../public/favicon.png';
            this.desc = 'An example bot';
            this.commands = ['example']
        }
    }
```

To handle the commands, use the runCommand method.

```ts
export default class ExampleBot implements BotTemplate {

    //...//

    runCommand(command: string, message: Message): string {
        return `I am an example bot`
    }
} 
```

The run command method is called when a command is found in a new message. The command property is the command that was found. The message property is the message it was found in. The method has to return a string. That string will become the text for a message sent by the bot.  
If you have multiple commands, use the switch operator, as in this example from the time bot:

```ts
export default class TimeBot implements BotTemplate {
    name: string;
    image: string;
    desc: string;
    commands: string[];

    constructor() {
        //...//
        this.commands = ["time tell", "time help", "time school", "time pd help"];
    }

    runCommand(command: string, message: Message): string {
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

## Filter-Activated Bot

A filter-activated bot is only slightly harder to make. It is not as easy as just setting the commands property, but it is far more versatile.  
Filter-activated bots have a check method. The check method receives a message and returns either true or false.

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

## Trigger-Activated Bots

Trigger-activated bots are kinda useless and also annoying. They have a startTrigger method that is called on bot registration and a runTrigger method. The startTrigger method should call the runTrigger method.

## Hybrid

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
    commands: string[];

    constructor() {
        this.name = 'Archive Bot';
        this.image = 'https://admissions.ucr.edu/sites/g/files/rcwecm2006/files/styles/form_preview/public/2019-10/Archive-icon.png?itok=3VTR_lYi';
        this.desc = 'A bot that tells the length of the archive';
        this.commands = ['stats'];
    }

    runCommand(command: string, message: Message): string {
        const size: number = fs.statSync('messages.json').size;
        const myMessages = Archive.getArchive()
            .filter(checkMessage => checkMessage.author.name === message.author.name || checkMessage.sentBy === message.author.name).length;

        return `The archive currently has ${Archive.getArchive().length} messages, and it takes up ${(size / 1000000).toFixed(2)} MB. `
            + `You (${message.author.name}) have sent ${myMessages} messages, which is ${(myMessages / Archive.getArchive().length * 100).toFixed(2)}% of the archive.`
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
