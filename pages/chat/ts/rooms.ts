import { UserData } from '../../../ts/lib/authdata';
import { BotData } from '../../../ts/modules/bots';
import { RoomFormat } from '../../../ts/modules/rooms';
import { StatusUserData } from '../../../ts/modules/session';
import Channel, { channelReference, View } from './channels'
import { confirm, sideBarAlert } from './popups';
import { me, socket } from './script';
import SideBar, { getMainSideBar, SideBarItem, SideBarItemCollection } from './sideBar';
import { Header, searchUsers, TopBar } from './ui';

export default class Room extends Channel {

    rules: RoomFormat["rules"];
    options: RoomFormat["options"];
    emoji: RoomFormat["emoji"];
    members: RoomFormat["members"];
    owner: RoomFormat["owner"];

    onlineList: StatusUserData[];

    sideBarItem: SideBarItem;
    onlineSideBarItem: SideBarItem;

    onlineSideBarCollection: SideBarItemCollection;

    topBar: TopBar;
    sideBar: SideBar;

    detailsView: View;
    membersView: View;
    optionsView: View;

    botData: BotData[];

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

        if (this.options.archiveViewerAllowed) SideBar.createIconItem({
            icon: 'fa fa-archive fa-fw',
            title: 'Archive',
            clickEvent: () => window.open(location.origin + `/${this.id}/archive`)
        }).addTo(this.sideBar)

        SideBar.createIconItem({
            icon: 'fa-solid fa-robot',
            title: 'Bots',
            clickEvent: () => window.open(location.origin + `/${this.id}/bots`)
        }).addTo(this.sideBar)

        SideBar.createIconItem({
            icon: 'fa-solid fa-chart-pie',
            title: 'Stats',
            clickEvent: () => window.open(location.origin + `/${this.id}/archive`)
        }).addTo(this.sideBar)

        this.sideBar.addLine()

        this.onlineSideBarItem = SideBar.createIconItem({
            icon: 'fa-solid fa-spinner fa-pulse',
            title: 'Loading Online Users...'
        }).addTo(this.sideBar)

        this.onlineSideBarCollection = this.sideBar.addCollection("online")

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

        socket.on("online list", (roomId, data) => {
            if (roomId !== this.id)
                return;
            
            this.loadOnlineList(data)
        })

        socket.on("bot data", (roomId, data) => {
            if (roomId !== this.id)
                return;

            this.bar.commands = data
                .map(bot => bot.commands.map(command => command.command))
                .flat() // i had no idea flat existed until i just typed it thinking
                        // 'oh wouldn't it be cool if they had a function that just 
                        // flattens the array for you' and then it autocompleted
                
                .sort() // just because

            this.bar.botData = data;
            
        })

        socket.emit("get member data", this.id);
        socket.emit("get online list", this.id);
        socket.emit("get bot data", this.id);

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

        this.members = userDataArray.map(data => data.id);

        this.membersView.innerText = "";

        {
            const div = document.createElement("div");
            div.className = "member";

            const image = document.createElement("img");
            image.src = "../public/add.png";

            const name = document.createElement("b");
            name.innerText = "Invite people";

            div.append(image, name);

            div.addEventListener("click", () => {
                searchUsers(`Invite to ${this.name}`, this.members)
                .then(user => {
                    confirm(`Invite ${user.name}?`, `Invite ${user.name}?`)
                    .then(res => {
                        if (res)
                            socket.emit("invite user", this.id, user.id)
                    })
                    .catch()
                })
                .catch()
            })

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

            if (userData.id === this.owner)
                name.innerText += " (owner)";

            div.append(image, name);

            if (userData.id !== me.id && userData.id !== this.owner) {
                const remove = document.createElement("i")
                remove.className = "fa-solid fa-ban";

                div.appendChild(remove)

                remove.addEventListener("click", () => {
                    confirm(`Remove ${userData.name}?`, `Remove ${userData.name}?`).then(res => {
                        if (res)
                            socket.emit("remove user", this.id, userData.id)
                    })
                })
            }

            this.membersView.appendChild(div);
            
        }

    }

    remove(): void {
        this.detailsView.remove();
        this.membersView.remove();
        this.optionsView.remove();
        this.topBar.remove();
        this.sideBar.remove();
        this.sideBarItem.remove();

        if (this.mainView.isMain)
            Room.resetMain();
        
        super.remove();
    }

    static addedToRoomHandler(roomData: RoomFormat) {
        sideBarAlert(`You have been added to ${roomData.name}`, 5 * 1000)

        new Room(roomData);
    }

    static removedFromRoomHandler(roomId: string) {

        const room: Room = channelReference[roomId]

        if (!room) return;

        sideBarAlert(`You have been removed from ${room.name}`, 5 * 1000)

        room.remove();
    }

    loadOnlineList(onlineList: StatusUserData[]) {
        this.onlineList = onlineList

        this.onlineSideBarCollection.innerText = "";

        onlineList.forEach(user => {
            SideBar.createImageItem({
                image: user.img,
                title: user.name,
                icon: user.id === me.id ? 'fa-regular fa-face-meh-blank fa-fw' : 'far fa-comment fa-fw',
                emoji: user.status? user.status.char : undefined,
                afk: user.afk
            }).addTo(this.onlineSideBarCollection)
        })

        const newSideBarItem = SideBar.createIconItem({
            icon: 'fas fa-user-alt',
            title: `Currently Online (${onlineList.length}):`
        })

        this.onlineSideBarItem.replaceWith(newSideBarItem)

        this.onlineSideBarItem = newSideBarItem
    }
}