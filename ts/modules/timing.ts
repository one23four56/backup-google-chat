import { Temporal } from 'temporal-polyfill';
import schedule from '../lib/schedule';
import { Users } from './users';
import { getSessionTimes } from './session';
import get from './data';

function getLast10Days() {
    const today = schedule.getDay.now();
    return new Array(10).fill(0).map(
        (_, index) => today.subtract({ days: index })
    );
};

function getPeriodIntersection(onlineTimes: [number, number][], periodSegments: number[][]) {
    return periodSegments.map(([start1, end1]) => {
        let intersection = 0;

        for (const [start2, end2] of onlineTimes)
            intersection += Math.max(Math.min(end1, end2) - Math.max(start1, start2), 0);

        return Number(intersection / (end1 - start1) >= 0.5);
    })
}

function getDayRange(day: Temporal.ZonedDateTime): [number, number] {
    const end = day.with({ hour: 23, minute: 59, second: 59, millisecond: 999 });
    return [day.epochMilliseconds, end.epochMilliseconds];
}

function sortByDays(times: [number, number][], days: [number, number][]): [number, number][][] {
    const out = Array<[number, number][]>(days.length).fill([]);

    const min = Math.min(...days.map(([s, _]) => s));
    const max = Math.max(...days.map(([_, e]) => e));

    for (const [start, end] of times) {
        if (end < min || start > max) continue;

        days.forEach(([dayStart, dayEnd], index) => {
            if (start < dayEnd && end > dayStart)
                out[index].push([start, end]);
        });
    }

    return out;
}

function getUserTimes(): Record<string, [number, number][]> {
    const users = Users.active;
    const out: Record<string, [number, number][]> = {};

    for (const id of users)
        out[id] = getSessionTimes(id);

    return out;
}

function calculateIntersections(userTimes: Record<string, [number, number][]>) {
    const days = getLast10Days();

    const daySchedules = days.map(
        day => schedule.getSchedule(day).map(([s, e]) => schedule.splitPeriod(s, e))
    );

    const dayRanges = days.map(day => getDayRange(day));

    const output: Record<string, number[][]> = {};

    for (const [userId, times] of Object.entries(userTimes)) {
        const result: number[][][] = []
        const sorted = sortByDays(times, dayRanges);

        for (const [index, day] of sorted.entries()) {
            const out: number[][] = [];
            const schedule = daySchedules[index];

            for (const period of schedule)
                out.push(
                    getPeriodIntersection(day, period)
                );

            result.push(out);
        }

        // add up results

        output[userId] = result.reduce((prev, curr) => {
            return prev.map(
                (item, i) => item.map((number, j) =>
                    number + curr[i][j]
                )
            );
        })
    }

    console.log(output);
    return output;
}

function setTimings() {
    console.time("calculated period activity in")
    const userTimes = getUserTimes();
    const intersections = calculateIntersections(userTimes);

    console.timeEnd("calculated period activity in")
}

export default setTimings;