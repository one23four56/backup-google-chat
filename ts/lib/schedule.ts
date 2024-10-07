import Schedule from './schedule.json';
import { Temporal } from 'temporal-polyfill';

const schedule: number[][][] = Schedule.map(([s, e]) => [
    s.split(":").map(i => Number(i)),
    e.split(":").map(i => Number(i)),
]);

function getDay(ms: number): Temporal.ZonedDateTime {
    return Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTime({
        calendar: "gregory",
        timeZone: "America/Chicago"
    }).startOfDay();
}

getDay.now = () => getDay(Date.now());

function getSchedule(day: Temporal.ZonedDateTime): [number, number][] {
    return schedule.map(([s, e]) => [
        day.with({ hour: s[0], minute: s[1] }).epochMilliseconds,
        day.with({ hour: e[0], minute: e[1] }).epochMilliseconds,
    ]);
}

getSchedule.today = () => getSchedule(getDay.now());

function getPeriod(time: number): number | undefined {
    for (const [index, [start, end]] of getSchedule(getDay(time)).entries()) {
        if (time > start && time <= end)
            return index;
    }

    return;
}

getPeriod.now = () => getPeriod(Date.now());

export default {
    getDay, getPeriod, getSchedule
}