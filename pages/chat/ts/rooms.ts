import { RoomFormat } from '../../../ts/modules/rooms';
import Channel, { View } from './channels'
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

    detailsView: View;
    membersView: View;
    optionsView: View;

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

        this.detailsView = new View(id, this)
        this.membersView = new View(id, this)
        this.optionsView = new View(id, this)

        document.body.append(
            this.detailsView,
            this.membersView,
            this.optionsView
        )

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
                onSelect: () => {
                    this.chatView.makeMain();
                    this.mainView = this.chatView;
                },
            },
            {
                name: 'Details',
                selected: false,
                icon: 'fa-solid fa-circle-info',
                onSelect: () => {
                    this.detailsView.makeMain();
                    this.mainView = this.detailsView
                }
            },
            {
                name: 'Members',
                selected: false,
                icon: 'fa-solid fa-users',
                onSelect: () => {
                    this.membersView.makeMain();
                    this.mainView = this.membersView
                }
            },
            {
                name: 'Options',
                selected: false, 
                icon: 'fa-solid fa-gears',
                onSelect: () => {
                    this.optionsView.makeMain();
                    this.mainView = this.optionsView
                }
            }
        ]);
        
        document.body.appendChild(this.topBar);

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

    makeMain(): void {
        super.makeMain();
        this.topBar.makeMain();
    }
}