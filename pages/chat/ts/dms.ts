import { DMFormat } from '../../../ts/modules/dms'
import { StatusUserData } from '../../../ts/modules/session';
import Channel from './channels'
import { me } from './script';
import SideBar, { getMainSideBar, SideBarItem } from './sideBar';
import { TopBar } from './ui'

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
}