import schedule from './schedule.json';


/**
 * Gets the current period as a number  
 * **NOTE:** Returned periods are zero-based, so period 1 will be returned as 0, 2 as 1, etc
 * @returns The current period
 */
export function getCurrentPeriod(): number | undefined {
    if ([0, 6].includes(new Date().getDay()))
        return;

    const now = Date.now();
    const day = new Date().toLocaleDateString();

    for (const [index, period] of schedule.entries()) {
        const start = Date.parse(`${day} ${period[0]}`);
        const end = Date.parse(`${day} ${period[1]}`);

        if (now > start && now < end)
            return index;

    }

    return;
}

/**
 * Gets the current period as a string
 * @param classes The user's classes
 * @param long Default false; Whether or not to use long format (long format = `Period x - class`, short = `class`)
 * @returns the current period as a string in the requested format
*/
export function getPeriodString(classes: string[], long: boolean = false): string {

    const period = getCurrentPeriod();

    if (typeof period !== "number")
        return ''

    // can't set variable name to class, item will have to do
    const item = classes[period]

    return long ?
        `Period ${period + 1} - ${item}` :
        classes[period]

}

function timeTo(string: string): string {

    const parsed = Date.parse(
        `${new Date().toLocaleDateString()} ${string}`
    )

    return new Date(parsed - Date.now()).toLocaleTimeString('en-US', {
        hour12: false,
        minute: 'numeric',
        second: 'numeric'
    })

}

export function getCountdownString(classes: string[]) {

    const period = getCurrentPeriod();
    const string = getPeriodString(classes, true);

    if (typeof period === "number")
        return `${string} (${timeTo(schedule[period][1])} remaining)`

    return string;

}

let reactiveUpdates: Function[] = [];
setInterval(() => reactiveUpdates.forEach(i => i()), 500)

export function setRepeatedUpdate(classes: string[], item: HTMLElement, long: boolean = false): () => void {
    const func = long ?
        () => item.innerText = getCountdownString(classes) :
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

    const day = new Date().toLocaleDateString();

    for (const [index, [_start, end]] of schedule.entries())
        if (Date.now() < Date.parse(`${day} ${end}`))
            return index;

    return schedule.length;
}