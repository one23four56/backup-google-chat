const Schedule = [
    [
        "08:15",
        "09:06"
    ],
    [
        "09:10",
        "10:01"
    ],
    [
        "10:05",
        "10:56"
    ],
    [
        "11:00",
        "11:55"
    ],
    [
        "12:54",
        "13:45"
    ],
    [
        "13:49",
        "14:40 "
    ],
    [
        "14:44",
        "15:35"
    ]
];


import { Temporal } from 'temporal-polyfill';

const SCHEDULE_FIDELITY = 20;

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

function splitPeriod(start: number, end: number): [number, number][] {
    const duration = end - start;
    const segmentLength = duration / SCHEDULE_FIDELITY;

    return Array(SCHEDULE_FIDELITY).fill(0)
        .map((_, index) => [
            start + segmentLength * index,
            start + segmentLength * (index + 1)
        ])
};

export default {
    getDay, getPeriod, getSchedule,
    splitPeriod, SCHEDULE_FIDELITY,
}