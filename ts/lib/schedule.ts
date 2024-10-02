import Schedule from './schedule.json';

const SECOND = 1000;
const MINUTE = SECOND * 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;

const schedule: number[][][] = Schedule.map(([s, e]) => [
    s.split(":").map(i => Number(i)),
    e.split(":").map(i => Number(i)),
]);

type day = [number, number, number];

function getDay(ms: number): day {
    const date = new Date(ms);
    return [
        date.getFullYear(), date.getMonth(), date.getDate()
    ]
}

getDay.now = () => getDay(Date.now());

function getSchedule(day: day): [number, number][] {
    return schedule.map(([s, e]) => [
       new Date(...day, ...s).getTime(),
       new Date(...day, ...e).getTime(),
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