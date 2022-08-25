import { DMFormat } from '../../../ts/modules/dms'
import { StatusUserData } from '../../../ts/modules/session';
import Channel from './channels'
import { confirm, sideBarAlert } from './popups';
import { me, socket } from './script';
import SideBar, { getMainSideBar, SideBarItem } from './sideBar';
import { searchUsers, TopBar } from './ui'

const dmsList: string[] = []
export default class DM extends Channel {
    topBar: TopBar;
    sideBarItem: SideBarItem;

    userData: StatusUserData;

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

        dmsList.push(this.userData.id)

        this.topBar = new TopBar([
            {
                name: "You are talking with " + this.userData.name,
                onSelect: () => {},
                selected: false,
                canSelect: false
            }
        ])

        this.sideBarItem = SideBar.createImageItem({
            image: this.userData.img,
            title: this.userData.name,
            icon: this.userData.status.char,
            clickEvent: () => this.makeMain()
        })

        this.sideBarItem.addTo(getMainSideBar().collections["dms"])

        document.body.appendChild(this.topBar)
    }

    makeMain(): void {
        super.makeMain()

        this.topBar.makeMain();
    }

    static startDM() {

        searchUsers(`Start a chat with...`, [me.id, ...dmsList], "exclude").then(user => {

            confirm(`Send a DM invite to ${user.name}?`, `Send Invite?`).then(res => {
                
                if (res)
                    socket.emit("start dm", user.id)

            })

        })

    }

    static dmStartedHandler(dm: Required<DMFormat>) {
        sideBarAlert(`A dm conversation has been started with ${dm.userData.name}`, 5000)

        new DM(dm)
    }
}