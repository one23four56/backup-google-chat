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

function generateBarLegend() {
    const div = document.createElement("div");
    div.className = "activity-bar-label";

    const holder = div.appendChild(document.createElement("div"));
    holder.className = "holder";

    for (let i = 0; i < 10; i++) {
        const element = holder.appendChild(document.createElement("div"));
        element.className = "color";
        element.style.backgroundColor = `hsla(212, 100%, 50%, ${0.1 * i})`;
    };

    const labels = div.appendChild(document.createElement("div"));
    labels.className = "labels";
    labels.appendChild(document.createElement("span")).innerText = 
        `Never online`;

    labels.appendChild(document.createElement("span")).innerText =
        `Always online`;

    return div;
}


export function showActivityPopup(data: number[][], name: string) {
    const dialog = document.body.appendChild(document.createElement("dialog"));
    dialog.className = "activity";

    const periods = schedule.getSchedule.today();

    function showPeriod(data: number[], period: number) {
        const div = document.createElement("div");
        const max = Math.max(...data);

        div.appendChild(document.createElement("h1")).innerText =
            `${scoreAdjectives[max]} online during Period ${period + 1}`;

        div.appendChild(new ActivityBar(data, period));
        div.appendChild(generateBarLegend());

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

            if (rangeStart && index === data.length - 1)
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
                time,
                "."
            )
        }

        return div;
    }

    const overview = () => {
        const div = document.createElement("div");
        div.className = "overview";

        const sums = data.map(m => m.reduce((x, y) => x + y));
        // const max = Math.max(...sums) || 1;
        const max = schedule.SCHEDULE_FIDELITY * 10;

        const chart = div.appendChild(document.createElement("div"));
        chart.className = "chart";

        const labels = div.appendChild(document.createElement("div"));
        labels.className = "labels";

        for (const [index, item] of sums.entries()) {
            const element = chart.appendChild(document.createElement("div"));
            element.className = "chart-item";
            element.style.height = (100 * item / max).toString() + "%";
            labels.appendChild(document.createElement("span")).innerText =
                `Pd. ${index + 1}`;
        }

        const activity = sums.reduce((x, y) => x + y) / (
            10 * schedule.SCHEDULE_FIDELITY * 7
        ) * 100;

        div.appendChild(document.createElement("p")).append(
            document.createTextNode(`${name} is typically online for around `),
            (() => {
                const b = document.createElement("b");
                b.innerText = activity.toFixed(1) + "%";
                return b;
            })(),
            ` of the school day.`
        );

        return div;
    }

    const list: [string, () => HTMLDivElement][] = [
        ["Overview", overview]
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
        a.download = `${name.toLowerCase().replace(/ /g, "-")}-activity-${(Date.now() / 1000).toFixed(0)}`;
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

export const scoreAdjectives = [
    "Never", // 0
    "Very rarely", // 1
    "Rarely", // 2
    "Rarely", // 3
    "Sometimes", // 4
    "Sometimes", // 5
    "Sometimes", // 6
    "Usually", // 7
    "Usually", // 8
    "Very often", // 9
    "Always" // 10
] 