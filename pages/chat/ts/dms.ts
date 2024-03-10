import { OnlineUserData } from '../../../ts/lib/authdata';
import userDict from './userDict';
import { DMFormat } from '../../../ts/modules/dms'
import Channel, { channelReference } from './channels'
import { confirm, sideBarAlert } from './popups';
import { mainRoomId } from './rooms';
import { me, socket } from './script';
import SideBar, { SideBarItem, SideBars } from './sideBar';
import { title } from './title';
import { searchUsers, TopBar } from './ui'

const dmsList: string[] = []
export const dmReference: Record<string, DM> = {}
export default class DM extends Channel {
    topBar: TopBar;

    userData: OnlineUserData;

    constructor(data: Required<DMFormat>) {
        super(
            data.id,
            data.name,
            {
                name: data.name,
                hideWebhooks: true,
                placeHolder: `Send a message to ${data.userData.name}...`
            }
        )

        this.userData = data.userData
        userDict.update(this.userData);
        userDict.setPart(this.userData.id, "dm", this);
        userDict.setPart(this.userData.id, "unread", this.unread);

        dmReference[this.userData.id] = this;

        dmsList.push(this.userData.id)

        this.topBar = new TopBar([
            {
                name: this.userData.name,
                icon: `fa-solid fa-comment`,
                onSelect: () => { },
                selected: false,
                canSelect: false
            },
            {
                name: 'Back',
                icon: `fa-solid fa-circle-arrow-left`,
                onSelect: () => {
                    if (mainRoomId)
                        channelReference[mainRoomId].makeMain();
                    else {
                        DM.resetMain();
                        SideBar.isMobile && SideBars.left.expand();
                    }

                    this.topBar.select('')

                },
                selected: false,
                canSelect: true,
            }
        ])

        this.viewHolder.addTopBar(this.topBar)

        userDict.generateItem(this.userData.id, true).addTo(SideBars.right.collections["dms"])

    }

    static resetMain(): void {
        Channel.resetMain()
    }

    makeMain() {
        super.makeMain();

        title.set(this.userData.name)
    }

    static startDM() {

        searchUsers(`Start a chat with...`, [me.id, ...dmsList], "exclude").then(user => {

            confirm(`Your chat with ${user.name} will begin if they accept.`, `Send Invite?`).then(res => {

                if (res)
                    socket.emit("start dm", user.id)

            })

        })

    }

    static dmStartedHandler(dm: Required<DMFormat>) {
        sideBarAlert(`A dm conversation has been started with ${dm.userData.name}`, 5000)

        new DM(dm)
    }

    markRead(): void {
        super.markRead()

        document.querySelectorAll(`sidebar-item[data-user-id="${this.userData.id}"]`).forEach(
            item => item.classList.remove("unread")
        )

        userDict.setPart(this.userData.id, "unread", false);
    }

    markUnread(id: number): void {
        super.markUnread(id)

        document.querySelectorAll(`sidebar-item[data-user-id="${this.userData.id}"]`).forEach(
            item => item.classList.add("unread")
        )

        userDict.setPart(this.userData.id, "unread", true);
    }

    set time(number: number) {
        super.time = number;
        SideBars.right.collections["dms"].setOrder(
            document.querySelector<SideBarItem>(`[data-channel-id="${this.id}"]`),
            this.id,
            number
        )
    }

    get time() {
        return super.time // doesn't work without this idk why
    }
}