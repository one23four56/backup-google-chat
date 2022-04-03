/**
 * @module autoMod
 * @version 1.3: add mutes and new anti-spam
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
    slowSpam = "You are sending too much messages!",
    muted = "You are muted for spamming.",
}

const prev_messages = {}
const warnings = {}
let messagesPerMinute = {}
let mutes = []

setInterval(() => messagesPerMinute = {}, 60000)

/**
 * Determines whether text can be used or not
 * @param {string} text Text to check
 * @param {number?} charLimit Character limit for text
 * @returns {autoModResult} Result of the check
 * @since autoMod version 1.1
 */
export function autoModText(rawText: string, charLimit: number = 100): autoModResult {
    const text = new String(rawText)
    if (text === '') return autoModResult.short
    if (text.length > charLimit) return autoModResult.long

    return autoModResult.pass
}
/**
 * Determines whether a message can be sent or not
 * @param {Message} msg The message to check
 * @returns {autoModResult} Result of the check
 * @since autoMod version 1.0
 */
export function autoMod(msg: Message): autoModResult {

    if (msg.isWebhook) 
        msg.author.name = msg.sentBy

    if (!warnings[msg.author.name]) 
        warnings[msg.author.name] = 0
    
    if (mutes.includes(msg.author.name))
        return autoModResult.muted

    if (!prev_messages[msg.author.name]) { 
        prev_messages[msg.author.name] = msg; 
        return autoModResult.pass 
    }
    if (prev_messages[msg.author.name].text.trim() === msg.text.trim()) 
        return autoModResult.same

    if (!(Date.parse(msg.time.toString()) - Date.parse(prev_messages[msg.author.name].time.toString()) > 200) && warnings[msg.author.name] <= 3) { 
        warnings[msg.author.name]++; 
        return autoModResult.spam 
    
    }

    if (!(Date.parse(msg.time.toString()) - Date.parse(prev_messages[msg.author.name].time.toString()) > 200) && warnings[msg.author.name] > 3) { 
        delete warnings[msg.author.name]; 
        return autoModResult.kick 
    }

    if (autoModText(msg.text) !== autoModResult.pass) 
        return autoModText(msg.text)

    if (messagesPerMinute[msg.author.name] && messagesPerMinute[msg.author.name] > 7 && warnings[msg.author.name] <= 3) {
        warnings[msg.author.name]++; 
        return autoModResult.slowSpam
    }

    if (messagesPerMinute[msg.author.name] && messagesPerMinute[msg.author.name] > 7 && warnings[msg.author.name] > 3) {
        delete warnings[msg.author.name];
        return autoModResult.kick 
    }

    prev_messages[msg.author.name] = msg

    if (messagesPerMinute[msg.author.name])
        messagesPerMinute[msg.author.name] += 1
    else 
        messagesPerMinute[msg.author.name] = 1

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