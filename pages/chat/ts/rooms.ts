import { RoomFormat } from '../../../ts/modules/rooms';
import { ProtoWebhook } from '../../../ts/modules/webhooks';
import Channel from './channels'
import { socket } from './script';
import { getMainSideBar, SideBarItem } from './sideBar';
import TopBar from './topbar';

export default class Room extends Channel {

    rules: RoomFormat["rules"];
    options: RoomFormat["options"];
    emoji: RoomFormat["emoji"];
    members: RoomFormat["members"];
    owner: RoomFormat["owner"];

    sideBarItem: SideBarItem;
    topBar: TopBar;

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

        const mainSideBar = getMainSideBar();
        const item = mainSideBar.createEmojiItem({
            title: name,
            emoji: emoji,
            clickEvent: () => {
                this.makeMain()
            }
        })
        item.addTo(mainSideBar.collections["rooms"])
        this.sideBarItem = item;

        this.topBar = new TopBar([
            {
                name: 'Chat',
                icon: 'fa-solid fa-comments',
                selected: true,
                onSelect() {
                    console.log('e')
                },
            },
            {
                name: 'Details',
                selected: false,
                icon: 'fa-solid fa-circle-info',
                onSelect() {
                    console.log('f')
                },
            },
            {
                name: 'Options',
                selected: false, 
                icon: 'fa-solid fa-gears',
                onSelect() {
                    console.log('5')
                },
            }
        ]);
        
        this.view.appendChild(this.topBar);

        if (this.options.webhooksAllowed) {
            socket.emit("get webhooks", this.id, (webhooks) => {
                this.bar.loadWebhooks(webhooks)
            })

            socket.on("webhook data", (roomId, data) => {
                if (roomId !== this.id)
                    return;

                this.bar.loadWebhooks(data)
                this.bar.resetImage();
                this.bar.resetPlaceholder();
            })
        }

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