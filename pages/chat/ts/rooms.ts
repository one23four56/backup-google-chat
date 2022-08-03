import { UserData } from '../../../ts/lib/authdata';
import { RoomFormat } from '../../../ts/modules/rooms';
import Channel, { View } from './channels'
import { me, socket } from './script';
import SideBar, { getMainSideBar, SideBarItem } from './sideBar';
import { Header, TopBar } from './ui';

export default class Room extends Channel {

    rules: RoomFormat["rules"];
    options: RoomFormat["options"];
    emoji: RoomFormat["emoji"];
    members: RoomFormat["members"];
    owner: RoomFormat["owner"];

    sideBarItem: SideBarItem;

    topBar: TopBar;
    sideBar: SideBar;

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

        this.detailsView = new View(id, this, true)
        this.membersView = new View(id, this, true)
        this.optionsView = new View(id, this, true)

        document.body.append(
            this.detailsView,
            this.membersView,
            this.optionsView
        )

        const mainSideBar = getMainSideBar();
        const item = SideBar.createEmojiItem({
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

        this.sideBar = new SideBar()
        SideBar.createDefaultItem(SideBar.timeDisplayPreset).addTo(this.sideBar)
        this.sideBar.addLine()
        SideBar.createIconItem({
            icon: 'fa-solid fa-circle-arrow-left',
            title: 'Back',
            clickEvent: () => Room.resetMain()
        }).addTo(this.sideBar)
        this.sideBar.addLine()

        document.body.append(this.topBar, this.sideBar);

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

        socket.on("member data", (roomId, data) => {
            if (roomId !== this.id)
                return;

            this.loadMembers(data)
        });

        socket.emit("get member data", this.id);

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
        this.sideBar.makeMain();

        Header.set(this.name, this.emoji)
    }

    static resetMain(): void {
        Channel.resetMain();

        TopBar.resetMain();
        getMainSideBar().makeMain();
        Header.reset();
    }

    loadMembers(userDataArray: UserData[]) {

        this.membersView.innerText = "";

        {
            const div = document.createElement("div");
            div.className = "member";

            const image = document.createElement("img");
            image.src = "../public/add.png";

            const name = document.createElement("b");
            name.innerText = "Invite people";

            div.append(image, name);

            this.membersView.appendChild(div);
        }
        
        for (const userData of userDataArray) {

            const div = document.createElement("div");
            div.className = "member";

            const image = document.createElement("img");
            image.src = userData.img;

            const name = document.createElement("b");
            name.innerText = userData.name;

            if (userData.id === me.id)
                name.innerText += " (you)";

            div.append(image, name);

            this.membersView.appendChild(div);
            
        }

    }
}