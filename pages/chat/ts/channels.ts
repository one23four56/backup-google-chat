
import Message from './message';
import MessageData from '../../../ts/lib/msg';
import MediaGetter from './media'
import { emojiSelector, getSetting } from './functions'
import { MessageBar, MessageBarData } from './messageBar'
import { confirm } from './popups';
import { me, socket } from './script';
import { SubmitData } from '../../../ts/lib/socket';


export const channelReference: {
    [key: string]: Channel
} = {};

export class View extends HTMLElement {
    typing: HTMLDivElement;
    isMain: boolean = false;
    channel: Channel;

    constructor(id: string, channel: Channel, large: boolean = false) {
        super();

        this.channel = channel;

        this.id = id;
        this.classList.add('view');
        this.style.display = 'none';

        if (large)
            this.classList.add('large')

        const typing = document.createElement('div');
        typing.classList.add('typing');
        typing.style.display = 'none';
        this.typing = typing;
        this.appendChild(typing);

    }

    makeMain() {
        View.resetMain();

        this.isMain = true;
        this.style.display = 'block';
    }

    static resetMain() {
        document.querySelectorAll<View>('.view').forEach(view => {
            view.isMain = false;
            view.style.display = 'none';
        })
    }

    get scrolledToBottom(): boolean {
        return Math.abs(
            this.scrollHeight -
            this.scrollTop -
            this.clientHeight
        ) <= 100
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
        JSON.stringify(prevMessage.data.tags) === JSON.stringify(message.data.tags) &&
        ((new Date(message.data.time).getTime() - new Date(prevMessage.data.time).getTime()) / 1000) / 60 < 2 &&
        !message.data.replyTo
    )
}

export default class Channel {

    id: string;
    name: string;
    typingUsers: string[] = [];
    messages: Message[] = [];
    bar: MessageBar;

    mediaGetter: MediaGetter;

    muted: boolean = false;

    chatView: View;
    mainView: View;

    private loadedMessages: number = 0;

    constructor(id: string, name: string, barData?: MessageBarData) {

        this.id = id;
        this.name = name;

        channelReference[id] = this;

        this.chatView = new View(id, this);

        this.mainView = this.chatView;

        this.mediaGetter = new MediaGetter(this.id)

        socket.on("incoming-message", (roomId, data) => {
            if (roomId !== this.id)
                return; 

            this.handle(data);
        })

        socket.on("message-edited", (roomId, data) => {
            if (roomId !== this.id)
                return;

            this.handleEdit(data);
        })

        socket.on("message-deleted", (roomId, messageID) => {
            if (roomId !== this.id)
                return;

            this.handleDelete(messageID);
        })

        socket.on("user voted in poll", (roomId, poll) => {
            if (roomId !== this.id)
                return;

            this.handleEdit(poll) // should work i hope please work i don't want to make a whole new one
            // edit: it worked 😁😁😁😁😁
            // actually ignore that it sounds like a youtube comment
        })

        socket.on("reaction", (roomId, id, data) => {
            if (roomId !== this.id)
                return;

            this.handleReaction(id, data);
        })

        socket.on("typing", (roomId, name) => {
            if (roomId !== this.id)
                return;

            const end = this.handleTyping(name);

            const listener = (endRoomId, endName) => {
                if (endRoomId !== this.id || endName !== name)
                    return;

                end();

                socket.off("end typing", listener)
            }

            socket.on("end typing", listener)
        })

        
        socket.emit("get room messages", this.id, 0, (messages) => {
            this.loadMessages(messages)
        })

        document.body.appendChild(this.chatView);
        this.createMessageBar(barData)

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
            !this.muted &&
            !data.muted
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

        // load image
    
        if (message.image) {

            message.image.addEventListener("load", () => {
                
                if (
                    this.chatView.scrolledToBottom &&
                    (getSetting('notification', 'autoscroll-on') || getSetting('notification', 'autoscroll-smart'))
                ) {

                    if (message.data.muted)
                        this.chatView.style.scrollBehavior = "auto"

                    message.addImage()

                    this.chatView.scrollTo({
                        top: this.chatView.scrollHeight
                    })

                    if (message.data.muted)
                        this.chatView.style.scrollBehavior = "smooth"

                } else message.addImage()

            }, { once: true })

            message.loadImage()
            
        }

        // add message

        this.messages.push(message);

        const previousMessage = this.messages[this.messages.length - 2];

        if (shouldTheyBeJoined(message, previousMessage))
            message.hideAuthor();

        this.chatView.appendChild(message);

        // scrolling & sound

        const scrolledToBottom =
            Math.abs(
                this.chatView.scrollHeight -
                this.chatView.scrollTop -
                this.chatView.clientHeight
            ) <= 200

        if (getSetting('notification', 'sound-message') && !this.muted && !data.muted)
            document.querySelector<HTMLAudioElement>("#msgSFX")?.play()

        if (getSetting('notification', 'autoscroll-on'))
            this.chatView.scrollTop = this.chatView.scrollHeight

        if (getSetting('notification', 'autoscroll-smart') && scrolledToBottom)
            this.chatView.scrollTop = this.chatView.scrollHeight
    }

    handleSecondary(data: MessageData): any {
        // not implemented
    }

    handle(data: MessageData) {
        if (this.chatView.isMain)
            this.handleMain(data);
        else {
            this.handleMain(data);
            this.handleSecondary(data);
        }
    }

    handleTop(data: MessageData) {

        const message = new Message(data);

        message.channel = this;

        message.draw();

        // load image

        if (message.image) {
            message.image.addEventListener("load", () => message.addImage(), { once: true })
            message.loadImage();
        }

        this.messages.unshift(message);

        const previousMessage = this.messages[1];

        if (shouldTheyBeJoined(previousMessage, message))
            previousMessage.hideAuthor();

        this.chatView.prepend(message);

    }

    handleTyping(name: string) {
        const scrollDown =
            Math.abs(
                this.chatView.scrollHeight - 
                this.chatView.scrollTop - 
                this.chatView.clientHeight
            ) <= 3

        
        this.typingUsers.push(name)

        this.chatView.style.height = "77%";
        this.chatView.style.paddingBottom = "3%";

        this.chatView.typing.style.display = "block";

        if (scrollDown) this.chatView.scrollTop = this.chatView.scrollHeight;

        if (this.typingUsers.length === 1)
            this.chatView.typing.innerHTML = `${this.typingUsers.toString()} is typing`;
        else
            this.chatView.typing.innerHTML = `${this.typingUsers.join(', ')} are typing`;

        return () => {
            this.typingUsers = this.typingUsers.filter(user => user !== name)

            if (this.typingUsers.length === 1)
                this.chatView.typing.innerHTML = `${this.typingUsers.toString()} is typing...`;
            else
                this.chatView.typing.innerHTML = `${this.typingUsers.join(', ')} are typing...`;


            if (this.typingUsers.length === 0) {
                this.chatView.typing.style.display = "none";
                this.chatView.style.height = "80%";
                this.chatView.style.paddingBottom = "1%";
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

    handleReaction(id: number, data: MessageData) {
        const message = this.messages.find(message => message && message.data.id === id && !message.data.notSaved)

        if (!message) return;

        data.muted = true; // set scroll behavior

        message.update(data);

        if (Math.abs(this.chatView.scrollHeight - this.chatView.scrollTop - this.chatView.clientHeight) <= 50)
            this.chatView.scrollTop = this.chatView.scrollHeight;
    }

    clear() {
        this.messages = [];
        this.chatView.innerHTML = "";
    }

    makeMain() {
        this.mainView.makeMain();
        this.bar.makeMain();

        this.chatView.style.scrollBehavior = "auto"

        this.chatView.scrollTo({
            behavior: "auto",
            top: this.chatView.scrollHeight
        })

        this.chatView.style.scrollBehavior = "smooth"

    }

    remove() {
        this.bar.remove();
        this.chatView.remove();

        if (this.mainView.isMain)
            Channel.resetMain();

        delete channelReference[this.id]
    }

    static resetMain() {
        View.resetMain();
        MessageBar.resetMain();
    }

    createMessageBar(barData) {
        const bar = new MessageBar(
            barData || {
                name: this.name
            }
        )
        
        bar.channel = this;

        let typingTimer, typingStopped = true;
        bar.formItems.text.addEventListener('input', event => {
            if (typingStopped)
                socket.emit('typing start', this.id)

            typingStopped = false;
            clearTimeout(typingTimer);

            typingTimer = setTimeout(() => {
                socket.emit('typing stop', this.id)
                typingStopped = true;
            }, 1000)
        })

        if (!this.bar) {
            this.bar = bar;
            document.body.appendChild(this.bar)
        } else {
            this.bar.replaceWith(bar);
            this.bar = bar;
        }

        this.bar.submitHandler = (data: SubmitData) => {
            socket.emit("message", this.id, {
                archive: data.archive,
                text: data.text,
                webhook: data.webhook,
                replyTo: data.replyTo,
                media: data.media
            }, (sent) => {

            })
        }

    }

    loadMessages(messages: MessageData[], loadOnTop: boolean = false) {

        if (loadOnTop)
            messages = messages.reverse();

        let hasFirstMessage: boolean = false;

        this.loadedMessages += messages.length;

        this.chatView.style.scrollBehavior = "auto"

        for (const message of messages) {
            if (message.deleted)
                continue

            message.muted = true;

            if (message.id === 0) hasFirstMessage = true;

            if (loadOnTop) this.handleTop(message)
            else this.handleMain(message)
        }

        if (!hasFirstMessage && messages.length !== 0) {
            const loadMore = document.createElement("button")
            loadMore.classList.add("load-more")
            loadMore.innerText = "Load More Messages"

            loadMore.addEventListener("click", () => {
                this.loadMoreMessages(loadMore);
            }, { once: true })

            this.chatView.prepend(loadMore)
        }

        this.chatView.style.scrollBehavior = "smooth"

    }

    loadMoreMessages(button: HTMLButtonElement) {
        button.innerText = "Fetching Messages..."

        // get the messages

        socket.emit("get room messages", this.id, this.loadedMessages, messages => {
            button.innerText = "Drawing Messages..."

            this.loadMessages(messages, true)

            button.innerText = "Loading Done"

            this.chatView.style.scrollBehavior = "auto"

            button.scrollIntoView({
                behavior: "auto",
            })

            this.chatView.style.scrollBehavior = "smooth"

            setTimeout(() => button.remove(), 300)

        })

    }

}