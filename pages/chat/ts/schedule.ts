import schedule from '../../../ts/lib/schedule';

/**
 * Gets the current period as a string
 * @param classes The user's classes
 * @param long Default false; Whether or not to use long format (long format = `Period x - class`, short = `class`)
 * @returns the current period as a string in the requested format
*/
export function getPeriodString(classes: string[], long: boolean = false): string {
    if ([0, 6].includes(new Date().getDay()))
        return null;


    const period = schedule.getPeriod.now();

    if (typeof period !== "number")
        return ''

    // can't set variable name to class, item will have to do
    const item = classes[period]

    return long ?
        `Period ${period + 1} - ${item}` :
        classes[period]

}

function timeToEnd(period: number): string {

    const end = schedule.getSchedule.today()[period][1];

    return new Date(end - Date.now()).toLocaleTimeString('en-US', {
        hour12: false,
        minute: 'numeric',
        second: 'numeric'
    })

}

export function getCountdownString(classes: string[], altText: string = "") {

    const period = schedule.getPeriod.now();
    const string = getPeriodString(classes);

    if (typeof period === "number" && string)
        return `${string} (ends in ${timeToEnd(period)})`

    return altText;

}

let reactiveUpdates: Function[] = [];
setInterval(() => reactiveUpdates.forEach(i => i()), 500)

export function setRepeatedUpdate(classes: string[], item: HTMLElement, long: boolean = false, altText: string = ""): () => void {
    const func = long ?
        () => item.innerText = getCountdownString(classes, altText) :
        () => item.innerText = getPeriodString(classes)

    func();
    reactiveUpdates.push(func);

    return () => reactiveUpdates = reactiveUpdates.filter(i => i !== func);
}

/**
 * Gets the number of period that have passed so far
 * @returns The number of elapsed periods, or null if it is not a school day
 */
export function getElapsedPeriods(): number | null {
    if ([0, 6].includes(new Date().getDay()))
        return null;

    const today = schedule.getSchedule.today();

    for (const [index, [_start, end]] of today.entries())
        if (Date.now() < end)
            return index;

    return today.length;
}

// doing this so i don't have to change stuff in other files
export const getCurrentPeriod = () => {
    if ([0, 6].includes(new Date().getDay())) return;
    return schedule.getPeriod.now();
}

export function getPeriodAt(date: Date) {
    if ([0, 6].includes(date.getDay()))
        return;

    return schedule.getPeriod(date.getTime());
}