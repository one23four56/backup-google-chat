import { OnlineUserData, UserData } from '../../../ts/lib/authdata';
import userDict from './userDict';
import { MemberUserData } from '../../../ts/lib/misc';
import { RoomFormat } from '../../../ts/modules/rooms';
import Channel, { channelReference, mainChannelId, ViewContent } from './channels'
import { emojiSelector } from './emoji';
import { openActivePolls } from './polls';
import { alert, confirm, prompt, sideBarAlert } from './popups';
import ReactiveContainer from './reactive';
import { me, socket } from './script';
import SideBar, { SideBars, SideBarItem, SideBarItemCollection } from './sideBar';
import { title } from './title';
import { FormItemGenerator, Header, openBotInfoCard, openRoomUserActions, peopleOrBots, RoomUserActions, searchBots, searchUsers, TopBar, UserActionsGetter } from './ui';
import { notifications } from './home';
import { optionsDisplay } from '../../../ts/lib/options';
import { BotData } from '../../../ts/modules/bots';

export let mainRoomId: string | undefined;

export default class Room extends Channel {

    room: true = true;

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

        this.bind("hot reload room", (data) => {
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

        // this.bind("webhook data", (data) => {
        //     this.bar.loadWebhooks(data)
        //     this.bar.resetImage();
        //     this.bar.resetPlaceholder();
        // })

        this.bind("member data", (data) => {
            this.loadMembers(data)
        });

        this.bind("bot data", () => {
            // data already loaded by channel
            this.loadMembers(this.memberData);
        })

        this.bind("online list", (online, offline, invited) => {
            this.loadOnlineLists(online, offline, invited);
        })

        this.bind("room details updated", (data) => {
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

    getRoomActionData(user: true, data: UserData): UserActionsGetter | undefined;
    getRoomActionData(user: false, data: BotData): UserActionsGetter;
    getRoomActionData(user: boolean, data: UserData | BotData): UserActionsGetter | undefined;
    getRoomActionData(user: boolean, data: UserData | BotData): UserActionsGetter | undefined {
        return user ?
            //@ts-expect-error
            this.userActionData(data) :
            //@ts-expect-error
            this.botActionData(data);
    }

    private userActionData(userData: UserData): UserActionsGetter | undefined {
        if (userData.id === me.id) return;
        if (userData.id === this.owner) return;

        return () => {
            const owner = me.id === this.owner;
            const data = this.memberData.find(v => v.id === userData.id);
            if (!data) return;

            const isMuted = !!data.mute;
            const isKicked = !!data.kick;
            const invited = data.type === "invited";

            return {
                profile: {
                    image: userData.img
                },
                name: userData.name,
                canKick: !owner && isKicked ? false : invited && !isKicked ? false : this.canI("kick"),
                pollKick: this.pollNeededTo("kick"),
                canMute: !owner && isMuted ? false : invited ? false : this.canI("mute"),
                pollMute: this.pollNeededTo("mute"),
                unKick: isKicked && owner,
                unMute: isMuted && owner,
                canRemove: this.canI("removePeople"),
                pollRemove: this.pollNeededTo("removePeople"),
                roomId: this.id,
                userId: userData.id,
                room: {
                    name: this.name,
                    emoji: this.emoji
                }
            }
        };
    }

    private botActionData(botData: BotData): UserActionsGetter {
        return () => {
            const owner = me.id === this.owner;
            const data = this.botData.find(b => b.id === botData.id);
            if (!data) return;

            const isMuted = !!data.mute;

            return {
                bot: true,
                profile: {
                    image: botData.image
                },
                name: botData.name,
                canKick: false,
                pollMute: this.pollNeededTo("muteBots"),
                canMute: !owner && isMuted ? false : this.canI("muteBots"),
                unMute: owner && isMuted,
                canRemove: this.canI("addBots"),
                pollRemove: this.pollNeededTo("addBots"),
                roomId: this.id,
                userId: botData.id,
                room: {
                    name: this.name,
                    emoji: this.emoji
                }
            }
        };
    }

    private memberData: MemberUserData[];

    private async loadMembers(userDataArray: MemberUserData[]) {

        this.members = userDataArray.map(data => data.id);
        this.memberData = userDataArray;
        this.membersView.innerText = "";

        const memberCount = userDataArray.filter(i => i.type === "member").length;
        const invitedCount = userDataArray.length - memberCount;

        const filter = this.membersView.appendChild(document.createElement("input"));
        filter.type = "text";
        filter.placeholder = "Search members";

        const show = this.membersView.appendChild(document.createElement("div"));
        show.className = "actions";

        const showMembersButton = show.appendChild(document.createElement("button"));
        showMembersButton.appendChild(document.createElement("i")).className = "fa-solid fa-user fa-fw";
        showMembersButton.append(`Members (${memberCount})`);
        showMembersButton.addEventListener("click", () => {
            holder.classList.toggle("hide-members");
            showMembersButton.classList.toggle("clicked");
        });

        const showInvitedButton = show.appendChild(document.createElement("button"));
        showInvitedButton.appendChild(document.createElement("i")).className = "fa-solid fa-envelope fa-fw";
        showInvitedButton.append(`Invited (${invitedCount})`);
        showInvitedButton.addEventListener("click", () => {
            holder.classList.toggle("hide-invited");
            showInvitedButton.classList.toggle("clicked");
        });

        const showBotsButton = show.appendChild(document.createElement("button"));
        showBotsButton.appendChild(document.createElement("i")).className = "fa-solid fa-robot fa-fw";
        showBotsButton.append(`Bots (${this.bar.botData.length})`);
        showBotsButton.addEventListener("click", () => {
            holder.classList.toggle("hide-bots");
            showBotsButton.classList.toggle("clicked");
        });

        {

            const add = show.appendChild(document.createElement("button"));
            add.appendChild(document.createElement("i")).className = "fa-solid fa-circle-plus fa-fw";
            add.append(`Add`);
            add.className = "add";

            const addPeople = this.canI("invitePeople"), addBots = this.canI("addBots");

            if (addPeople || addBots) {
                const addUser = async () => {
                    const user = await searchUsers({
                        title: `Invite to ${this.name}`,
                        excludeList: this.members,
                        noResults: [{
                            text: "Invite by Email",
                            icon: "fa-solid fa-envelope",
                            action: (close) => {
                                close();
                                this.inviteByEmail();
                            },
                        }]
                    }).catch();

                    if (await confirm(this.pollNeededTo("invitePeople") ?
                        `Note: this will start a poll` : '', `Invite ${user.name}?`
                    ))
                        socket.emit("invite user", this.id, user.id)
                };

                const addBot = async () => {
                    const bot = await searchBots({
                        title: `Add a Bot to ${this.name}`,
                        excludeList: this.botData.map(b => b.id)
                    }).catch();

                    if (await openBotInfoCard(bot, true))
                        socket.emit("modify bots", this.id, true, bot.id)
                }

                if (addPeople && !addBots)
                    add.addEventListener("click", addUser);
                else if (addBots && !addPeople)
                    add.addEventListener("click", addBot);
                else
                    add.addEventListener("click", () =>
                        peopleOrBots(addUser, addBot)
                    );
            } else
                add.style.display = "none";

        }

        //@ts-expect-error
        const isBotData = (data: BotData | MemberUserData): data is BotData => typeof data.image === "string";
        const normalize = (data: BotData | MemberUserData) => {
            return isBotData(data) ?
                {
                    name: data.name,
                    image: data.image,
                    bot: true,
                    botData: data,
                    mute: data.mute
                } : {
                    name: data.name,
                    image: data.img,
                    user: true,
                    userData: data,
                    kick: data.kick,
                    mute: data.mute
                }
        };

        const collator = new Intl.Collator('en', { sensitivity: "base" });
        const data = [...userDataArray, ...this.botData]
            .map(i => normalize(i)).sort(
                (a, b) => collator.compare(a.name, b.name)
            );

        const holder = this.membersView.appendChild(document.createElement("div"));
        holder.className = "members-holder";

        for (const item of data) {
            const user = holder.appendChild(document.createElement("div"));
            user.className = "item";

            user.appendChild(document.createElement("img")).src = item.image;
            user.appendChild(document.createElement("span")).innerText = item.name;

            const addTag = (name: string, icon?: string) => {
                const span = user.appendChild(document.createElement("span"));
                span.innerText = name.toUpperCase();
                span.classList.add("tag", name);
                if (icon) span.appendChild(document.createElement("i"))
                    .classList.add("fa-solid", icon);
            }

            // there has got to be a better way to do this
            // honestly tho i don't really care as long as it works 
            // since it isn't like slowing down anything (foreshadowing??)
            if (item.bot) {
                addTag("bot",
                    item.botData.check ? "fa-check" :
                        item.botData.beta ? "fa-screwdriver-wrench" :
                            undefined
                );
                user.classList.add("bot")
            }
            if (item.user) {
                if (item.userData.type === "invited") {
                    user.classList.add("invited");
                    if (!item.kick) addTag("invited", "fa-envelope-circle-check");
                } else user.classList.add("member")
                if (item.userData.id === this.owner) addTag("owner", "fa-crown");
                if (item.userData.id === me.id) addTag("you");
            };

            let muteTime: HTMLSpanElement, kickTime: HTMLSpanElement;
            if (item.mute) {
                addTag("muted", "fa-volume-xmark");
                muteTime = document.createElement("span");

                const muteCounter = setInterval(() => {
                    if (!muteTime || item.mute <= Date.now()) clearInterval(muteCounter);
                    muteTime.innerText = `Muted for ${new Date(item.mute - Date.now())
                        .toLocaleTimeString('en-US', {
                            hour12: false,
                            minute: 'numeric',
                            second: 'numeric'
                        }).slice(1)
                        }`
                }, 100)
            };

            if (item.kick) {
                addTag("kicked", "fa-ban");

                kickTime = document.createElement("span");

                const kickCounter = setInterval(() => {
                    if (!kickTime || item.kick <= Date.now()) clearInterval(kickCounter);
                    kickTime.innerText = `Kicked for ${new Date(item.kick - Date.now())
                        .toLocaleTimeString('en-US', {
                            hour12: false,
                            minute: 'numeric',
                            second: 'numeric'
                        }).slice(1)
                        }`
                }, 100)
            };

            if (kickTime || muteTime) {
                const div = user.appendChild(document.createElement("div"));
                muteTime && div.appendChild(muteTime);
                kickTime && div.appendChild(kickTime);
            };

            const accepted = [item.name, item.name.split(" ")[0], item.name.split(" ")[1] ?? ""];
            const hide = () => {
                if (!accepted
                    .map(i => i.slice(0, filter.value.trim().length))
                    .map(i => collator.compare(i, filter.value.trim()) === 0)
                    .includes(true))
                    user.style.display = "none";
                else
                    user.style.display = "";
            };

            hide();
            filter.addEventListener("input", hide);

            const dots = user.appendChild(document.createElement("i"));
            dots.className = "fa-solid fa-ellipsis-vertical";

            const actionData = this.getRoomActionData(item.user, item.user ? item.userData : item.botData);

            user.addEventListener("click", item.bot ? event => {
                if (event.target === dots) return;
                openBotInfoCard(item.botData, actionData);
            } : event => {
                if (event.target === dots) return;
                if (!userDict.has(item.userData.id)) return;
                const data = userDict.getData(item.userData.id);
                userDict.generateUserCard(data.userData, data.dm, actionData).showModal();
            })

            user.addEventListener("contextmenu", event => {
                event.preventDefault();
                openRoomUserActions(event.clientX, event.clientY, actionData);
            });

            if (item.user && item.userData.id === me.id) {
                dots.className = "fa-solid fa-arrow-right-from-bracket";
                dots.addEventListener("click", () =>
                    confirm(`You will not be able to rejoin unless you are invited back`, `Leave ${this.name}?`)
                        .then(res => {
                            if (res) socket.emit("leave room", this.id)
                        }))
            }

            const actions = actionData ? actionData() : undefined;

            if (
                item.user && item.userData.id === this.owner ||
                (actions && !actions.canMute && !actions.canKick && !actions.canRemove)
            )
                dots.remove();
            else dots.addEventListener("click", event => {
                event.preventDefault();
                openRoomUserActions(event.clientX, event.clientY, actionData);
            });

        }

    }

    remove(): void {
        this.detailsView.remove();
        this.membersView.remove();
        this.optionsView.remove();
        this.topBar.remove();
        this.sideBar.remove();
        this.sideBarItem.remove();
        SideBars.left.collections["rooms"].removeOrderItem(this.id);

        if (this.mainView.isMain)
            Room.resetMain();

        super.remove();
    }

    static addedToRoomHandler(roomData: RoomFormat) {
        sideBarAlert({ message: `You have been added to ${roomData.name}`, expires: 5000 })

        const room = new Room(roomData);
        if (!mainChannelId) room.makeMain();
    }

    static removedFromRoomHandler(roomId: string) {

        const room: Room = channelReference[roomId] as Room;

        if (!room) return;

        sideBarAlert({ message: `You are no longer a member of ${room.name}`, expires: 5000 });
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
            userDict.update(user, true);
            userDict.generateItem(user.id, false, this.getRoomActionData(true, user))
                .addTo(this.onlineSideBarCollection)
        })
        offlineList.forEach(user => {
            userDict.update(user, true);
            userDict.generateItem(user.id, false, this.getRoomActionData(true, user))
                .addTo(this.offlineSideBarCollection)
        })
        invitedList.forEach(user => {
            userDict.update(user, true);
            userDict.generateItem(user.id, false, this.getRoomActionData(true, user))
                .addTo(this.invitedSideBarCollection)
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

        if (this.canI("editName")) {
            const i = document.createElement("i")
            i.className = "fa-solid fa-pen-to-square fa-fw"

            name.style.cursor = "pointer"
            emoji.style.cursor = "pointer"

            name.addEventListener("click", async () => {
                const note = this.pollNeededTo("editName") ? "Note: this will start a poll" : ""
                const name = await prompt(note, "Enter new name:", this.name, 30);

                if (name === this.name) return;
                if (name && await confirm(
                    `Are you sure you want to change the room name to ${name}?\n\n` + note,
                    "Change name?"
                ))
                    socket.emit("modify name or emoji", this.id, "name", name);
            });

            emoji.addEventListener("click", async event => {
                const note = this.pollNeededTo("editName") ? "Note: this will start a poll" : ""
                const emoji = await emojiSelector(event.clientX, event.clientY);

                if (emoji === this.emoji) return;
                if (await confirm(
                    `Are you sure you want to change the room emoji to ${emoji}?\n\n` + note,
                    "Change room emoji?"
                ))
                    socket.emit("modify name or emoji", this.id, "emoji", emoji);
            });

            name.append(i.cloneNode())
            emoji.append(i.cloneNode())
        }

        basicInfo.append(name, emoji, id)

        // description info

        description.innerText = this.description
        descriptionInfo.append(descriptionInfoLegend, description)

        for (const rule of this.rules) {
            const ruleElement = document.createElement("li")

            if (this.canI("editRules")) {
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

        if (this.canI("editRules")) {

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
        }

        if (this.canI("editDescription")) {

            descriptionInfoLegend.innerHTML = 'Description <i class="fa-solid fa-pen-to-square"></i>'
            // just spent like 10 minutes remembering and writing the complicated way to do this 
            // without setting innerHTMl but then i realized that it doesn't even involve user 
            // input so i don't even need to do that

            descriptionInfoLegend.style.cursor = "pointer"

            descriptionInfoLegend.addEventListener("click", () => {
                prompt('', 'Edit Description', this.description, 250).then(res =>
                    socket.emit("modify description", this.id, res)
                ).catch()
            })
        } else
            descriptionInfoLegend.innerText = "Description"


        if (this.rules.length === 0 && !this.canI("editRules"))
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
            form = generator.generateForm(optionsDisplay(this.options));

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

                if (this.members.length < 2)
                    return alert(`${this.name} is too small. You can only renounce ownership of rooms with 2 or more members.`, `Can't Renounce Ownership`)

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

        const text = this.bar.container.text;
        const botData = this.botData;

        this.createMessageBar({
            name: this.name,
            placeHolder: `Send a message to ${this.name}...`,
            hideWebhooks: !this.options.webhooksAllowed
        });

        this.viewHolder.addMessageBar(this.bar);

        this.bar.container.text = text;
        this.bar.botData = botData;

        this.createSideBar();

        const item = SideBar.createEmojiItem({
            title: this.name,
            emoji: this.emoji,
            clickEvent: () => {
                this.makeMain()
            }
        })

        this.sideBarItem.replaceWith(item);
        this.sideBarItem = item;
        SideBars.left.collections["rooms"].updateOrderItem(item, this.id);

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
            socket.emit("get member data", this.id);
            socket.emit("get online list", this.id);

            for (const message of this.messages) {
                message.redraw();
                if (message.data.id > this.lastReadMessage)
                    this.markUnread(message.data.id);
            }

            // if (this.lastReadMessage && this.lastReadMessage < this.messages[this.messages.length - 1].data.id)
            //     this.markUnread(this.lastReadMessage)
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

    canI(permission: keyof Room["options"]["permissions"]) {
        const perm = this.getPermission(permission);
        return (perm === "yes" || perm === "poll");
    }

    pollNeededTo(permission: keyof Room["options"]["permissions"]) {
        const perm = this.getPermission(permission);
        return (perm === "poll");
    }

    set time(number: number) {
        super.time = number;
        SideBars.left.collections["rooms"].setOrder(this.sideBarItem, this.id, number)
    }

    get time() {
        return super.time // doesn't work without this idk why
    }

    async inviteByEmail() {
        const email = await prompt("", "Email Address", "", 200);
        if (!email.endsWith("@wfbschools.com") || email.split("@").length > 2)
            return alert("The email address you entered is not valid", "Invalid Email");

        if (!await confirm(`Are you sure you want to invite ${email}?\n\nNote: This will send an email, which will include your name and email address.`, "Invite User?"))
            return;

        socket.emit("invite by email", email, this.id);
    }
}