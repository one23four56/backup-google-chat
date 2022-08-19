import { UserData } from '../../../ts/lib/authdata';
import { SubmitData } from '../../../ts/lib/socket';
import { BotData } from '../../../ts/modules/bots';
import { RoomFormat } from '../../../ts/modules/rooms';
import { StatusUserData } from '../../../ts/modules/session';
import Channel, { channelReference, View } from './channels'
import { emojiSelector } from './functions';
import { alert, confirm, prompt, sideBarAlert } from './popups';
import { me, socket } from './script';
import SideBar, { getMainSideBar, SideBarItem, SideBarItemCollection } from './sideBar';
import { FormItemGenerator, Header, searchUsers, TopBar } from './ui';

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
                name: 'Details',
                selected: false,
                icon: 'fa-solid fa-rectangle-list',
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

        this.createSideBar();

        document.body.append(this.topBar, this.sideBar);

        this.loadDetails();
        this.loadOptions();

        socket.on("webhook data", (roomId, data) => {
            if (roomId !== this.id)
                return;

            this.bar.loadWebhooks(data)
            this.bar.resetImage();
            this.bar.resetPlaceholder();
        })

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

        socket.on("hot reload room", (roomId, data) => {
            if (roomId !== this.id)
                return;

            // set room options 
            this.options = data.options;
            this.name = data.name;
            this.emoji = data.emoji;

            // reload
            this.reload();
        })

        socket.emit("get bot data", this.id);
        socket.emit("get member data", this.id);
        socket.emit("get online list", this.id);

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

        const canModifyMembers = (
            (
                this.options.permissions.invitePeople === "anyone" ||
                this.options.permissions.invitePeople === "poll"
            )
            ||
            (
                this.options.permissions.invitePeople === "owner" &&
                this.owner === me.id
            )
        )

        if (canModifyMembers) {
            const div = document.createElement("div");
            div.className = "member line";
            div.style.cursor = "pointer"

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

            if (
                userData.id !== me.id && 
                userData.id !== this.owner &&
                canModifyMembers
            ) {
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

        (this.membersView.lastChild as HTMLDivElement).classList.add("line")

        if (this.owner === me.id) {
            const div = document.createElement("div");
            div.className = "member line";
            div.style.cursor = "pointer"

            const image = document.createElement("img");
            image.src = "../public/add.png";

            const name = document.createElement("b");
            name.innerText = "Add bots";

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

        for (const bot of this.bar.botData) {

            const div = document.createElement("div");
            div.className = "member";

            const image = document.createElement("img");
            image.src = bot.image;

            const name = document.createElement("b");
            name.innerText = bot.name

            const details = document.createElement("i");
            details.className = "fa-solid fa-circle-info"

            div.append(image, name, details)

            if (me.id === this.owner) {

                const remove = document.createElement("i")
                remove.className = "fa-solid fa-ban";

                div.appendChild(remove)

            }


            this.membersView.append(div)
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

        const room: Room = channelReference[roomId] as Room;

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
        this.detailsView.innerText = ""

        const
            rulesInfo = document.createElement("fieldset"),
            rulesLegend = document.createElement("legend"),
            rules = document.createElement("ol"),
            descriptionInfo = document.createElement("fieldset"),
            descriptionInfoLegend = document.createElement("legend"),
            description = document.createElement("p"),
            basicInfo = document.createElement("fieldset"),
            basicInfoLegend = document.createElement("legend"),
            name = document.createElement("p"),
            emoji = document.createElement("p"),
            id = document.createElement("p");

        basicInfoLegend.innerText = "Details"
        basicInfo.appendChild(basicInfoLegend)

        name.innerText = "Room Name: " + this.name;
        emoji.innerText = "Room Emoji: " + this.emoji;
        id.innerText = "Room ID: " + this.id;

        if (this.owner === me.id) {
            const i = document.createElement("i")
            i.className = "fa-solid fa-pen-to-square fa-fw"

            name.style.cursor = "pointer"
            emoji.style.cursor = "pointer"

            name.addEventListener("click", () => {
                prompt("", "Enter new name:", this.name, 30).then(
                    res => socket.emit("modify name or emoji", this.id, "name", res) 
                ).catch()
            })

            emoji.addEventListener("click", event => {
                emojiSelector(event.clientX, event.clientY).then(
                    res => socket.emit("modify name or emoji", this.id, "emoji", res)
                ).catch()
            })

            name.append(i.cloneNode())
            emoji.append(i.cloneNode())
        }

        basicInfo.append(name, emoji, id)

        // description info

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


        this.detailsView.append(descriptionInfo, rulesInfo, basicInfo)

    }

    loadOptions() {

        // it took like 5 hours and like 20 different iterations of this function for 
        // me to finally find a version that i liked that also worked
        // god, this was rough

        this.optionsView.innerText = "";

        const
        generator = new FormItemGenerator(this.options, (this.owner !== me.id)),
        form = generator.generateForm([
            {
                name: 'Webhook Options',
                description: `Webhooks allow people to send messages with custom names and images. When webhooks are allowed, you can use one by clicking on your profile picture on the message bar and selecting the webhook you want. When you send a message with that webhook, your name and image in the message will be that of the webhook, rather than your own. Webhooks can also be used programmatically by external services to send messages in chat.\n\nWhen webhooks are not allowed, the profile picture on the message bar will not show up, and all webhook-related options will have no effect.`,
                items: [
                    {
                        type: "boolean",
                        boolean: this.options.webhooksAllowed,
                        question: 'Allow Webhooks?',
                        manipulator: (value, options) => options.webhooksAllowed = value,
                    }
                ]
            },
            {
                name: 'Archive Options',
                description: `The archive is where messages are saved. The archive viewer allows people to view and save large amounts of messages at once, so privacy-sensitive rooms may want to have it disabled.\n\nDisabling the archive viewer will hide the archive button in the sidebar, disable the archive loader and viewer, and block access to the raw archive json.`,
                items: [
                    {
                        type: "boolean",
                        boolean: this.options.archiveViewerAllowed,
                        question: 'Allow Archive Viewer?',
                        manipulator: (value, options) => options.archiveViewerAllowed = value,
                    }
                ]
            },
            {
                name: 'Auto Moderator Options',
                description: `The Auto Moderator (also known as automod) is a system that automatically blocks spam messages. Whenever it detects a spam message, it will block the message and issue a warning to whoever sent the message. If that pushes the user's warnings above the max allowed, the user will be muted for 2 minutes.\n\n The strictness option sets the strictness for spam detection.\nThe warnings option is the max number of warnings the automod will give out before a mute.`,
                items: [
                    {
                        type: "number",
                        number: this.options.autoMod.strictness,
                        max: 5,
                        min: 1,
                        question: "Automod Strictness",
                        manipulator: (value, options) => options.autoMod.strictness = value,
                    },
                    {
                        type: "number",
                        number: this.options.autoMod.warnings,
                        max: 5,
                        min: 1,
                        question: "Max Warnings",
                        manipulator: (value, options) => options.autoMod.warnings = value,
                    }
                ]
            },
            {
                name: 'Permission Options',
                description: `The following options control who can do certain things in the room.\n\nOwner allows only the room owner to complete the action\nAnyone allows anyone to do it\nPoll allows anyone to do it, but non-owners require the approval of a poll.\n`,
                items: [
                    {
                        type: "permissionSelect",
                        permission: this.options.permissions.invitePeople,
                        question: 'Inviting/Removing People',
                        manipulator: (value, options) => options.permissions.invitePeople = value
                    }
                ]
            }
        ])

        form.addEventListener("reset", event => {
            generator.resetData(this.options)
            alert(`Any changed settings have been reverted back to what they were`, 'Changes Canceled')
        })

        form.addEventListener("submit", event => {
            event.preventDefault()

            // the form automatically validates the inputs, which saves a lot of work

            if (JSON.stringify(generator.data) === JSON.stringify(this.options)) {
                // more validation to avoid sending useless requests to the server
                alert(`You have not changed any settings!`, 'Unable to Save')
                return;
            }

            socket.emit("modify options", this.id, generator.data)

        })

        this.optionsView.append(form)

    }

    createSideBar() {

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
            clickEvent: () => {
                this.topBar.items.find(item => item.name === "Members").div.click();
            }
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
    }

    reload() {
        
        this.createMessageBar({
            name: this.name,
            placeHolder: `Send a message to ${this.name}...`,
            hideWebhooks: !this.options.webhooksAllowed
        });

        this.createSideBar();

        this.loadOptions();
        this.loadDetails();

        const item = SideBar.createEmojiItem({
            title: this.name,
            emoji: this.emoji,
            clickEvent: () => {
                this.makeMain()
            }
        })

        this.sideBarItem.replaceWith(item)
        this.sideBarItem = item;

        document.body.append(this.sideBar);

        if (this.mainView.isMain) {
            this.bar.makeMain();
            this.sideBar.makeMain();
            this.mainView.makeMain();
            Header.set(this.name, this.emoji)
        }

        socket.emit("get bot data", this.id)
        socket.emit("get member data", this.id)
        socket.emit("get online list", this.id)

        console.log(`${this.name} (${this.id}): performed hot reload`)

    }

    createMessageBar(barData: any): void {
        super.createMessageBar(barData)

        socket.emit("get webhooks", this.id, (webhooks) => {
            this.bar.loadWebhooks(webhooks)
        })

        this.bar.submitHandler = (data: SubmitData) => {
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