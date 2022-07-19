
import Message from './message';
import MessageData from '../../../ts/lib/msg';
import { emojiSelector, getSetting } from './functions'
import { MessageBar, MessageBarData } from './messageBar'
import { confirm } from './popups';
import { me, socket } from './script';

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

    muted: boolean = false;

    constructor(id: string, name: string, barData?: MessageBarData) {

        this.id = id;
        this.name = name;

        this.view = new View(id);
        this.view.channel = this;

        this.bar = new MessageBar(
            barData || {
                name: name
            }
        )
        this.bar.channel = this;

        socket.on("incoming-message", (roomId, data) => {
            if (roomId !== this.id)
                return; 

            this.handle(data)
        })

        socket.on("message-edited", (roomId, data) => {
            if (roomId !== this.id)
                return;

            this.handleEdit(data)
        })

        socket.on("message-deleted", (roomId, messageID) => {
            if (roomId !== this.id)
                return;

            this.handleDelete(messageID)
        })

        socket.emit("get room messages", this.id, (messages) => {
            this.muted = true;

            for (const message of messages) {
                if (!message.deleted)
                    this.handleMain(message)

            }
            
            this.muted = false;
        })

        document.body.appendChild(this.view);
        document.body.appendChild(this.bar);
        
    }

    handleMain(data: MessageData) {
        // validate 

        if ((!data.text && !data.media) || !data.author || !data.author.id || !data.time)
            return;


        // notification 

        if (
            Notification.permission === 'granted' && 
            data.author.id !== me.id && 
            getSetting('notification', 'desktop-enabled') &&
            !this.muted
        )
            new Notification(`${data.author.name} (${this.name} on Backup Google Chat)`, {
                body: data.text,
                icon: data.author.image,
                silent: document.hasFocus(),
            })

        // create

        const message = new Message(data);

        message.channel = this;

        message.draw();

        // add message

        this.messages.push(message);

        const previousMessage = this.messages[this.messages.length - 2];

        if (shouldTheyBeJoined(message, previousMessage))
            message.hideAuthor();

        this.view.appendChild(message);

        // scrolling & sound

        const scrolledToBottom =
            Math.abs(
                this.view.scrollHeight -
                this.view.scrollTop -
                this.view.clientHeight
            ) <= 200

        if (getSetting('notification', 'sound-message') && !this.muted)
            document.querySelector<HTMLAudioElement>("#msgSFX")?.play()

        if (getSetting('notification', 'autoscroll-on'))
            this.view.scrollTop = this.view.scrollHeight

        if (getSetting('notification', 'autoscroll-smart') && scrolledToBottom)
            this.view.scrollTop = this.view.scrollHeight
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
                socket.emit("delete-message", this.id, id);
        })
    }

    initiateEdit(message: MessageData) {

        this.bar.setImage('https://img.icons8.com/material-outlined/48/000000/edit--v1.png')
        this.bar.setPlaceholder("Edit message...")
        this.bar.blockWebhookOptions = true;

        this.bar.formItems.text.value = message.text;
        this.bar.formItems.text.focus();

        this.bar.tempOverrideSubmitHandler = (data) => {
            socket.emit("edit-message", this.id, {
                messageID: message.id,
                text: data.text
            })

            this.bar.blockWebhookOptions = false;
        }
    }

    initiateReply(data: MessageData) {
        this.bar.replyTo = data.id;
        this.bar.formItems.text.focus();

        this.bar.setPlaceholder(`Reply to ${data.author.name} (press esc to cancel)`)

        const stopReply = event => {
            if (event.key === 'Escape') {
                this.bar.replyTo = null;
                this.bar.resetPlaceholder();

                this.bar.formItems.text.removeEventListener('keydown', stopReply)
            }
        }
        
        this.bar.formItems.text.addEventListener('keydown', stopReply)

    }

    initiateReaction(id: number, x: number, y: number) {
        emojiSelector(x, y)
            .catch(() => { })
            .then(emoji => socket.emit('react', this.id, id, emoji))
    }

    handleDelete(id: number) {
        const message = this.messages.find(message => message && message.data.id === id && !message.data.notSaved)

        if (!message) return;

        message.remove()
        delete this.messages[this.messages.indexOf(message)]

        const messageAbove = this.messages.find(message => message && message.data.id === id - 1 && !message.data.notSaved)
        const messageBelow = this.messages.find(message => message && message.data.id === id + 1 && !message.data.notSaved)
        
        if (messageBelow && messageAbove) {
            if (shouldTheyBeJoined(messageBelow, messageAbove))
                messageBelow.hideAuthor();
            else
                messageBelow.showAuthor();
        } else if (messageBelow && !messageAbove) {
            messageBelow.showAuthor();
        }
    }

    handleEdit(data: MessageData) {
        const message = this.messages.find(message => message && message.data.id === data.id && !message.data.notSaved)

        if (!message) return;

        message.update(data);

        if (shouldTheyBeJoined(message, this.messages.find(message => message && message.data.id === data.id - 1 && !message.data.notSaved)))
            message.hideAuthor();

        const messageBelow = this.messages.find(message => message && message.data.id === data.id + 1 && !message.data.notSaved)
        if (messageBelow) {
            if (shouldTheyBeJoined(messageBelow, message))
                messageBelow.hideAuthor();
            else 
                messageBelow.showAuthor();
        }
        

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