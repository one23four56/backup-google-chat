/**
 * @module autoMod
 * @version 1.4: fix mutes, add isMuted
 * 1.3: add mutes and new anti-spam
 * 1.2: minor refactor & fix security vulnerability
 * 1.1: added autoModText
 * 1.0: created
 */

import Message from '../lib/msg';
import { Archive } from './archive';
import { sendMessage } from './functions';

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

const prev_messages = {}
const warnings = {}
let messages: Messages = {}
let lastMessages: Messages = {}
let mutes = []
let slowDownList: string[] = []

interface Messages {
    [key: string]: number
}

setInterval(() => {
    for (const name in lastMessages) {
        if (lastMessages[name] === messages[name] && lastMessages[name] > 1) {
            slowDownList.push(name)
            setTimeout(() => {
                slowDownList = slowDownList.filter(x => x !== name)
            }, 10000);
        }
    }

    lastMessages = messages
    messages = {}

}, 5000)

/**
 * Determines whether text can be used or not
 * @param {string} text Text to check
 * @param {number?} charLimit Character limit for text
 * @returns {autoModResult} Result of the check
 * @since autoMod version 1.1
 */
export function autoModText(rawText: string, charLimit: number = 100): autoModResult {
    const text = new String(rawText)
    if (text.trim() === '') return autoModResult.short
    if (text.length > charLimit) return autoModResult.long

    return autoModResult.pass
}
/**
 * Determines whether a message can be sent or not
 * @param {Message} msg The message to check
 * @param {boolean?} strict If true, warnings cap decreased and min wait time increased (default: false) 
 * @returns {autoModResult} Result of the check
 * @since autoMod version 1.0
 */
export function autoMod(msg: Message, strict = false): autoModResult {

    const warningsMax = strict? 2 : 3;
    const minWaitTime = strict? 400 : 200

    const name = msg.isWebhook? msg.sentBy : msg.author.name

    if (!warnings[name]) 
        warnings[name] = 0
    
    if (mutes.includes(name))
        return autoModResult.muted

    if (autoModText(msg.text) !== autoModResult.pass) {
        if (!msg.image)
            return autoModText(msg.text)
        else if (msg.image && autoModText(msg.text) !== autoModResult.short)
            return autoModText(msg.text)
        // if there is an image and the automod result is short, still send it
    } 

    if (!prev_messages[name]) { 
        prev_messages[name] = msg; 
        return autoModResult.pass 
    }
    if (prev_messages[name].text.trim() === msg.text.trim()) 
        return autoModResult.same

    if (!(Date.parse(msg.time.toString()) - Date.parse(prev_messages[name].time.toString()) > minWaitTime) && warnings[name] <= warningsMax) { 
        warnings[name]++; 
        return autoModResult.spam 
    
    }

    if (!(Date.parse(msg.time.toString()) - Date.parse(prev_messages[name].time.toString()) > minWaitTime) && warnings[name] > warningsMax) { 
        delete warnings[name]; 
        return autoModResult.kick 
    }

    if (slowDownList.includes(name) && warnings[name] <= warningsMax + 1) {
        warnings[name]++; 
        return autoModResult.slowSpam
    }

    if (slowDownList.includes(name) && warnings[name] > warningsMax + 1) {
        delete warnings[name];
        return autoModResult.kick 
    }

    prev_messages[name] = msg

    if (messages[name])
        messages[name] += 1
    else 
        messages[name] = 1

    return autoModResult.pass
}

/**
 * Mutes a user
 * @param {string} name Name of user to mute
 * @param {number} time Time to mute user for (in ms)
 * @since autoMod version 1.3
 */
export function mute(name: string, time: number) {
    mutes.push(name)

    setTimeout(() => {
        mutes = mutes.filter(m => m !== name)

        const msg: Message = {
            text:
                `${name} has been unmuted. Please avoid spamming in the future.`,
            author: {
                name: "Auto Moderator",
                img:
                    "https://jason-mayer.com/hosted/mod.png",
            },
            time: new Date(new Date().toUTCString()),
            tag: {
                text: 'BOT',
                color: 'white',
                bg_color: 'black'
            }
        }
        sendMessage(msg);
        Archive.addMessage(msg);

    }, time)
}

/**
 * Checks if a user is muted
 * @param {string} name Name of user to check 
 * @returns {boolean} Whether or not the user is muted
 * @since autoMod version 1.4
 */
export function isMuted(name: string): boolean {
    return mutes.includes(name)
}