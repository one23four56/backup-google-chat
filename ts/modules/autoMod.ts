/**
 * @module autoMod
 * @version 1.5: make class-based, add settings, add reactive automod
 * 1.4: fix mutes, add isMuted
 * 1.3: add mutes and new anti-spam
 * 1.2: minor refactor & fix security vulnerability
 * 1.1: added autoModText
 * 1.0: created
 */

import Message from '../lib/msg';
import Channel from './channel';
import { RoomFormat } from './rooms';

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
    settings: RoomFormat["options"]["autoMod"];

    room: Channel;

    private warnings: {
        [key: string]: number
    } = {};

    private messageWaitTimes: {
        [key: string]: number
    } = {};

    private prevMessages: {
        [key: string]: Message
    } = {};

    private reactiveWarns: string[] = [];

    constructor(room: Channel, settings: RoomFormat["options"]["autoMod"]) {
        this.strictLevel = settings.strictness;
        this.warningsLevel = settings.warnings;
        this.room = room;
        this.settings = settings;
    }

    private checkMinWaitTime(message: Message, prevMessage: Message, bot?: boolean): autoModResult {
        const minWaitTime = this.getStrictLevel(bot) * 50, id = message.author.id

        if (Date.parse(message.time.toString()) - Date.parse(prevMessage.time.toString()) < minWaitTime)
            return autoModResult.spam

        return autoModResult.pass
    }

    private checkReactive(message: Message, prevMessage: Message, bot?: boolean) {

        const waitTime = Date.parse(message.time.toString()) - Date.parse(prevMessage.time.toString());

        const range = this.getStrictLevel(bot) * 2

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

    private getStrictLevel(bot?: boolean) {
        if (!bot) return this.strictLevel;
        return this.settings.botEnhanced ? 8 : 5;
    }

    check(message: Message, bot?: boolean): autoModResult {

        const id = message.author.id, prevMessage = this.prevMessages[id];

        if (!this.warnings[id])
            this.warnings[id] = 0

        if (this.room.isMuted(id))
            return autoModResult.muted

        const result = AutoMod.text(message.text, 5000, message.media ? true : false)

        if (result !== autoModResult.pass)
            return result;

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

        if (this.settings.blockDuplicates && prevMessage.text.trim() === message.text.trim())
            return autoModResult.same

        if (!this.settings.allowBlocking && !bot)
            return autoModResult.pass

        // these are the checks that will give out warnings
        const checks: autoModResult[] = [this.checkMinWaitTime(message, prevMessage, bot)]

        if (this.settings.blockSlowSpam || bot)
            checks.push(this.checkReactive(message, prevMessage, bot));

        let output: autoModResult = autoModResult.pass;
        checks.forEach(res => {
            if (res !== autoModResult.pass)
                output = res;
        })

        if (output === autoModResult.pass)
            this.prevMessages[id] = message
        else if (this.settings.allowMutes || bot) {
            if (this.warnings[id] === (bot ? this.settings.botWarnings : this.warningsLevel)) {
                this.warnings[id] = 0;
                return autoModResult.kick;
            }
            else
                this.warnings[id]++;
        }

        return output;
    }

    static text(rawText: string, charLimit: number = 100, overrideShort: boolean = false): autoModResult {
        const text = new String(rawText)
        if (text.trim() === '' && !overrideShort) return autoModResult.short
        if (text.length > charLimit) return autoModResult.long

        return autoModResult.pass
    }

    static emoji(raw: unknown): string | null {

        // get text
        const text = new String(raw).slice(0, 50);

        const matches = text.match(
            /(\p{EBase}\p{EMod}+|\p{ExtPict}|\p{EComp}{2})(\u200d(\p{EBase}\p{EMod}+|\p{ExtPict}|\p{EComp}{2}))*/gu
        )

        /**
         * This regex is kinda complicated, but basically it is split into two groups.
         * Group 1 matches any emoji base followed by 1 or more emoji modifiers, OR an emoji
         * that is alone, OR two emoji components (a flag emoji)
         * Group two matches any zero-width joiner (used to make emojis like 👨‍👩‍👧‍👦) that is followed
         * by something that matches group 1
         * Basically the regex matches a group 1 followed by zero or more group 2s, so it
         * turns a string like "example text 😡👨‍👩🏻‍👧‍👦🧔🏻‍♂️" into ["😡", "👨‍👩🏻‍👧‍👦", "🧔🏻‍♂️"]
         * 
         * This regex took like 2 hours to make lol, stack overflow was useless for once
         * @see https://unicode.org/reports/tr51/proposed.html#Emoji_Properties_and_Data_Files
         * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Unicode_character_class_escape
         * also this site is very useful https://regexr.com/
         */

        if (!matches)
            return null;

        return matches[0]

    }


}