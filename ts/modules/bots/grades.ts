import Message from '../../lib/msg';
import { BotTemplate, BotUtilities } from '../bots'
import Room from '../rooms';

const
    GETGRADE_HELP_MESSAGE = "Provide a percent (e.g. 87%) or fraction (e.g. 29/30) to convert it into a letter grade.",
    GETPERCENT_HELP_MESSAGE = "Provide a letter grade (e.g. B+) to convert it into a percent range.",
    GETFRACTION_HELP_MESSAGE = "Provide a total number of points (e.g. 42) and a letter grade (e.g. A-) to get a score range."

export default class GradesBot implements BotTemplate {
    name: string;
    image: string;
    desc: string;
    commands: { command: string, args: string[] }[];

    constructor() {
        this.name = "Grades Bot"
        this.desc = "A bot that can convert percents or fractions into letter grades, and vice versa"
        this.image = "../public/grades.svg"
        this.commands = [{
            command: 'getgrade',
            args: ["[percent or fraction]"]
        }, {
            command: 'getpercent',
            args: ["[letter grade]"]
        }, {
            command: 'getfraction',
            args: ["[total points]", "[letter grade]"]
        }]
    }

    runCommand(command: string, args: string[], _message: Message, _room: Room): string {
        if (command === "getgrade") {
            const parsedArgs = BotUtilities.generateArgMap(args, this.commands[0].args)

            if (!parsedArgs)
                return GETGRADE_HELP_MESSAGE;

            const arg = parsedArgs["percentorfraction"]

            if (arg.includes("%")) {

                const percent = Number(arg.split("%")[0])

                if (isNaN(percent))
                    return `The grade you provided is not a number. ${GETGRADE_HELP_MESSAGE}`

                const grade = percentToGrade(percent)

                return `${percent}% is a${grade.charAt(0) === "A" ? 'n' : ''} ${grade}`

            } else if (arg.includes("/")) {

                const sides = arg.split("/").map(s => Number(s))

                if (sides.length > 2)
                    return `The fraction you provided is invalid. ${GETGRADE_HELP_MESSAGE}`

                for (const s of sides) {
                    if (isNaN(s))
                        return `The grade you provided is not a number. ${GETGRADE_HELP_MESSAGE}`
                }

                const
                    percent = Number(((sides[0] / sides[1]) * 100).toFixed(2)),
                    grade = percentToGrade(percent);

                return `${sides[0]}/${sides[1]} is a ${percent}%, which is a${grade.charAt(0) === 'A' ? 'n' : ''} ${grade}`

            } else return `The grade you provided is not a percent or fraction. ${GETGRADE_HELP_MESSAGE}`

        } else if (command === "getpercent") {

            const parsedArgs = BotUtilities.generateArgMap(args, this.commands[1].args)

            if (!parsedArgs)
                return GETPERCENT_HELP_MESSAGE;

            const
                grade = parsedArgs["lettergrade"].toUpperCase(),
                index = percents.findIndex(p => p[0] === grade);

            if (index === -1)
                return `Sorry, that is not a valid grade. ${GETPERCENT_HELP_MESSAGE}`

            if (index === percents.length - 1)
                return `To get an A you must score 93% or above.`

            if (index === 0)
                return `To get an F you must score less than 60%.`

            return `To get a${grade.charAt(0) === "A" ? 'n' : ''} ${grade}, you must score between ${percents[index][1]}% ` +
                `and ${percents[index + 1][1]}%.`

        } else if (command === "getfraction") {

            const parsedArgs = BotUtilities.generateArgMap(args, this.commands[2].args)

            if (!parsedArgs)
                return GETFRACTION_HELP_MESSAGE;

            const
                grade = parsedArgs["lettergrade"].toUpperCase(),
                max = Number(parsedArgs["totalpoints"]),
                index = percents.findIndex(p => p[0] === grade);

            if (isNaN(max) || max < 1)
                return `That is not a valid number of points. ${GETFRACTION_HELP_MESSAGE}`

            if (index === -1)
                return `That is not a valid grade. ${GETFRACTION_HELP_MESSAGE}`

            const formatScore = (raw: number) => Math.floor(raw) + (
                raw - Math.floor(raw) === 0 ? 0 :
                    raw - Math.floor(raw) > 0.5 ? 1 : 0.5
            )

            const
                minScore = formatScore(percents[index][1] * 0.01 * max),
                maxScore = index !== percents.length - 1 ?
                    formatScore(percents[index + 1][1] * 0.01 * max) : undefined


            if (index === percents.length - 1)
                return `To get an A, you must score ${minScore}/${max} or above`

            if (index === 0)
                return `To get an F, you must score less than ${maxScore}/${max}`

            return `To get a${grade.charAt(0) === "A" ? 'n' : ''} ${grade}, you must score between ${minScore}/${max} ` +
                `and ${maxScore}/${max}.`
        }

        return "Hmm.. that isn't a command"

    }

}

const percents = Object.entries({
    A: 93,
    'A-': 90,
    'B+': 87,
    B: 83,
    'B-': 80,
    'C+': 77,
    C: 73,
    'C-': 70,
    'D+': 67,
    D: 63,
    'D-': 60,
    F: 0
}).reverse()

function percentToGrade(percent: number): string {
    return (function helper(index: number): string {
        if (index < percents.length && percent >= percents[index][1])
            return helper(index + 1)

        return percents[Math.max(index - 1, 0)][0]
    })(0)
}