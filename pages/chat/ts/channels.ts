
import Message from './message';
import MessageData from '../../../ts/lib/message';
import { getSetting, openReactionPicker } from './functions'
import { MessageBar } from './messageBar'
import { confirm } from './popups';
import { socket } from './script';

export class View extends HTMLElement {
    typing: HTMLDivElement;
    isMain: boolean = false;
    channel?: Channel;

    constructor(id: string) {
        super();

        this.id = id;
        this.classList.add('view');
        this.style.display = 'none';

        const typing = document.createElement('div');
        typing.classList.add('typing');
        typing.style.display = 'none';
        this.typing = typing;
        this.appendChild(typing);

    }

    makeMain() {
        document.querySelectorAll<View>('.view').forEach(view => {
            view.isMain = false;
            view.style.display = 'none';
        })

        this.isMain = true;
        this.style.display = 'block';
    }
}

/**
 * Tells whether two messages should be joined
 * @param message Message
 * @param prevMessage Previous message 
 * @returns Boolean; whether or not they should be joined
 */
function shouldTheyBeJoined(message: Message, prevMessage: Message): boolean {
    return (
        prevMessage &&
        message &&
        prevMessage.data.author.id === message.data.author.id &&
        prevMessage.data.author.name === message.data.author.name &&
        JSON.stringify(prevMessage.data.tag) === JSON.stringify(message.data.tag) &&
        ((new Date(message.data.time).getTime() - new Date(prevMessage.data.time).getTime()) / 1000) / 60 < 2 &&
        !message.data.replyTo
    )
}

export default class Channel {

    id: string;
    name: string;
    typingUsers: string[] = [];
    messages: Message[] = [];
    view: View;
    bar: MessageBar;

    constructor(id: string, name: string) {

        this.id = id;
        this.name = name;

        this.view = new View(id);
        this.view.channel = this;

        this.bar = new MessageBar({
            name: name,
        })
        this.bar.channel = this;

        this.bar.submitHandler = (data) => {
            console.log(data)
        }

        document.body.appendChild(this.view);
        document.body.appendChild(this.bar);
        
    }

    handleMain(data: MessageData) {
        // validate 

        if ((!data.text && !data.media) || !data.author || !data.author.id || !data.time)
            return;


        // notification 

        if (Notification.permission === 'granted' && data.author.id !== globalThis.me.id && getSetting('notification', 'desktop-enabled'))
            new Notification(`${data.author.name} (${this.name} on Backup Google Chat)`, {
                body: data.text,
                icon: data.author.image,
                silent: document.hasFocus(),
            })

        // create

        const message = new Message(data);
        message.draw();

        // scrolling & sound

        const scrolledToBottom =
            Math.abs(
                this.view.scrollHeight - 
                this.view.scrollTop - 
                this.view.clientHeight
            ) <= 200

        if (getSetting('notification', 'sound-message'))
            document.querySelector<HTMLAudioElement>("#msgSFX")?.play()

        if (getSetting('notification', 'autoscroll-on'))
            this.view.scrollTop = this.view.scrollHeight

        if (getSetting('notification', 'autoscroll-smart') && scrolledToBottom)
            this.view.scrollTop = this.view.scrollHeight

        // add message

        this.messages.push(message);

        const previousMessage = this.messages[this.messages.length - 2];

        if (shouldTheyBeJoined(message, previousMessage))
                message.hideAuthor();

        this.view.appendChild(message);
    }

    handleSecondary(data: MessageData): any {
        // not implemented
    }

    handle(data: MessageData) {
        if (this.view.isMain)
            this.handleMain(data);
        else {
            this.handleMain(data);
            this.handleSecondary(data);
        }
    }

    handleTop(data: MessageData) {

        const message = new Message(data);
        message.draw();

        this.messages.unshift(message);
        this.view.prepend(message);

    }

    handleTyping(name: string) {
        const scrollDown =
            Math.abs(
                this.view.scrollHeight - 
                this.view.scrollTop - 
                this.view.clientHeight
            ) <= 3

        
        this.typingUsers.push(name)

        this.view.style.height = "81%";
        this.view.style.paddingBottom = "3%";

        this.view.typing.style.display = "block";

        if (scrollDown) this.view.scrollTop = this.view.scrollHeight;

        if (this.typingUsers.length === 1)
            this.view.typing.innerHTML = `${this.typingUsers.toString()} is typing`;
        else
            this.view.typing.innerHTML = `${this.typingUsers.join(', ')} are typing`;

        return () => {
            this.typingUsers = this.typingUsers.filter(user => user !== name)

            if (this.typingUsers.length === 1)
                this.view.typing.innerHTML = `${this.typingUsers.toString()} is typing...`;
            else
                this.view.typing.innerHTML = `${this.typingUsers.join(', ')} are typing...`;


            if (this.typingUsers.length === 0) {
                this.view.typing.style.display = "none";
                this.view.style.height = "83%";
                this.view.style.paddingBottom = "1%";
            }
        }

    }

    initiateDelete(id: number) {
        confirm('Delete message?', 'Delete Message?').then(res => {
            if (res)
                socket.emit("delete-message", id);
        })
    }

    initiateEdit(id: number) {

    }

    initiateReply(id: number) {

    }

    initiateReaction(id: number, x: number, y: number) {
        openReactionPicker(id, x, y);
    }

    handleDelete(id: number) {

    }

    clear() {
        this.messages = [];
        this.view.innerHTML = "";
    }

    makeMain() {
        this.view.makeMain();
        this.bar.makeMain();
    }


}