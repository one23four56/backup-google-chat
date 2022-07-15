import { RoomFormat } from '../../../ts/modules/rooms';
import Channel from './channels'
import { socket } from './script';

export default class Room extends Channel {

    rules: RoomFormat["rules"];
    options: RoomFormat["options"];
    emoji: RoomFormat["emoji"];
    members: RoomFormat["members"];
    owner: RoomFormat["owner"]

    constructor({ id, name, rules, options, emoji, members, owner }: RoomFormat) {
        super(id, name, {
            name: name,
            placeHolder: `Send a message to ${name}...`,
            hideWebhooks: !options.webhooksAllowed
        });

        this.rules = rules;
        this.options = options;
        this.emoji = emoji;
        this.members = members;
        this.owner = owner;

        this.bar.submitHandler = (data) => {
            
            socket.emit("message", this.id, {
                archive: data.archive,
                text: data.text,
                webhook: data.webhook,
                replyTo: data.replyTo, 
            }, (sent) => {

            })

        }

    }
}