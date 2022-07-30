/**
 * @module autoMod
 * @version 1.5: make class-based, add settings, add reactive automod
 * 1.4: fix mutes, add isMuted
 * 1.3: add mutes and new anti-spam
 * 1.2: minor refactor & fix security vulnerability
 * 1.1: added autoModText
 * 1.0: created
 */

import { UserData } from '../lib/authdata';
import Message from '../lib/msg';
import Room from './rooms';

export enum autoModResult {
    same = "You cannot send the same message twice in a row.",
    spam = "You are sending messages too quickly! Slow down!",
    kick = "You have been muted for spamming.",
    pass = "Message approved",
    long = "Text is too long!",
    short = "Text is too short!",
    slowSpam = "You are sending too many messages!",
    muted = "You are muted for spamming.",
}

export default class AutoMod {
    strictLevel: number;
    warningsLevel: number;

    room: Room;

    private warnings: {
        [key: string]: number
    } = {};

    private messageWaitTimes: {
        [key: string]: number
    } = {};

    private prevMessages: {
        [key: string]: Message
    } = {};

    private mutes: string[] = [];

    private reactiveWarns: string[] = [];

    constructor({ strictLevel, warnings, room }: { strictLevel: number, warnings: number, room: Room }) {
        this.strictLevel = strictLevel;
        this.warningsLevel = warnings;
        this.room = room;
    }

    private checkMinWaitTime(message: Message, prevMessage: Message): autoModResult {
        const minWaitTime = this.strictLevel * 50, id = message.author.id

        if (Date.parse(message.time.toString()) - Date.parse(prevMessage.time.toString()) < minWaitTime)
            return autoModResult.spam

        return autoModResult.pass
    }

    private checkReactive(message: Message, prevMessage: Message) {

        const waitTime = Date.parse(message.time.toString()) - Date.parse(prevMessage.time.toString());

        const range = this.strictLevel * 2

        const prevWaitTime = this.messageWaitTimes[message.author.id]

        if ((prevWaitTime + range) > waitTime && (prevWaitTime - range) < waitTime) {
            if (this.reactiveWarns.includes(message.author.id)) {
                this.reactiveWarns = this.reactiveWarns.filter(u => u !== message.author.id)
                return autoModResult.slowSpam;
            }
            else this.reactiveWarns.push(message.author.id)
        }
            
        this.messageWaitTimes[message.author.id] = waitTime

        return autoModResult.pass
    }

    check(message: Message): autoModResult {

        const id = message.author.id, prevMessage = this.prevMessages[id];

        if (!this.warnings[id])
            this.warnings[id] = 0

        if (this.mutes.includes(id))
            return autoModResult.muted

        if (AutoMod.autoModText(message.text) !== autoModResult.pass)
            return AutoMod.autoModText(message.text)

        if (!prevMessage) {
            this.prevMessages[id] = message;
            return autoModResult.pass
        }

        // start checks

        // if (autoModText(msg.text) !== autoModResult.pass) {
        //     if (!msg.image)
        //         return autoModText(msg.text)
        //     else if (msg.image && autoModText(msg.text) !== autoModResult.short)
        //         return autoModText(msg.text)
        //     // if there is an image and the automod result is short, still send it
        // }
    
        if (prevMessage.text.trim() === message.text.trim())
            return autoModResult.same

        // these are the checks that will give out warnings
        const checks: autoModResult[] = [
            this.checkMinWaitTime(message, prevMessage),
            this.checkReactive(message, prevMessage)
        ]

        let output: autoModResult = autoModResult.pass;
        checks.forEach(res => {
            if (res !== autoModResult.pass)
                output = res;
        })

        if (output === autoModResult.pass)
            this.prevMessages[id] = message
        else {
            if (this.warnings[id] === this.warningsLevel) {
                this.warnings[id] = 0;
                return autoModResult.kick;
            }
            else
                this.warnings[id]++;
        }

        return output
    }

    mute(userData: UserData, time) {
        this.mutes.push(userData.id);

        setTimeout(() => {
            this.mutes = this.mutes.filter(m => m !== userData.id)

            const msg: Message = {
                text:
                    `${userData.name} has been unmuted. Please avoid spamming in the future.`,
                author: {
                    name: "Auto Moderator",
                    image:
                        "../public/mod.png",
                    id: 'automod'
                },
                time: new Date(new Date().toUTCString()),
                tag: {
                    text: 'BOT',
                    color: 'white',
                    bgColor: 'black'
                },
                id: this.room.archive.length,
            }

            this.room.message(msg);

        }, time)
    }

    isMuted(id: string) {
        return this.mutes.includes(id);
    }

    static autoModText(rawText: string, charLimit: number = 100): autoModResult {
        const text = new String(rawText)
        if (text.trim() === '') return autoModResult.short
        if (text.length > charLimit) return autoModResult.long

        return autoModResult.pass
    }


}