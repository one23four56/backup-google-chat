import type { UserData } from "../../../ts/lib/authdata";
import type { Poll, PollResult } from "../../../ts/lib/msg";
import type { ServerToClientEvents } from "../../../ts/lib/socket";
import Channel from "./channels";
import { MessageBar } from "./messageBar";
import { alert } from "./popups";
import { formatRelativeTime, me, socket } from "./script";

export default class PollElement extends HTMLElement {

    private timeDisplay: HTMLSpanElement;
    poll: Poll | PollResult;
    channel: Channel;

    private options: HTMLParagraphElement[] = [];

    constructor(poll: Poll | PollResult, channel: Channel) {
        super();

        this.poll = poll;
        this.channel = channel;

        const question = document.createElement('p');
        question.innerText = poll.question;
        question.className = "question";
        this.appendChild(question);

        if (poll.type === 'poll') {

            for (const { option } of poll.options) {

                const p = this.appendChild(document.createElement("p"));
                this.options.push(p)
                p.className = "option"

                const i = p.appendChild(document.createElement("i"))
                i.className = "fa-solid fa-circle";
                i.style.display = "none";

                p.appendChild(document.createElement("span")).innerText = option;

                const percent = p.appendChild(document.createElement("span"));
                percent.className = "percent"

                const div = p.appendChild(document.createElement("div"));
                div.className = "background"

                if (poll.finished) {
                    this.classList.add("ended")
                    continue;
                }

                p.addEventListener("click", event => {
                    event.stopPropagation();
                    socket.emit("vote in poll", channel.id, poll.id, option);
                })
            }

            const spanHolder = this.appendChild(document.createElement("div"));
            spanHolder.className = "span-holder";
            spanHolder.appendChild(document.createElement("span")).className = "votes"

            this.updateOptions(poll);
 
            this.timeDisplay = spanHolder.appendChild(document.createElement("span"))

            if (poll.finished)
                this.timeDisplay.innerText = "Poll Ended"
            else {
                this.updateTime()
                setInterval(() => this.updateTime(), 500)

                const voteListener: ServerToClientEvents["user voted in poll"] = (roomId, votePoll) => {

                    if (roomId !== channel.id || votePoll.id !== poll.id)
                        return;

                    if (votePoll.finished) {

                        socket.off("user voted in poll", voteListener);
                        const newPoll = new PollElement(votePoll, this.channel)

                        this.replaceWith(newPoll);

                    } else this.updateOptions(votePoll);

                }

                socket.on("user voted in poll", voteListener);

            }

        } else {
            const winner = document.createElement('p');
            winner.innerText = poll.winner;
            winner.className = "winner"

            this.classList.add("results")

            this.addEventListener('click', ev => {
                ev.stopPropagation();
                channel.scrollToMessage(poll.originId)
            })

            this.appendChild(winner);
        }

    }

    private updateOptions(poll: Poll) {

        const totalVotes = poll.options.reduce((pre, cur) => pre + cur.votes, 0)

        this.querySelector<HTMLSpanElement>("span.votes")
            .innerText = `${totalVotes} vote${totalVotes === 1 ? '' : 's'}`

        console.log(this.options)

        for (const [index, { voters, votes }] of poll.options.entries()) {

            const votePercent = ((votes / totalVotes) * 100), element = this.options[index];

            console.log(element)

            if (voters.includes(me.id))
                element.querySelector("i").style.display = "block";
            else
                element.querySelector("i").style.display = "none";

            element.querySelector<HTMLSpanElement>("span.percent")
                .innerText = `${isNaN(votePercent) ? 0 : votePercent.toFixed(0)}%`;

            element.querySelector("div")
                .style.width = isNaN(votePercent) ? "0%" : votePercent.toFixed(0) + "%";

        }

    }

    updateTime() {

        if (this.poll.type !== 'poll')
            return;

        this.timeDisplay.innerText = `Ends ${formatRelativeTime(this.poll.expires)}`

    }
}

window.customElements.define("message-poll", PollElement)

/**
 * Opens the poll creation menu
 */
export function openPollCreator(bar: MessageBar) {

    if (bar.poll)
        return alert("You already have a poll attached. Remove it to attach a new one.", "Error")

    const div = document.body.appendChild(document.createElement("dialog"));

    div.className = "poll";
    div.showModal();

    const title = div.appendChild(document.createElement("h1"));
    title.innerText = "Create a Poll"

    const question = document.createElement("input")
    question.maxLength = 50;
    question.minLength = 0;
    question.type = "text";
    question.placeholder = "What is your question?";

    div.appendChild(document.createElement("label")).append(
        "Question",
        document.createElement("br"),
        question
    )

    question.addEventListener("input", () => {
        if (question.value.trim().charAt(question.value.trim().length - 1) !== "?" && question.value.length > 0) {
            question.value = question.value.trim() + "?" // add question mark
            // set cursor position to before the question mark
            question.selectionStart = question.value.length - 1
            question.selectionEnd = question.value.length - 1
        }
    })

    const
        now = new Date(),
        date = document.createElement("input"),
        time = document.createElement("input"),
        split = document.createElement("div");

    split.className = "split"

    date.type = "date"
    date.min = now.toLocaleDateString('fr-ca')
    date.value = now.toLocaleDateString('fr-ca')
    date.max = new Date(Date.now() + (1000 * 60 * 60 * 24 * 7)).toLocaleDateString('fr-ca')

    split.appendChild(document.createElement("label")).append(
        "End Date",
        document.createElement("br"),
        date
    )

    time.type = "time"
    time.value = new Date(Date.now() + (1000 * 60 * 10)).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
    })

    split.appendChild(document.createElement("label")).append(
        "End Time",
        document.createElement("br"),
        time
    )

    div.appendChild(split)

    div.appendChild(document.createElement("p")).innerText = "Options"

    // array of all the option input elements
    const
        optionsHolder = div.appendChild(document.createElement("div")),
        options = [
            optionsHolder.appendChild(document.createElement("input")),
            optionsHolder.appendChild(document.createElement("input"))
        ]

    optionsHolder.className = "options-holder"

    // set up all inputs in the options array
    const initializeOptions = () => {
        for (const [index, option] of options.entries()) {

            option.placeholder = `Option ${index + 1}`
            option.maxLength = 50;
            option.type = "text"

        }
    }

    initializeOptions();

    // add an option to the array
    const addOption = () => {

        if (options.length >= 5)
            return;

        options.push(optionsHolder.appendChild(document.createElement("input")))

        initializeOptions();

        if (options.length === 5)
            add.disabled = true;

        if (options.length > 2)
            remove.disabled = false;

    }

    // remove an option
    const removeOption = () => {

        if (options.length <= 2)
            return;

        options[options.length - 1].remove();
        options.pop();

        initializeOptions();

        if (options.length < 5)
            add.disabled = false;

        if (options.length === 2)
            remove.disabled = true;

    }

    // add/remove buttons

    const
        add = div.appendChild(document.createElement("button")),
        remove = div.appendChild(document.createElement("button"));

    add.className = "add-option"
    remove.className = "remove-option"
    remove.disabled = true;

    add.appendChild(document.createElement("i")).className = "fa-solid fa-plus"
    add.append("Add Option")

    remove.appendChild(document.createElement("i")).className = "fa-solid fa-minus"
    remove.append("Remove Option")

    add.addEventListener("click", () => addOption())
    remove.addEventListener("click", () => removeOption())

    const
        submit = div.appendChild(document.createElement("button")),
        cancel = div.appendChild(document.createElement("button"));

    submit.className = "submit";
    cancel.className = "cancel";

    submit.appendChild(document.createElement("i")).className = "fa-solid fa-link"
    submit.append("Attach Poll")

    cancel.appendChild(document.createElement("i")).className = "fa-solid fa-xmark"
    cancel.append("Cancel")

    cancel.addEventListener("click", () => div.remove())

    submit.addEventListener("click", () => {

        // convert end time + date to unix time
        const end = Date.parse(`${date.value} ${time.value}`)

        // validate time

        if ((end - Date.now()) < (1000 * 60 * 1))
            return alert("The poll must end 1 minute or more from now", "Error")

        if ((end - Date.now()) > (1000 * 60 * 60 * 24 * 7))
            return alert("The poll must end in less than one week", "Error")

        // validate the other inputs

        if (!question.value.trim())
            return alert("The question field cannot be left blank", "Error")

        const parsedOptions = options
            .map(i => i.value.trim())
            .filter(v => !!v) // here !!v ensures that v is truthy (not not v = v is truthy)

        if (parsedOptions.length < 2)
            return alert("You must provide at least 2 options", "Error")

        if (new Set(parsedOptions).size !== parsedOptions.length)
            return alert("All options must be different", "Error")

        // that is all the validation that this function needs to do, all further validation
        // is another functions problem

        // add poll to message bar
        bar.setPoll({
            expires: end,
            options: parsedOptions,
            question: question.value
        })

        div.remove()

    })

}

/**
 * Opens the active polls menu for a room
 * @param roomId id of the room to open it for
 */
export async function openActivePolls(channel: Channel) {

    const holder = document.body.appendChild(document.createElement("div"))
    holder.className = "side-holder"

    const div = holder.appendChild(document.createElement("div"))
    div.className = "active-polls"

    div.appendChild(document.createElement("h1")).innerText = "Active Polls"

    const polls: [UserData, Poll][] = await new Promise(
        res => socket.emit("get active polls", channel.id, d => res(d))
    );

    for (const [userData, poll] of polls) {

        const container = div.appendChild(document.createElement("div"));
        container.className = "poll-container"

        container.appendChild(new PollElement(poll, channel))

        const p = container.appendChild(document.createElement("p"))
        p.appendChild(document.createElement("img")).src = userData.img
        p.append(`Poll by ${userData.name}`);

    }

    if (polls.length === 0) // if only js had for(x) {} else {}...
        div.appendChild(document.createElement("p")).innerText = "There are no active polls."

    holder.addEventListener("click", event => {
        if (event.target === holder)
            holder.remove()
    })
}