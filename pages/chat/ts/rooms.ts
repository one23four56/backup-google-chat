import { OnlineUserData, UserData } from '../../../ts/lib/authdata';
import userDict from './userDict';
import { MemberUserData } from '../../../ts/lib/misc';
import { RoomFormat } from '../../../ts/modules/rooms';
import Channel, { channelReference, mainChannelId, View, ViewContent } from './channels'
import { emojiSelector } from './functions';
import { openActivePolls } from './polls';
import { alert, confirm, prompt, sideBarAlert } from './popups';
import ReactiveContainer from './reactive';
import { me, socket } from './script';
import SideBar, { SideBars, SideBarItem, SideBarItemCollection } from './sideBar';
import { title } from './title';
import { FormItemGenerator, Header, loadSVG, openBotInfoCard, searchBots, searchUsers, TopBar } from './ui';
import { notifications } from './home';

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
    private onlineSideBarCollection: SideBarItemCollection;
    private offlineSideBarCollection: SideBarItemCollection;
    private invitedSideBarCollection: SideBarItemCollection;

    topBar: TopBar;
    sideBar: SideBar;
    membersBar: SideBar;

    detailsView: ViewContent;
    membersView: ViewContent;
    optionsView: ViewContent;

    /**
     * For each permission: true if the user has it, false if not  
     * **Note:** permissions that require a poll are considered true
     */
    private permissions: Record<keyof RoomFormat["options"]["permissions"], boolean>

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

        this.permissions = {} as typeof this.permissions;
        for (const [name, setting] of Object.entries(this.options.permissions))
            this.permissions[name] = !(setting === "owner" && owner !== me.id)

        const mainSideBar = SideBars.left;

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
        this.createMembersSideBar();

        document.body.append(this.sideBar, this.membersBar);
        this.viewHolder.addTopBar(this.topBar);

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

    }

    protected load() {
        super.load();

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

        socket.on("online list", (roomId, online, offline, invited) => {
            if (roomId !== this.id)
                return;

            this.loadOnlineLists(online, offline, invited);
        })

        socket.on("room details updated", (roomId, data) => {
            if (roomId !== this.id)
                return;

            this.description = data.desc;
            this.rules = data.rules;

            this.loadDetails();
        })


        socket.emit("get bot data", this.id);
        socket.emit("get member data", this.id);
        socket.emit("get online list", this.id);
    }

    makeMain(): void {
        super.makeMain();
        this.sideBar.makeMain();
        this.membersBar.makeMain();

        SideBar.isMobile && this.sideBar.collapse()

        Header.set(this.name, this.emoji)

        title.set(this.name)

        mainRoomId = this.id
    }

    static resetMain(): void {
        Channel.resetMain();

        SideBars.left.makeMain();
        SideBars.right.makeMain();
        Header.reset();

        mainRoomId = undefined;
    }

    private async loadMembers(userDataArray: MemberUserData[]) {

        this.members = userDataArray.map(data => data.id);

        this.membersView.innerText = "";

        const members = this.membersView.appendChild(document.createElement("h1"))
        members.appendChild(document.createElement("i")).className = "fa-solid fa-user"
        members.append("People")
        members.className = "title"

        this.membersView.appendChild(document.createElement("p")).innerText =
            this.getPermission("invitePeople") === "yes" ?
                "You can invite and remove people from the room." :
                this.getPermission("invitePeople") === "poll" ?
                    "You can start a poll to invite or remove someone from the room." :
                    "You can't invite or remove people from the room."

        if (this.permissions.invitePeople) {
            const div = document.createElement("div");
            div.className = "member line";
            div.style.cursor = "pointer"

            const image = await loadSVG('plus-2');

            const name = document.createElement("b");
            name.innerText = "Invite people";

            div.append(image, name);

            div.addEventListener("click", () => {
                searchUsers({
                    title: `Invite to ${this.name}`,
                    excludeList: this.members,
                }).then(user => {
                    confirm(this.getPermission("invitePeople") === "poll" ?
                        `Note: This will start a poll. ${user.name} will only be invited if 'Yes' wins.` : '', `Invite ${user.name}?`)
                        .then(res => {
                            if (res)
                                socket.emit("invite user", this.id, user.id)
                        }).catch()
                }).catch();
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
                this.permissions.removePeople
            ) {
                const remove = document.createElement("i")
                remove.className = "fa-solid fa-ban";

                div.appendChild(remove)

                remove.addEventListener("click", () => {
                    confirm(this.getPermission("removePeople") === "poll" ?
                        `Note: This will start a poll. ${userData.name} will only be removed if 'Yes' wins.` : '', `Remove ${userData.name}?`).then(res => {
                            if (res)
                                socket.emit("remove user", this.id, userData.id)
                        })
                })
            }

            this.membersView.appendChild(div);

        }

        this.membersView.appendChild(document.createElement("br"))
        const bots = this.membersView.appendChild(document.createElement("h1"))
        bots.appendChild(document.createElement("i")).className = "fa-solid fa-robot"
        bots.append("Bots")
        bots.className = "title"

        this.membersView.appendChild(document.createElement("p")).innerText =
            this.getPermission("addBots") === "yes" ?
                "You can add and remove bots from the room." :
                this.getPermission("addBots") === "poll" ?
                    "You can start a poll to add or remove a bot from the room." :
                    "You can't add or remove bots from the room."

        if (this.permissions.addBots) {
            const div = document.createElement("div");
            div.className = "member line";
            div.style.cursor = "pointer"

            const image = await loadSVG('plus-2');

            const name = document.createElement("b");
            name.innerText = "Add bots";

            div.append(image, name);

            div.addEventListener("click", () => {
                searchBots({
                    title: `Add a Bot to ${this.name}`,
                    excludeList: this.bar.botData.map(e => e.name)
                }).then(bot => {
                    confirm(this.getPermission("addBots") === "poll" ?
                        `Note: This will start a poll. ${bot.name} will only be added if 'Yes' wins.` : '', `Add ${bot.name}?`)
                        .then(res => {
                            if (res)
                                socket.emit("modify bots", this.id, "add", bot.name)
                        }).catch()
                }).catch()
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

            if (this.permissions.addBots) {

                const remove = document.createElement("i")
                remove.className = "fa-solid fa-ban";

                remove.addEventListener("click", () => {
                    confirm(this.getPermission("addBots") === "poll" ?
                        `Note: This will start a poll. ${bot.name} will only be removed if 'Yes' wins.` : '', `Remove ${bot.name}?`).then(res => {
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
        sideBarAlert({ message: `You have been added to ${roomData.name}`, expires: 5000 })

        new Room(roomData);
    }

    static removedFromRoomHandler(roomId: string) {

        const room: Room = channelReference[roomId] as Room;

        if (!room) return;

        sideBarAlert({ message: `You have been removed from ${room.name}`, expires: 5000 });
        notifications.removeChannel(roomId);
        title.setNotifications(roomId, 0);

        room.remove();
    }

    private loadOnlineLists(onlineList: OnlineUserData[], offlineList: OnlineUserData[], invitedList: OnlineUserData[]) {
        this.onlineList = onlineList;

        this.onlineSideBarCollection.clear();
        this.offlineSideBarCollection.clear();
        this.invitedSideBarCollection.clear();

        offlineList.sort((a, b) => ((b.lastOnline ?? 0) - (a.lastOnline ?? 0)))
        invitedList.sort((a, b) => ((b.lastOnline ?? 0) - (a.lastOnline ?? 0)))

        onlineList.forEach(user => {
            userDict.update(user);
            userDict.generateItem(user.id).addTo(this.onlineSideBarCollection)
        })
        offlineList.forEach(user => {
            userDict.update(user);
            userDict.generateItem(user.id).addTo(this.offlineSideBarCollection)
        })
        invitedList.forEach(user => {
            userDict.update(user);
            userDict.generateItem(user.id).addTo(this.invitedSideBarCollection)
        })

        this.onlineCount.data = onlineList.length;
        this.offlineCount.data = offlineList.length;
        this.invitedCount.data = invitedList.length;
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


        if (this.rules.length === 0 && this.owner !== me.id)
            this.detailsView.append(descriptionInfo, basicInfo);
        else
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
                    name: 'Pages',
                    description: `Room pages offer a variety of different functionality. Specific pages can be enabled or disabled below.`,
                    color: {
                        accent: '#3b798d',
                        text: 'white'
                    },
                    items: [
                        {
                            type: "boolean",
                            boolean: this.options.archiveViewerAllowed,
                            question: 'Enable archive page',
                            description: "The archive page allows users to easily view and save large amounts of messages.",
                            manipulator: (value, options) => options.archiveViewerAllowed = value,
                        }, {
                            type: "boolean",
                            boolean: this.options.statsPageAllowed,
                            question: "Enable stats page",
                            description: "The stats page displays various statistics about the room.",
                            manipulator: (v, o) => o.statsPageAllowed = v,
                        }, {
                            type: "boolean",
                            boolean: this.options.mediaPageAllowed,
                            question: "Enable media page",
                            description: "The media page shows all the files that were shared in the room",
                            manipulator: (v, o) => o.mediaPageAllowed = v,
                        }
                    ]
                },
                {
                    name: 'Auto Moderator',
                    description: `The Auto Moderator is a system that can help prevent spamming using a variety of methods that can be configured below.`,
                    color: {
                        accent: '#46d160',
                        text: 'black'
                    },
                    items: [
                        {
                            type: "boolean",
                            boolean: this.options.autoMod.allowBlocking,
                            manipulator: (v, o) => o.autoMod.allowBlocking = v,
                            question: "Detect and block spamming from people",
                            children: [
                                {
                                    type: "boolean",
                                    boolean: true,
                                    disabled: true,
                                    manipulator: () => null,
                                    question: "Block fast spam",
                                    description: "Block spam messages that are sent quickly over a shorter period of time\nAlways enabled if spam detection is on"
                                },
                                {
                                    type: "boolean",
                                    boolean: this.options.autoMod.blockSlowSpam,
                                    manipulator: (v, o) => o.autoMod.blockSlowSpam = v,
                                    question: "Block slow spam",
                                    description: "Block spam messages that are sent slowly over a longer period of time.\nThis causes the \"You are sending too many messages!\" message."
                                },
                                {
                                    type: "number",
                                    number: this.options.autoMod.strictness,
                                    max: 5,
                                    min: 1,
                                    question: "Spam detection strictness",
                                    description: "1 is the least strict, 5 is the most strict. Higher strictness means more messages will be flagged as spam.",
                                    manipulator: (value, options) => options.autoMod.strictness = value,
                                },
                                {
                                    type: "boolean",
                                    boolean: this.options.autoMod.allowMutes,
                                    manipulator: (v, o) => o.autoMod.allowMutes = v,
                                    question: "Allow AutoMod to mute people who are spamming",
                                    description: "If disabled, spam messages will still be blocked but warnings and mutes will not be issued.",
                                    children: [
                                        {
                                            type: "number",
                                            number: this.options.autoMod.warnings,
                                            max: 5,
                                            min: 1,
                                            question: "Warnings before muting someone",
                                            manipulator: (value, options) => options.autoMod.warnings = value,
                                        },
                                        {
                                            type: "number",
                                            number: this.options.autoMod.muteDuration,
                                            max: 10,
                                            min: 1,
                                            manipulator: (v, o) => o.autoMod.muteDuration = v,
                                            question: "Mute duration (minutes)"
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            type: "boolean",
                            boolean: this.options.autoMod.blockDuplicates,
                            manipulator: (v, o) => o.autoMod.blockDuplicates = v,
                            question: "Block duplicate messages",
                            description: "Block sending the same message twice in a row."
                        },
                        // {
                        //     type: "boolean",
                        //     boolean: this.options.autoMod.canDeleteWebhooks,
                        //     manipulator: (v, o) => o.autoMod.canDeleteWebhooks = v,
                        //     question: "Allow AutoMod to delete webhooks",
                        //     description: "If enabled, AutoMod will delete spamming webhooks instead of temporarily disabling them."
                        // }
                    ]
                },
                {
                    name: 'Permissions',
                    description: `The following options control who can do certain things in the room.\n\nOwner allows only the room owner to complete the action\nAnyone allows anyone to do it\nPoll allows anyone to do it, but non-owners require the approval of a poll.\n`,
                    color: {
                        accent: '#cc33ff',
                        text: 'white'
                    },
                    items: [
                        {
                            type: "permissionSelect",
                            permission: this.options.permissions.invitePeople,
                            question: 'Inviting people',
                            manipulator: (value, options) => options.permissions.invitePeople = value
                        },
                        {
                            type: 'permissionSelect',
                            permission: this.options.permissions.removePeople,
                            question: "Removing people",
                            manipulator: (v, o) => o.permissions.removePeople = v,
                        },
                        {
                            type: "permissionSelect",
                            permission: this.options.permissions.addBots,
                            question: "Adding and removing bots",
                            manipulator: (value, options) => options.permissions.addBots = value
                        }
                    ]
                },
                {
                    name: `Mediashare`,
                    description: `Mediashare is the system that allows files to be shared in rooms. Mediashare can store up to 500 MB of files per room.`,
                    color: {
                        accent: '#ff9933',
                        text: 'black'
                    },
                    items: [
                        {
                            type: "boolean",
                            boolean: this.options.autoDelete,
                            question: `Enable auto-delete`,
                            description: "Auto-delete automatically deletes old files when there is no space for new files. If disabled, files must be deleted manually.",
                            manipulator: (value, options) => options.autoDelete = value
                        },
                        {
                            type: "number",
                            number: this.options.maxFileSize,
                            question: "Max File Size (MB)",
                            description: "Maximum allowed size of uploaded files. Files larger than this size cannot be uploaded.",
                            manipulator: (v, o) => o.maxFileSize = v,
                            max: 10,
                            min: 1
                        }
                    ]
                },
                // {
                //     name: 'Webhooks',
                //     description: `Webhooks allow people to send messages with custom names and images. When webhooks are allowed, you can use one by clicking on your profile picture on the message bar and selecting the webhook you want. When you send a message with that webhook, your name and image in the message will be that of the webhook, rather than your own. Webhooks can also be used programmatically by external services to send messages in chat.\n\nWhen webhooks are not allowed, the profile picture on the message bar will not show up, and all webhook-related options will have no effect.\nA private webhook is a webhook that only the owner can edit and use. Anyone can delete a private webhook; however, for anyone who is not the owner, this requires the approval of a poll`,
                //     color: {
                //         accent: '#cc0052',
                //         text: 'white'
                //     },
                //     items: [
                //         {
                //             type: "boolean",
                //             boolean: this.options.webhooksAllowed,
                //             question: 'Allow webhooks',
                //             manipulator: (value, options) => options.webhooksAllowed = value,
                //         },
                //         {
                //             type: "boolean",
                //             boolean: this.options.privateWebhooksAllowed,
                //             question: 'Allow private webhooks',
                //             manipulator: (value, options) => options.privateWebhooksAllowed = value,
                //         }
                //     ]
                // },
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
                    alert(`There are currently ${this.members.length} members of ${this.name}. In order to delete the room, there must only be 1 member (you). If you want to delete the room, remove everyone else from it.`, `Cannot Delete ${this.name}`)
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

        if (this.options.statsPageAllowed) SideBar.createIconItem({
            icon: 'fa-solid fa-chart-line',
            title: 'Stats',
            clickEvent: () => window.open(location.origin + `/${this.id}/stats`)
        }).addTo(this.sideBar)

        if (this.options.mediaPageAllowed) SideBar.createIconItem({
            icon: 'fa-solid fa-folder-open',
            title: 'Media',
            clickEvent: () => window.open(location.origin + `/media/${this.id}/`)
        }).addTo(this.sideBar)

        if (this.options.statsPageAllowed || this.options.archiveViewerAllowed || this.options.mediaPageAllowed)
            this.sideBar.addLine()

        SideBar.createIconItem({
            icon: 'fa-solid fa-chart-pie',
            title: 'Polls',
            clickEvent: () => {
                openActivePolls(this)
            }
        }).addTo(this.sideBar)

        this.sideBar.addLine();

    }

    private onlineCount: ReactiveContainer<number>;
    private offlineCount: ReactiveContainer<number>;
    private invitedCount: ReactiveContainer<number>;

    private createMembersSideBar() {

        this.membersBar = new SideBar(false);

        this.onlineSideBarCollection = this.membersBar.addCollection("online", {
            icon: 'fa-solid fa-user',
            title: 'Online (0)',
            initial: obj => {
                this.onlineCount = new ReactiveContainer(0);
                this.onlineCount.onChange(
                    count => obj.querySelector("span").innerText = `Online (${count})`
                );
            }
        })

        this.offlineSideBarCollection = this.membersBar.addCollection("offline", {
            icon: 'fa-solid fa-user-clock',
            title: 'Offline (0)',
            initial: obj => {
                obj.classList.add("offline-list")
                this.offlineCount = new ReactiveContainer(0);
                this.offlineCount.onChange(count => {
                    obj.querySelector("span").innerText = `Offline (${count})`
                    if (count === 0) obj.style.display = "none";
                    else obj.style.display = "flex";
                })
                this.offlineCount.syntheticChange();
            }
        })

        this.invitedSideBarCollection = this.membersBar.addCollection("invited", {
            icon: 'fa-solid fa-envelope',
            title: 'Invited (0)',
            initial: obj => {
                obj.classList.add("invites-list")
                this.invitedCount = new ReactiveContainer(0);
                this.invitedCount.onChange(count => {
                    obj.querySelector("span").innerText = `Invited (${count})`
                    if (count === 0) obj.style.display = "none";
                    else obj.style.display = "flex";
                })
                this.invitedCount.syntheticChange();
            }
        })

        this.invitedSideBarCollection.classList.add("invites-list");
        this.offlineSideBarCollection.classList.add("offline-list");

    }

    reload() {

        const text = this.bar.container.text

        this.createMessageBar({
            name: this.name,
            placeHolder: `Send a message to ${this.name}...`,
            hideWebhooks: !this.options.webhooksAllowed
        });

        this.viewHolder.addMessageBar(this.bar);

        this.bar.container.text = text;

        this.createSideBar();

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

        if (this.loaded) {
            this.loadOptions();
            this.loadDetails();

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
        } else if (this.unread)
            this.markUnread()

        console.log(`${this.name} (${this.id}): performed hot reload`)

    }

    createMessageBar(barData: any): void {
        super.createMessageBar(barData)

        // socket.emit("get webhooks", this.id, (webhooks) => {
        // this.bar.loadWebhooks(webhooks)
        // })
    }

    markUnread(id?: number): void {
        super.markUnread(id);

        this.sideBarItem.classList.add("unread")
        this.sideBarItem.style.setProperty("--unread-count", `"${this.mostRecentMessage - this.lastReadMessage}"`)
    }

    readMessage(id: number): void {
        super.readMessage(id);
        this.sideBarItem.style.setProperty("--unread-count", `"${this.mostRecentMessage - this.lastReadMessage}"`)
    }

    markRead(): void {
        super.markRead()

        this.sideBarItem.classList.remove("unread")
    }

    getPermission(permission: keyof Room["options"]["permissions"]): "yes" | "poll" | "no" {

        const option = this.options.permissions[permission];

        if (this.owner === me.id || option === "anyone")
            return "yes";

        if (option === "poll")
            return "poll";

        return "no";

    }

    set time(number: number) {
        super.time = number;
        SideBars.left.collections["rooms"].setOrder(this.sideBarItem, this.id, number)
    }

    get time() {
        return super.time // doesn't work without this idk why
    }
}