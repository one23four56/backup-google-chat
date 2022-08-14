import { UserData } from '../../../ts/lib/authdata';
import { BotData } from '../../../ts/modules/bots';
import { RoomFormat } from '../../../ts/modules/rooms';
import { StatusUserData } from '../../../ts/modules/session';
import Channel, { channelReference, View } from './channels'
import { confirm, prompt, sideBarAlert } from './popups';
import { me, socket } from './script';
import SideBar, { getMainSideBar, SideBarItem, SideBarItemCollection } from './sideBar';
import { Header, searchUsers, TopBar } from './ui';

export default class Room extends Channel {

    rules: RoomFormat["rules"];
    description: RoomFormat["description"];
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

    constructor({ id, name, rules, options, emoji, members, owner, description }: RoomFormat) {
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
        this.description = description;

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
                name: 'Rules',
                selected: false,
                icon: 'fa-solid fa-list-ol',
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

        this.onlineSideBarCollection = this.sideBar.addCollection("online", {
            icon: 'fa-solid fa-spinner fa-pulse',
            title: 'Loading Online Users...'
        })

        this.onlineSideBarItem = this.onlineSideBarCollection.titleElement

        this.sideBar.addLine()

        document.body.append(this.topBar, this.sideBar);

        this.loadDetails();

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

        socket.on("room details updated", (roomId, data) => {
            if (roomId !== this.id)
                return;

            this.description = data.desc;
            this.rules = data.rules;

            this.loadDetails();
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

    loadDetails() {

        const basicInfo = document.createElement("fieldset")
        const basicInfoLegend = document.createElement("legend")
        basicInfoLegend.innerText = "Room Details"
        basicInfo.appendChild(basicInfoLegend)

        const name = document.createElement("p")
        name.innerText = "Room Name: " + this.name;

        const emoji = document.createElement("p")
        emoji.innerText = "Room Emoji: " + this.emoji;

        const id = document.createElement("p")
        id.innerText = "Room ID: " + this.id;

        basicInfo.append(name, emoji, id)

        this.detailsView.innerText = ""

        const
            rulesInfo = document.createElement("fieldset"),
            rulesLegend = document.createElement("legend"),
            rules = document.createElement("ol"),
            descriptionInfo = document.createElement("fieldset"),
            descriptionInfoLegend = document.createElement("legend"),
            description = document.createElement("p")


        description.innerText = this.description
        descriptionInfo.append(descriptionInfoLegend, description)
        
        for (const rule of this.rules) {
            const ruleElement = document.createElement("li")

            if (this.owner === me.id) {
                const i = document.createElement("i")
                i.className = "fa-solid fa-trash-can fa-fw"

                i.addEventListener("click", () => {
                    confirm(`Delete the rule '${rule}'?`, 'Delete rule?').then(res => {
                        if (!res) return;

                        socket.emit("modify rules", this.id, "delete", rule)
                    })
                })

                i.style.cursor = 'pointer'

                ruleElement.append(
                    document.createTextNode(rule),
                    i
                )
            } else
                ruleElement.innerText = rule;

            rules.appendChild(ruleElement)
        }

        rulesInfo.append(rulesLegend, rules)

        rulesLegend.innerText = "Rules"

        if (this.owner === me.id) {

            {
                const p = document.createElement("p")
                p.innerHTML = '<i class="fa-solid fa-plus fa-fw"></i> Add Rule'
                p.style.cursor = "pointer"

                p.addEventListener("click", () => {
                    prompt('', 'Add Rule', '', 100).then(res => {
                        socket.emit("modify rules", this.id, "add", res)
                    }).catch()
                })

                rules.appendChild(p)
            }

            descriptionInfoLegend.innerHTML = 'Description <i class="fa-solid fa-pen-to-square"></i>'
            // just spent like 10 minutes remembering and writing the complicated way to do this 
            // without setting innerHTMl but then i realized that it doesn't even involve user 
            // input so i don't even need to do that

            descriptionInfoLegend.style.cursor = "pointer"

            descriptionInfoLegend.addEventListener("click", () => {
                prompt('', 'Edit Description', this.description, 100).then(res => 
                    socket.emit("modify description", this.id, res)    
                ).catch()
            })
        } else 
            descriptionInfoLegend.innerText = "Description"


        this.detailsView.append(descriptionInfo, rulesInfo)

    }
}