
import Message from './message';
import MessageData from '../../../ts/lib/msg';
import { emojiSelector } from './functions'
import { MessageBar, MessageBarData } from './messageBar'
import { confirm } from './popups';
import { me, socket } from './script';
import { SubmitData } from '../../../ts/lib/socket';
import { TopBar } from './ui';
import Settings from './settings';
import { title } from './title';
import { notifications } from './home';
import Share from './media';
import { roomSockets } from './socket';
import { BotData } from '../../../ts/modules/bots';


export let mainChannelId: string | undefined;

export const channelReference: {
    [key: string]: Channel
} = {};

type Role = "messages" | "details" | "options" | "members" | "other"

export class View extends HTMLElement {
    isMain: boolean = false;
    channel: Channel;

    contents: Partial<Record<Role, ViewContent>> = {};

    mainContent: Role = null;

    messageBar?: MessageBar;
    topBar?: TopBar;

    constructor(id: string, channel: Channel) {
        super();

        this.channel = channel;
        this.id = id;

        this.dataset.id = id;

        this.classList.add('view-holder');
        this.style.display = 'none'


    }

    addContent<role extends Exclude<Role, "messages">>(role: role): ViewContent
    addContent<role extends "messages">(role: role, messageBar: MessageBar): ViewContent
    addContent<role extends Role>(role: role, messageBar?: MessageBar): ViewContent {

        // create content
        const content = new ViewContent(this, role)

        // add content
        this.contents[role] = content;
        this.appendChild(content)

        // add message bar
        if (messageBar)
            this.addMessageBar(messageBar)

        // return w/ content
        return content;

    }

    addMessageBar(messageBar: MessageBar) {
        this.messageBar = messageBar;
        this.appendChild(messageBar)
    }

    addTopBar(topBar: TopBar) {
        this.topBar = topBar;
        this.appendChild(topBar)
    }

    makeMain() {
        View.resetMain();

        this.isMain = true;
        this.style.display = 'grid';

        location.hash = this.id

        document.querySelector<HTMLElement>("no-channel-background").style.display = "none"
    }

    static resetMain() {
        document.querySelectorAll<View>('.view-holder').forEach(view => {
            view.isMain = false;
            view.style.display = 'none';
        })

        document.querySelector<HTMLElement>("no-channel-background").style.display = "flex"

        document.body.classList.remove("hide-bar")

        title.reset()
        location.hash = ""
    }

    get main(): ViewContent {
        return this.contents[this.mainContent]
    }

    set main(content: ViewContent) {

        for (const role in this.contents)
            this.contents[role] ? this.contents[role].style.display = 'none' : null

        content.style.display = '';
        this.mainContent = content.role

        if (content.role === 'messages')
            this.messageBar.style.display = 'flex'
        else
            this.messageBar.style.display = 'none'
    }
}

export class ViewContent extends HTMLElement {
    id: string;
    channel: Channel;
    role: Role;
    holder: View;

    constructor(holder: View, role: Role) {
        super();

        this.id = holder.id;
        this.channel = holder.channel;
        this.holder = holder;
        this.role = role;

        this.dataset.id = holder.id;
        this.dataset.role = role;

        this.classList.add("view", role);
        this.style.display = "none"

    }

    get scrolledToBottom(): boolean {
        return Math.abs(
            this.scrollHeight -
            this.scrollTop -
            this.clientHeight
        ) <= 100
    }

    makeMain() {
        this.holder.main = this;
        this.holder.makeMain();
    }

    get isMain(): boolean {
        return this.holder.isMain && this.holder.mainContent === this.role;
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
        JSON.stringify(prevMessage.data.author.webhookData) === JSON.stringify(message.data.author.webhookData) &&
        prevMessage.data.notSaved === message.data.notSaved &&
        JSON.stringify(prevMessage.data.tags) === JSON.stringify(message.data.tags) &&
        ((new Date(message.data.time).getTime() - new Date(prevMessage.data.time).getTime()) / 1000) / 60 < 2 &&
        !message.data.replyTo
    )
}

export default class Channel {

    id: string;
    name: string;
    messages: Message[] = [];
    bar: MessageBar;

    share: Share;

    muted: boolean = false;
    unread: boolean = false;

    viewHolder: View;
    chatView: ViewContent;

    private loadedMessages: number = 0;

    lastReadMessage?: number;
    mostRecentMessage: number;
    leastRecentMessage: number;

    protected unreadBar?: HTMLDivElement;
    protected unreadBarId?: number;

    private readCountDown: ReturnType<typeof setTimeout>;

    private lastMessageTime: number;

    ready: Promise<boolean>;

    private dividers: Record<string, [number, HTMLDivElement]> = {};

    bind: ReturnType<typeof roomSockets.binderFor>;

    constructor(id: string, name: string, barData?: MessageBarData) {

        this.id = id;
        this.name = name;

        channelReference[id] = this;

        this.createMessageBar(barData)

        this.viewHolder = new View(id, this);

        this.chatView = this.viewHolder.addContent("messages", this.bar);
        this.viewHolder.main = this.chatView;

        this.share = new Share(this.id);

        document.body.appendChild(this.viewHolder);

        this.bind = roomSockets.binderFor(id);

        this.bind("incoming-message", (data) => {
            this.handleNotifying(data);
        })

        this.ready = new Promise(resolve => {
            socket.emit("get unread data", this.id, data => {
                this.lastReadMessage = data.lastRead;
                // just realized that the most recent message id is not in the data...
                // whatever, this "temporary" solution should work for now ;)
                this.mostRecentMessage = data.lastRead + data.unreadCount;

                this.time = data.time;

                if (data.unread) {
                    this.markUnread()
                    title.setNotifications(this.id, data.unreadCount)
                    notifications.setFor(this)
                }

                resolve(true)
            })
        })

    }

    protected loaded: boolean = false;
    protected load(): void {
        this.bind("incoming-message", (data) => {  
            this.handle(data);
        })

        this.bind("message-edited", (data) => {
            this.handleEdit(data);
        })

        this.bind("message-deleted", (messageID) => {
            this.handleDelete(messageID);
        })

        this.bind("reaction", (id, data) => {
            this.handleReaction(id, data);
        })

        this.bind("typing", (names) => {
            this.bar.typing = names;
        })

        this.bind("bot data", (data) => {
            this.bar.commands = data
                .filter(b => !b.mute && b.commands)
                .map(b => b.commands)
                .flat();

            this.botData = data;

        })
        socket.emit("get bot data", this.id);

        this.bind("bulk message updates", (messages) => {
            messages.forEach(message =>
                this.handleEdit(message)
            )
        })

        this.bind("mute", (muted) => {
            if (muted) {
                this.bar.container.disabled = true;
                this.bar.container.text = "";
                this.bar.setPlaceholder("You are muted in this room");
            } else {
                this.bar.container.disabled = false;
                this.bar.resetPlaceholder();
            }
        })

        socket.emit(
            "get room messages",
            this.id,
            true,
            (messages) => {
                this.loadMessages(messages);
                this.doScrolling();
                this.loaded = true;
            }
        )

    }

    get mainView(): ViewContent {
        return this.viewHolder.main
    }

    set mainView(content: ViewContent) {
        this.viewHolder.main = content;
    }

    handleMain(data: MessageData, noAnimation: boolean = false) {
        // validate 

        if ((!data.text && !data.media) || !data.author || !data.author.id || !data.time)
            return;

        // create

        const message = new Message(data, this);

        message.channel = this;

        const scrolledToBottom =
            Math.abs(
                this.chatView.scrollHeight -
                this.chatView.scrollTop -
                this.chatView.clientHeight
            ) <= 200

        message.draw();
        this.chatView.appendChild(message);
        message.clipLines();

        if (noAnimation)
            message.classList.add("no-animation")

        // add message

        this.messages.push(message);

        const previousMessage = this.messages[this.messages.length - 2];

        if (shouldTheyBeJoined(message, previousMessage))
            message.hideAuthor();

        this.insertDayDivider(message)

        // scrolling 

        if (this.loaded && scrolledToBottom && document.hasFocus())
            this.chatView.scrollTop = this.chatView.scrollHeight

        // marking as read/unread
        if (!message.data.notSaved && (!this.lastReadMessage || data.id > this.lastReadMessage)) {
            if (this.loaded && this.chatView.isMain && document.hasFocus())
                this.readMessage(data.id)
            else
                this.createIntersectionObserver(message)
        }

    }

    handleNotifying(data: MessageData) {

        if (data.id > this.mostRecentMessage) {
            this.mostRecentMessage = data.id;
            this.time = Date.parse(data.time.toString())
        }

        if (
            (
                (data.author.id !== me.id && Settings.get("sound-new-message")) ||
                (data.author.id === me.id && Settings.get("sound-on-send"))
            ) && !this.muted && !data.muted
        )
            document.querySelector<HTMLAudioElement>("#msgSFX")?.play()

        // notification 

        if (
            Notification.permission === 'granted' &&
            data.author.id !== me.id &&
            Settings.get("desktop-new-message") &&
            !this.muted &&
            !data.muted
        )
            new Notification(`${data.author.name} (${this.name} on Backup Google Chat)`, {
                body: data.text,
                icon: data.author.image,
                silent: document.hasFocus(),
            })

        if (!this.loaded && !data.notSaved && (!this.lastReadMessage || data.id > this.lastReadMessage))
            this.markUnread(data.id)
    }

    createIntersectionObserver(message: Message) {
        const { data } = message;

        // https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API
        const observer = new IntersectionObserver(items => {
            if (items[0].intersectionRatio <= 0)
                return; // called once when observer is created, this ignores that

            if (!this.chatView.isMain || !document.hasFocus())
                return;

            this.readMessage(data.id)
            observer.disconnect()
        }, {
            threshold: 1
        })

        observer.observe(message)

        this.markUnread(data.id)
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

        const message = new Message(data, this);

        message.channel = this;

        message.draw();
        this.chatView.prepend(message);
        message.clipLines();

        message.classList.add("no-animation")

        this.messages.unshift(message);

        const previousMessage = this.messages[1];

        if (shouldTheyBeJoined(previousMessage, message))
            previousMessage.hideAuthor();

        this.insertDayDivider(message);

        // marking as read/unread

        if (data.id > this.lastReadMessage)
            this.createIntersectionObserver(message)

    }

    initiateDelete(id: number) {
        confirm('Delete message?', 'Delete Message?').then(res => {
            if (res)
                socket.emit("delete-message", this.id, id);
        })
    }

    initiateEdit(message: MessageData) {

        this.bar.setImage('https://img.icons8.com/material-outlined/48/000000/edit--v1.png')
        this.bar.setPlaceholder("Edit message (press esc to cancel)")
        this.bar.blockWebhookOptions = true;

        this.bar.container.text = message.text;
        this.bar.container.focus();

        const stopEdit = (event: KeyboardEvent) => {
            if (event.key !== "Escape")
                return;

            this.bar.container.removeEventListener("keydown", stopEdit)
            this.bar.tempOverrideSubmitHandler = undefined;
            this.bar.blockWebhookOptions = false;
            this.bar.container.text = "";
            this.bar.resetPlaceholder();
        }

        this.bar.container.addEventListener("keydown", stopEdit)

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
        this.bar.container.focus();

        this.bar.setPlaceholder(`Reply to ${data.author.name} (press esc to cancel)`)

        const stopReply = event => {
            if (event.key === 'Escape') {
                this.bar.replyTo = null;
                this.bar.resetPlaceholder();

                this.bar.container.removeEventListener('keydown', stopReply)
            }
        }

        this.bar.container.addEventListener('keydown', stopReply)

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
        this.messages = this.messages.filter(i => i.data.id !== id)

        const findMessageAbove = (id: number): Message | undefined => {
            const msg = this.messages.find(message => message && message.data.id === id - 1 && !message.data.notSaved)

            if (!msg && id !== 0)
                return findMessageAbove(id - 1)

            return msg;

        }

        const findMessageBelow = (id: number): Message | undefined => {
            const msg = this.messages.find(message => message && message.data.id === id + 1 && !message.data.notSaved)

            // if message doesn't exist AND message id is less than the most recent message's id
            if (!msg && id < this.messages[this.messages.length - 1].data.id)
                return findMessageBelow(id + 1)

            return msg;

        }

        const messageAbove = findMessageAbove(id)
        const messageBelow = findMessageBelow(id)

        if (messageBelow && messageAbove) {
            if (shouldTheyBeJoined(messageBelow, messageAbove))
                messageBelow.hideAuthor();
            else
                messageBelow.showAuthor();
        } else if (messageBelow && !messageAbove)
            messageBelow.showAuthor();
        else if (messageAbove && !messageBelow)
            message.showAuthor()

        // remove day divider (if needed)

        const divider = this.getDayDivider(id);
        if (divider) {
            // divider: [date: string, [messageId: number, element: HTMLDivElement]]
            // we got the double tuple lol
            divider[1][1].remove();
            delete this.dividers[divider[0]];
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

        message.update(data);

    }

    clear() {
        this.messages = [];
        this.chatView.innerHTML = "";
    }

    makeMain() {

        if (!this.loaded)
            this.load();
        else
            this.doScrolling();


        this.mainView.makeMain();

        if (this.chatView.isMain)
            this.bar.makeMain();

        mainChannelId = this.id

    }

    private doScrolling() {
        this.chatView.style.scrollBehavior = "auto"

        if (this.unreadBar)
            this.unreadBar.scrollIntoView({
                behavior: 'auto',
                block: "end"
            })
        else
            this.chatView.scrollTo({
                behavior: "auto",
                top: this.chatView.scrollHeight
            })

        this.chatView.style.scrollBehavior = "smooth"
    }

    scrollToMessage(id: number) {

        const message = this.messages.find(i => i.data.id === id);

        if (message) {
            message.scrollIntoView()
            message.select()
        } else
            window.open(`${location.origin}/${this.id}/archive?message=${id}`)

    }

    remove() {
        this.bar.remove();
        this.viewHolder.remove();
        roomSockets.unbindAll(this.id);

        if (this.mainView.isMain)
            Channel.resetMain();

        delete channelReference[this.id];
    }

    static resetMain() {
        View.resetMain();
        MessageBar.resetMain();

        mainChannelId = undefined;
    }

    createMessageBar(barData) {
        const bar = new MessageBar(
            barData || {
                name: this.name
            }
        )

        bar.channel = this;

        let typingTimer, typingStopped = true;
        bar.container.addEventListener('input', event => {
            if (typingStopped)
                socket.emit('typing', this.id, true)

            typingStopped = false;
            clearTimeout(typingTimer);

            typingTimer = setTimeout(() => {
                socket.emit('typing', this.id, false)
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
            socket.emit("message", this.id, data, (sent) => {

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

            if (!this.leastRecentMessage || message.id < this.leastRecentMessage)
                this.leastRecentMessage = message.id;

            if (loadOnTop) this.handleTop(message)
            else this.handleMain(message, true)
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

        socket.emit("get room messages", this.id, this.leastRecentMessage, messages => {
            button.innerText = "Drawing Messages..."

            this.loadMessages(messages, true)

            button.innerText = "Loading Done"

            this.chatView.style.scrollBehavior = "auto"
            this.chatView.scrollTo({
                // scrolls to the button
                // i wish i could just use scrollIntoView but for some reason it behaved strangely
                // on chrome
                top: button.offsetTop - this.chatView.offsetTop
            })
            this.chatView.style.scrollBehavior = "smooth"

            setTimeout(() => button.remove(), 300)

        })

    }

    readMessage(id: number): void {
        if (this.lastReadMessage >= id)
            return;

        this.lastReadMessage = id;
        title.setNotifications(this.id, this.mostRecentMessage - id)
        notifications.setFor(this)

        if (this.mostRecentMessage === id)
            this.markRead() // all messages have been read

        clearTimeout(this.readCountDown)
        this.readCountDown = setTimeout(() => {
            socket.emit("read message", this.id, id)
        }, 250)
    }

    /**
     * Called when every message in the channel has been read
     */
    markRead() {
        this.unread = false;

        if (this.unreadBar) {
            this.unreadBar.remove()
            this.unreadBar = undefined;
        }

        // this function is meant to be extended by the room and DM classes
    }

    /**
     * Called once for every unread message when there are unread messages in the channel
     * @param id ID of the unread message
     */
    markUnread(id?: number): void {

        if (id) {
            if (this.unreadBar && this.unreadBarId && id < this.unreadBarId) {
                this.unreadBar.remove()
                this.unreadBar = undefined;
            }

            this.createUnreadBar(id)

            title.setNotifications(this.id, this.mostRecentMessage - this.lastReadMessage)
            notifications.setFor(this)
        }

        this.unread = true;

        // this function is meant to be extended by the room and DM classes
    }

    /**
     * If no unread bar exists, creates one and places it above the specified message
     * @param id ID of message to place bar above
     */
    createUnreadBar(id: number) {
        if (this.unreadBar)
            return;

        const message = this.messages.find(e => e.data.id === id)

        if (!message)
            return;

        this.unreadBar = this.insertBar(id, "Unread Messages");
        this.unreadBarId = id;

    }

    // these are meant to be extended by rooms and dms
    set time(number: number) {
        this.lastMessageTime = number;
    }

    get time(): number {
        return this.lastMessageTime
    }

    insertDayDivider(message: Message): void;
    insertDayDivider(id: number): void;
    insertDayDivider(idOrMessage: number | Message): void {
        const id = typeof idOrMessage === "number" ? idOrMessage : idOrMessage.data.id;
        const message = typeof idOrMessage === "number" ? this.messages.find(m => m.data.id === id) : idOrMessage;
        if (!message) return;

        const date = new Date(message.data.time);
        const day = date.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric"
        })

        if (this.dividers[day]?.[0] <= id) return;
        this.dividers[day]?.[1].remove();

        this.dividers[day] = [id, this.insertBar(id, day, true)];

    }

    getDayDivider(id: number) {
        return Object.entries(this.dividers).find(d => id === d[1][0]);
    }

    private insertBar(id: number, text: string, hideBar?: boolean) {
        const bar = document.createElement("div");
        bar.className = "unread-bar";
        hideBar && bar.classList.add("text-only");

        const span = document.createElement("span");
        span.innerText = text;

        bar.append(
            document.createElement("div"),
            span,
            document.createElement("div")
        );

        this.chatView.insertBefore(bar, this.messages.find(e => e.data.id === id));

        return bar;
    }

    get botData() {
        return this.bar.botData;
    }

    set botData(data: BotData[]) {
        this.bar.botData = data;
    }

    get botList() {
        return this.botData.map(b => b.name);
    }

}