import Message from '../../lib/msg';
import { BotOutput, BotTemplate, BotUtilities } from '../bots';
import Room from '../rooms';

const UNCERTAINTY_HELP = "Provide a data point and its uncertainty to calculate percent uncertainty."
const SIGFIGS_HELP = "Provide a number to find its sigfigs.";
const SCIENTIFIC_HELP = "Provide a number to convert it to scientific notation.";
const DIFFERENCE_HELP = "Provide two numbers to find their percent difference.";
const ERROR_HELP = "Provide an accepted value and what you measured to find percent error.";
const SPREAD_HELP = "Provide a real data point, a target percent uncertainty, and a number of trials to generate data."

export default class LabBot implements BotTemplate {
    name: string = "Lab Bot";
    desc: string = "Helps with chemistry and physics labs. All commands follow sigfig rules.";
    image: string = "/public/lab.svg";
    commands: BotTemplate["commands"] = [
        {
            command: "spread",
            description: "Generates fake data points from a real one.",
            args: [
                ["[real data]", "Real data point to base fake data on"],
                ["[target uncertainty]", "Target percent uncertainty of fake data"],
                ["[trials]", "Number of trials to simulate (max 20)"]
            ]
        },
        {
            command: "sigfigs",
            description: "Counts the amount of significant figures in a number.",
            args: [
                ["[number]", "Number to count the sigfigs of"]
            ]
        },
        {
            command: "uncertainty%",
            description: "Gets percent uncertainty.",
            args: [
                ["[data]", "Number before the ±"],
                ["[uncertainty]", "Number after the ±"]
            ]
        },
        {
            command: "difference%",
            description: "Gets percent difference between two numbers.",
            args: [
                ["[number 1]", "First measurement"],
                ["[number 2]", "Second measurement"]
            ]
        },
        {
            command: "error%",
            description: "Gets percent error.",
            args: [
                ["[measured]", "Lab result"],
                ["[accepted]", "Accepted value"]
            ]
        },
        {
            command: "scientific",
            description: "Converts a number to scientific notation.",
            args: [
                ["[number]", "Number to convert"]
            ]
        }
    ];

    runCommand(command: string, args: string[], message: Message, room: Room): string | BotOutput | Promise<string> | Promise<BotOutput> {
        if (command === "spread") {

            const parsedArgs = BotUtilities.generateArgMap(args, this.commands[0].args);
            if (!parsedArgs) return SPREAD_HELP;

            const start = parseNumber(parsedArgs["realdata"]);
            if (!start) return "The starting data point must be a number. " + SPREAD_HELP;

            if (!parsedArgs["targetuncertainty"].endsWith("%"))
                return "Target uncertainty must be a percent. " + SPREAD_HELP;

            const uncertainty = parseNumber(parsedArgs["targetuncertainty"]);
            if (!uncertainty) return "Target uncertainty must be a number. " + SPREAD_HELP;
            if (uncertainty.number <= 0 || uncertainty.number > 100) return "Target uncertainty must be above 0% and no greater than 100%. " + SPREAD_HELP;

            const trials = parseNumber(parsedArgs["trials"]);
            if (!trials) return "The number of trials must be a number. " + SPREAD_HELP;
            if (trials.number > 20 || trials.number < 5) return "The number of trials must be between 5 and 20. " + SPREAD_HELP;

            const max = start.number * uncertainty.number * 0.68;
            const sigfigs = getSigFigs(start.string);
            const data = [ start.number ];

            for (let i = 0; i < trials.number - 1; i++) {
                const randomFactor = (Math.random() - 0.5) * max * 20;
                data.push(start.number + randomFactor)
            }

            let output = `Spread for ${start.string} at ${uncertainty.string}% target uncertainty, ${trials.number} trials.`
            output += "\n----------------------------------\n";
            output += data.map(m => `${m.toPrecision(sigfigs)}`).join("\n");
            output += "\n----------------------------------\n";

            const mean = data.reduce((a, b) => a + b) / data.length;
            const standardDev = Math.sqrt(
                data.map(x => (x - mean) ** 2).reduce((a, b) => a + b) / (data.length - 1)
            ); // https://stackoverflow.com/a/53577159/ and https://stackoverflow.com/a/63838108/
            const realUncertainty = standardDev / Math.sqrt(data.length);

            output += `Mean: ${mean.toPrecision(sigfigs)} ± ${realUncertainty.toPrecision(sigfigs)}\n`;
            output += `Mean vs Input (difference): ${getDifference(mean, start.number, sigfigs)}%\n`
            output += `Actual/ Uncertainty: ${getUncertainty(realUncertainty, mean, sigfigs)}%\n`;
            output += `Uncertainty Error (vs target): ${getError(realUncertainty / mean, uncertainty.number, sigfigs)}%`

            return output;

        } else if (command === "scientific") {

            const parsedArgs = BotUtilities.generateArgMap(args, this.commands[1].args);
            if (!parsedArgs) return SCIENTIFIC_HELP;

            const parsed = parseNumber(parsedArgs["number"]);
            if (!parsed) return SCIENTIFIC_HELP;

            const
                exponential = parsed.number.toExponential(
                    Math.max(0, Math.min(20, getSigFigs(parsed.string) - 1))
                ),
                formatted = exponential.split("e")[0] + " × 10^" + exponential.split("e")[1].replace("+", "");

            return `${parsed.string} is ${formatted} in standard scientific notation, or ${exponential} in E notation.`;

        } else if (command === "sigfigs") {
            const parsedArgs = BotUtilities.generateArgMap(args, this.commands[1].args);
            if (!parsedArgs) return SIGFIGS_HELP;

            const number = parseNumber(parsedArgs["number"]);
            if (!number) return SIGFIGS_HELP;

            const sigfigs = getSigFigs(number.string);

            return `${number.number} has ${sigfigs} significant figure${sigfigs === 1 ? "" : "s"}.`

        } else if (command === "uncertainty%") {
            const parsedArgs = BotUtilities.generateArgMap(args, this.commands[2].args);
            if (!parsedArgs) return UNCERTAINTY_HELP;

            const data = parseNumber(parsedArgs["data"]), uncertainty = parseNumber(parsedArgs["uncertainty"]);
            if (!data || !uncertainty) return UNCERTAINTY_HELP;

            return `${data.string} ± ${uncertainty.string} has a percent uncertainty of ${getUncertainty(uncertainty.number, data.number, getSigFigs(data.string))}%`
        } else if (command === "difference%") {

            const parsedArgs = BotUtilities.generateArgMap(args, this.commands[3].args);
            if (!parsedArgs) return DIFFERENCE_HELP;

            const input1 = parseNumber(parsedArgs["number1"]), input2 = parseNumber(parsedArgs["number2"]);
            if (!input1 || !input2)
                return DIFFERENCE_HELP;

            const sigfigs = Math.min(
                getSigFigs(input1.string), getSigFigs(input2.string)
            );

            return `${input1.string} and ${input2.string} have a percent difference of ${getDifference(input1.number, input2.number, sigfigs)
                }%`
        } else if (command === "error%") {
            const parsedArgs = BotUtilities.generateArgMap(args, this.commands[4].args);
            if (!parsedArgs) return ERROR_HELP;

            const measured = parseNumber(parsedArgs["measured"]), accepted = parseNumber(parsedArgs["accepted"]);
            if (!measured || !accepted)
                return ERROR_HELP;

            const sigfigs = getSigFigs(measured.string);

            return `${measured.string} has a percent error of ${getError(measured.number, accepted.number, sigfigs)}% versus the accepted value of ${accepted.string}`
        }
    }
}

function getSigFigs(value: string) {
    if (value.includes("e"))
        return value
            .split("e")[0]
            .replace(".", "")
            .length;
    // in scientific notation all digits are significant

    const first = value.search(/[1-9]/);
    if (first === -1) return 0;

    let decimal = value.slice(0, first).includes("."), count = 0;
    for (const [index, digit] of value.slice(first).split("").entries()) {
        if (digit === "0" && !decimal) continue;
        if (digit === ".") decimal = true;
        count = index + 1;
    }

    return value
        .slice(first, first + count)
        .replace(".", "")
        .length;
}

function format(number: number, sigfigs: number) {
    sigfigs = Math.max(1, Math.min(50, sigfigs)); // toPrecision has a min of 0 and max of 100

    let string = number.toPrecision(sigfigs);

    if (string.indexOf("e") === -1 && string.indexOf(".") === -1 && string.endsWith("0"))
        string += ".";

    if (string.indexOf("e") !== -1) {
        if (getSigFigs(Number(string).toString()) === sigfigs)
            string = Number(string).toString();
        // has to be Number(string) b/c number is not rounded
        else
            string = string.split("e")[0] + " × 10^" + string.split("e")[1].replace("+", "");
    }

    return string;
}

function getUncertainty(uncertainty: number, data: number, sigfigs: number) {
    return format(
        (100 * uncertainty / data), sigfigs
    );
}

function getDifference(number1: number, number2: number, sigfigs: number) {
    return format(
        (100 * Math.abs(number1 - number2) / ((number1 + number2) / 2)),
        sigfigs
    );
}

function getError(result: number, accepted: number, sigfigs: number) {
    return format(
        (100 * (result - accepted) / accepted), sigfigs
    )
}


function parseNumber(string: string) {
    const factor = string.endsWith("%") ? 0.01 : 1;

    string = string.replace(/,|_|%/g, "");
    const number = Number(string) * factor;

    if (Number.isNaN(number) || !Number.isFinite(number))
        return false;

    string = string.slice(0, 50);

    return { string, number };
}