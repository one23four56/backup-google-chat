import { UserData } from '../../../ts/lib/authdata';
import { MemberUserData } from '../../../ts/lib/misc';
import { RoomFormat } from '../../../ts/modules/rooms';
import Channel, { channelReference, mainChannelId, View, ViewContent } from './channels'
import { emojiSelector } from './functions';
import { alert, confirm, prompt, sideBarAlert } from './popups';
import { me, socket } from './script';
import SideBar, { getMainSideBar, getUserSideBarItem, SideBarItem, SideBarItemCollection } from './sideBar';
import { FormItemGenerator, Header, openBotInfoCard, searchBots, searchUsers, TopBar } from './ui';

export let mainRoomId: string | undefined;

export default class Room extends Channel {

    rules: RoomFormat["rules"];
    description: RoomFormat["description"];
    options: RoomFormat["options"];
    emoji: RoomFormat["emoji"];
    members: RoomFormat["members"];
    owner: RoomFormat["owner"];

    onlineList: UserData[];

    sideBarItem: SideBarItem;
    onlineSideBarItem: SideBarItem;

    onlineSideBarCollection: SideBarItemCollection;

    topBar: TopBar;
    sideBar: SideBar;

    detailsView: ViewContent;
    membersView: ViewContent;
    optionsView: ViewContent;

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

        this.detailsView = this.viewHolder.addContent("details")
        this.membersView = this.viewHolder.addContent("members")
        this.optionsView = this.viewHolder.addContent("options")

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

        document.body.append(this.sideBar);
        this.viewHolder.addTopBar(this.topBar)

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
            this.owner = data.owner;

            // reload
            this.reload();
        })

        socket.emit("get bot data", this.id);
        socket.emit("get member data", this.id);
        socket.emit("get online list", this.id);

    }

    makeMain(): void {
        super.makeMain();
        this.sideBar.makeMain();

        SideBar.isMobile && this.sideBar.collapse()

        Header.set(this.name, this.emoji)

        mainRoomId = this.id
    }

    static resetMain(): void {
        Channel.resetMain();

        getMainSideBar().makeMain();
        Header.reset();

        mainRoomId = undefined;
    }

    loadMembers(userDataArray: MemberUserData[]) {

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
                    confirm('', `Invite ${user.name}?`)
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

            if (userData.type === "invited") {
                div.style.opacity = "0.5"
                div.title = `${userData.name} is not a member of ${this.name}, but they are currently invited to become one.`
            }

            const image = document.createElement("img");
            image.src = userData.img;

            const name = document.createElement("b");
            name.innerText = userData.name;

            if (userData.id === me.id) {
                name.innerText += " (you)";
            }

            if (userData.id === this.owner)
                name.innerText += " (owner)";

            div.append(image, name);

            if (userData.id !== this.owner && userData.id === me.id) {
                const leave = document.createElement("i")
                leave.className = "fa-solid fa-arrow-right-from-bracket"

                leave.addEventListener("click", () => {
                    confirm(`You will not be able to rejoin unless you are invited back`, `Leave ${this.name}?`).then(res => {
                        if (res)
                            socket.emit("leave room", this.id)
                    })
                })

                div.appendChild(leave)
            }

            if (
                userData.id !== me.id && 
                userData.id !== this.owner &&
                canModifyMembers
            ) {
                const remove = document.createElement("i")
                remove.className = "fa-solid fa-ban";

                div.appendChild(remove)

                remove.addEventListener("click", () => {
                    confirm(``, `Remove ${userData.name}?`).then(res => {
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
                searchBots(`Add a Bot to ${this.name}`, this.bar.botData.map(item => item.name))
                    .then(bot => {
                        confirm('', `Add ${bot}?`)
                            .then(res => {
                                if (res)
                                    socket.emit("modify bots", this.id, "add", bot)
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

            details.addEventListener("click", () => openBotInfoCard(bot))

            div.append(image, name, details)

            if (me.id === this.owner) {

                const remove = document.createElement("i")
                remove.className = "fa-solid fa-ban";

                remove.addEventListener("click", () => {
                    confirm('', `Remove ${bot.name}?`).then(res => {
                        if (res)
                            socket.emit("modify bots", this.id, "delete", bot.name)
                    })
                })

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

    loadOnlineList(onlineList: UserData[]) {
        this.onlineList = onlineList

        this.onlineSideBarCollection.clear()

        onlineList.forEach(user => getUserSideBarItem(user).addTo(this.onlineSideBarCollection))

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
            },
            {
                name: `Mediashare Options`,
                description: `Mediashare is the system that allows files to be shared in rooms. Mediashare is built in to Backup Google Chat and can store up to 100 MB of files per room.\n\nAuto delete will automatically delete old media to make space for new media when the total size of all media exceeds 100 MB. With auto delete off, no media can be sent when the total media size is above 100 MB.`,
                items: [
                    {
                        type: "boolean",
                        boolean: this.options.autoDelete,
                        question: `Automatically delete old media?`,
                        manipulator: (value, options) => options.autoDelete = value
                    }
                ]
            },
            {
                name: 'Webhook Options',
                description: `Webhooks allow people to send messages with custom names and images. When webhooks are allowed, you can use one by clicking on your profile picture on the message bar and selecting the webhook you want. When you send a message with that webhook, your name and image in the message will be that of the webhook, rather than your own. Webhooks can also be used programmatically by external services to send messages in chat.\n\nWhen webhooks are not allowed, the profile picture on the message bar will not show up, and all webhook-related options will have no effect.\nA private webhook is a webhook that only the owner can edit and use. Anyone can delete a private webhook; however, for anyone who is not the owner, this requires the approval of a poll`,
                items: [
                    {
                        type: "boolean",
                        boolean: this.options.webhooksAllowed,
                        question: 'Allow webhooks?',
                        manipulator: (value, options) => options.webhooksAllowed = value,
                    },
                    {
                        type: "boolean",
                        boolean: this.options.privateWebhooksAllowed,
                        question: 'Allow private webhooks?',
                        manipulator: (value, options) => options.privateWebhooksAllowed = value,
                    }
                ]
            },
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

        if (this.owner === me.id) {

            this.optionsView.append(document.createElement("hr"))

            const div = document.createElement("fieldset")
            div.className = "danger-zone"

            const legend = document.createElement("legend")
            legend.innerText = "Danger Zone"

            const desc = document.createElement("p")
            desc.innerText = `Every option here can have a PERMANENT, IRREVERSIBLE effect on the room.\n\nMake sure you are completely confident in your decision before selecting any option here as they cannot be reversed.`

            const del = document.createElement("button")
            del.innerText = "Delete Room"

            del.addEventListener("click", async () => {
                if (this.members.length !== 1) {
                    alert(`There are currently ${this.members.length} members of ${this.name}. In order to delete the room, there must only be 1 member (the owner). If you want to delete the room, remove everyone else from it.`, `Cannot Delete ${this.name}`)
                    return;
                }

                // comically large amount of confirmations

                if (!await confirm(`Are you sure you want to delete ${this.name}? This action is not reversible.`, `Delete ${this.name}?`))
                    return;

                if (!await confirm(`So you are completely, 100%, positively sure that you want to delete ${this.name}? All messages sent will be lost forever`, `Delete ${this.name}?`))
                    return;

                if (await confirm(`Please confirm that you do NOT want to delete ${this.name}. Click yes to cancel deleting ${this.name}.`, `Cancel Deleting ${this.name}?`))
                    return; // this is here to trick anyone not reading carefully

                if (await prompt(`Type '${this.name}' (case sensitive, don't include the quotes) to continue.`, `Delete ${this.name}?`) !== this.name)
                    return;

                if (!await confirm(`This is your final chance to go back. If you click yes everything sent in ${this.name} along with ${this.name} itself will be deleted permanently. Please make sure you are confident this is what you want.`, `Delete ${this.name}?`))
                    return;

                // i swear to god if someone manages to misclick and accidentally delete a room despite 
                // all these confirmations i will be mad but also impressed

                socket.emit("delete room", this.id)
                
            })

            const renounce = document.createElement("button")
            renounce.innerText = "Renounce Ownership"

            renounce.addEventListener("click", async () => {

                if (this.members.length < 3)
                    return alert(`${this.name} is too small. You can only renounce ownership of rooms with 3 or more members.`, `Can't Renounce Ownership`)

                if (await confirm(`Are you sure? You will lose your ability to edit the room options and details.`, `Renounce Ownership?`))

                if (await confirm(`Are you sure? You can always reclaim ownership, but this will require the approval of a poll.`, `Renounce Ownership?`))
                
                if (await prompt(`Type '${this.name}' (case sensitive, no quotes) to continue`, `Renounce Ownership?`) === this.name)

                if (await confirm(`Click yes to renounce ownership of ${this.name}.`, `Renounce Ownership?`))

                socket.emit("renounce ownership", this.id)

            })

            div.append(legend, desc, document.createElement("hr"), del, renounce)
            this.optionsView.appendChild(div)
        }

        if (this.owner === "nobody") {

            const div = document.createElement("fieldset")

            const legend = document.createElement("legend")
            legend.innerText = "Room Ownership"

            const reclaim = document.createElement('button')
            reclaim.innerText = "Claim Room Ownership"

            reclaim.addEventListener("click", async () => {
                if (await confirm(`Are you sure you want to start a poll to claim the room ownership?`, `Claim Ownership?`))

                socket.emit("claim ownership", this.id)
            })

            div.append(legend, reclaim)
            this.optionsView.append(div)
        }

    }

    createSideBar() {

        this.sideBar = new SideBar()

        SideBar.createDefaultItem(SideBar.timeDisplayPreset).addTo(this.sideBar)

        this.sideBar.addLine()

        SideBar.createIconItem({
            icon: 'fa-solid fa-circle-arrow-left',
            title: 'Back',
            clickEvent: () => {
                if (mainChannelId !== this.id)
                    this.makeMain()
                else
                    Room.resetMain()
            }
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
                getMainSideBar().collapseIfMobile();
            }
        }).addTo(this.sideBar)

        SideBar.createIconItem({
            icon: 'fa-solid fa-chart-pie',
            title: 'Stats',
            clickEvent: () => window.open(location.origin + `/${this.id}/stats`)
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

        const text = this.bar.formItems.text.value
        
        this.createMessageBar({
            name: this.name,
            placeHolder: `Send a message to ${this.name}...`,
            hideWebhooks: !this.options.webhooksAllowed
        });

        this.bar.formItems.text.value = text

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

        socket.emit("get bot data", this.id);
        socket.emit("get member data", this.id)
        socket.emit("get online list", this.id)

        if (this.lastReadMessage && this.lastReadMessage < this.messages[this.messages.length - 1].data.id)
            this.markUnread(this.lastReadMessage)

        console.log(`${this.name} (${this.id}): performed hot reload`)

    }

    createMessageBar(barData: any): void {
        super.createMessageBar(barData)

        socket.emit("get webhooks", this.id, (webhooks) => {
            this.bar.loadWebhooks(webhooks)
        })
    }

    markUnread(id: number): void {
        super.markUnread(id);

        this.sideBarItem.classList.add("unread")
    }

    markRead(): void {
        super.markRead()

        this.sideBarItem.classList.remove("unread")
    }
}