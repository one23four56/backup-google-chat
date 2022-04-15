import { BotTemplate } from "../bots";
import Message from "../../lib/msg";

const schedule = {
    "Period 1": {
        start: "08:15",
        end: "09:06",
    },
    "Period 2": {
        start: "09:10",
        end: "10:01",
    },
    "Period 3": {
        start: "10:05",
        end: "10:56",
    },
    "Period 4": {
        start: "11:00",
        end: "11:55",
    },
    "ISHP": {
        start: "11:55",
        end: "12:24",
    },
    "Lunch": {
        start: "12:24",
        end: "12:54",
    },
    "Period 5": {
        start: "12:54",
        end: "13:45",
    },
    "Period 6": {
        start: "13:49",
        end: "14:40",
    },
    "Period 7": {
        start: "14:44",
        end: "15:35",
    },
}

export default class TimeBot implements BotTemplate {
    name: string;
    image: string;
    desc: string;
    commands: {
        command: string,
        args: string[]
    }[];

    constructor() {
        this.name = "School Time Checker V3";
        this.image = "https://st3.depositphotos.com/11477350/16756/i/950/depositphotos_167569306-stock-photo-antique-old-clock-abstract-fractal.jpg";
        this.desc = "Tells you the time until school or your current class is over";
        this.commands = [{
            command: "time tell",
            args: []
        }, {
            command: "time help",
            args: []
        }, {
            command: "time school",
            args: []
        }, {
            command: "time pd help",
            args: []
        }];
    }

    runCommand(command: string, args: string[], message: Message): string {
        switch (command) {
            case "time tell":
                return `It is currently ${new Date().toLocaleTimeString()}`;
            case "time help":
                return `${this.name} is a bot that tells you the time until school or your current class is over.` +
                `\nCommands:\n/time help - this command\n/time tell - tells current time\n/time school - tells time until school is over` +
                `\n/time pd [number | L | I] - time until given period is over/starts`
            case "time pd help":
                return `Usage: /time pd [number | L | I]\nE.X.: /time pd 1 or /time pd L`;
            case "time school":
                const start = new Date(new Date().toUTCString()).setHours(8, 15);
                const end = new Date(new Date().toUTCString()).setHours(15, 35);

                if (end - Date.now() < 0) {
                    return `School is over!`;
                } else if (Date.now() - start < 0) {
                    return `School starts in ${Math.floor((start - Date.now()) / 60000)} minutes`;
                } else if (end - Date.now() > 0) {
                    return `School ends in ${Math.floor((end - Date.now()) / 60000)} minutes`;
                }

        }
    }

    check(message: Message): boolean {
        if (message.text.indexOf("/time pd ") === -1) return false;
        
        const period = message.text.charAt(message.text.indexOf("/time pd ") + 9);

        if (period.toLowerCase() === "l" || period.toLowerCase() === "i") return true;

        if (Number(period) >= 1 && Number(period) <= 7) return true;

        return false;
    }

    runFilter(message: Message): string {
        let period = message.text.charAt(message.text.indexOf("/time pd ") + 9);

        if (period.toLowerCase() === "l")
            period = "Lunch";
        else if (period.toLowerCase() === "i")
            period = "ISHP";
        else 
            period = `Period ${period}`;

        const startTime = schedule[period].start, endTime = schedule[period].end;

        const start = new Date(new Date().toUTCString()).setHours(startTime.split(":")[0], startTime.split(":")[1]);
        const end = new Date(new Date().toUTCString()).setHours(endTime.split(":")[0], endTime.split(":")[1]);

        if (end - Date.now() < 0) {
            return `${period} is over!`;
        } else if (Date.now() - start < 0) {
            return `${period} starts in ${Math.floor((start - Date.now()) / 60000)} minutes`;
        } else if (end - Date.now() > 0) {
            return `${period} ends in ${Math.floor((end - Date.now()) / 60000)} minutes`;
        }
    }


}