import schedule from '../../../ts/lib/schedule';
import { closeDialog } from './popups';

export class ActivityBar extends HTMLElement {
    constructor(data: number[], period: number) {
        super();

        this.dataset.period = period.toString();

        const bar = this.appendChild(document.createElement("div"));
        bar.className = "activity-bar";

        for (const item of data) {
            const element = bar.appendChild(document.createElement("div"));
            element.className = "item";
            element.classList.add("count-" + item.toString());
            element.style.width = (100 / data.length).toString() + "%";
        }

        const labels = this.appendChild(document.createElement("div"));
        labels.className = "activity-labels";

        const [start, end] = schedule.getSchedule.today()[period];
        const middle = (start + end) / 2;
        const q1 = (start + middle) / 2, q3 = (middle + end) / 2;

        for (const time of [start, q1, middle, q3, end])
            labels.appendChild(document.createElement("span")).innerText =
                new Date(time).toLocaleTimeString('en-US', { timeStyle: "short" });
    }
}

customElements.define("activity-bar", ActivityBar);


export function showActivityPopup(data: number[][], name: string) {
    const dialog = document.body.appendChild(document.createElement("dialog"));
    dialog.className = "activity";

    const periods = schedule.getSchedule.today();

    function showPeriod(data: number[], period: number) {
        const div = document.createElement("div");
        div.appendChild(new ActivityBar(data, period));

        const max = Math.max(...data);

        const p = div.appendChild(document.createElement("p"));
        p.innerText = `During Period ${period + 1}, ${name} was online on `;
        p.appendChild(document.createElement("b")).innerText = max.toString();
        p.append(` of the last 10 weekdays.`);

        const split = schedule.splitPeriod(...periods[period]);
        const ranges: [number, number][] = [];

        let rangeStart: number;
        for (const [index, item] of data.entries()) {
            if (!rangeStart && item === max)
                rangeStart = split[index][0];

            if (rangeStart && item !== max) {
                ranges.push([rangeStart, split[index - 1][1]]);
                rangeStart = null;
                continue;
            }

            if (rangeStart && index === data.length -1)
                ranges.push([rangeStart, split[index][1]])
        };

        const times = ranges
            .map(e => e.map(d => new Date(d).toLocaleString('en-US', { timeStyle: "short" })))
            .map(([x, y]) => `<b>${x}</b> and <b>${y}</b>`);

        if (times.length !== 0 && max !== 0) {
            const time = document.createElement("span");
            
            // innerHTML is intentional
            time.innerHTML = (times.length === 1 ? times[0] : times.length === 2 ? times.join(" and between ") : (() => {
                const last = times.pop();
                return times.join(", ") + ", and between " + last;
            })());

            div.appendChild(document.createElement("p")).append(
                document.createTextNode(`${name} is most likely to be online between `),
                time
            )
        }

        return div;
    }

    const list: [string, () => HTMLDivElement][] = [
        ["Overview", () => document.createElement("div")]
    ];

    for (let i = 0; i < 7; i++)
        list.push([`Period ${i + 1}`, () => showPeriod(data[i], i)]);

    const sidebar = dialog.appendChild(document.createElement("div"));
    sidebar.className = "sidebar";

    const body = dialog.appendChild(document.createElement("div"));
    body.className = "body";

    for (const [name, action] of list) {
        const button = sidebar.appendChild(document.createElement("button"));
        button.innerText = name;
        button.addEventListener("click", () => {
            sidebar.querySelectorAll(".selected").forEach(e => e.classList.remove("selected"));
            button.classList.add("selected");
            body.innerText = "";
            body.append(action());
        });

        if (name === "Overview")
            button.click(); // lol
    };

    const footer = dialog.appendChild(document.createElement("div"));
    footer.className = "footer";

    const days = schedule.getLast10Days();
    const first = days.at(0), last = days.at(-1);

    footer.appendChild(document.createElement("span")).innerText =
        `Data collected from ${last.toLocaleString("en-US", { month: "numeric", day: "numeric" })} ` +
        `through ${first.toLocaleString("en-US", { month: "numeric", day: "numeric" })}, weekends excluded.`;

    const buttons = dialog.appendChild(document.createElement("div"));
    buttons.className = "buttons";

    const close = buttons.appendChild(document.createElement("button"));
    close.className = "close";
    close.appendChild(document.createElement("i")).className = "fa-solid fa-xmark";
    close.append("Close");

    const save = buttons.appendChild(document.createElement("button"));
    save.className = "export";
    save.appendChild(document.createElement("i")).className = "fa-solid fa-file-export";
    save.append("Export");

    save.addEventListener("click", () => {
        // export to csv
        const headers = ["Period"];

        for (let i = 1; i <= schedule.SCHEDULE_FIDELITY; i++)
            headers.push(`Segment ${i}`);

        const out: any[][] = [headers];

        for (const [index, period] of data.entries()) {
            const entry: any[] = [`Period ${index + 1}`];
            entry.push(...period);
            out.push(entry);
        }

        out.push([], ["Name", name]);

        const csv = out.map(e => e.join(",")).join("\n");
        const blob = new Blob([csv], {
            type: "text/csv"
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.download = `${name.toLowerCase().replace(/ /g, "-")}-activity-${(Date.now()/1000).toFixed(0)}`;
        a.href = url;
        a.click();
        URL.revokeObjectURL(url);
    })

    dialog.showModal();

    return new Promise<void>(res => {
        close.addEventListener("click", () => {
            closeDialog(dialog);
            res();
        })
    });
}