/**
 * @module autoMod
 * @version 1.2: minor refactor & fix security vulnerability
 * 1.1: added autoModText
 * 1.0: created
 */

import Message from '../lib/msg';

export enum autoModResult {
    same = "You cannot send the same message twice in a row.",
    spam = "You are sending messages too quickly! Slow down!",
    kick = "You have been kicked for spamming.",
    pass = "Message approved",
    long = "Text is too long!",
    short = "Text is too short!"
}

const prev_messages = {}
const warnings = {}

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
    if (!warnings[msg.author.name]) warnings[msg.author.name] = 0
    if (!prev_messages[msg.author.name]) { prev_messages[msg.author.name] = msg; return autoModResult.pass }
    if (prev_messages[msg.author.name].text.trim() === msg.text.trim()) return autoModResult.same
    if (!(Date.parse(msg.time.toString()) - Date.parse(prev_messages[msg.author.name].time.toString()) > 200) && warnings[msg.author.name] <= 5) { warnings[msg.author.name]++; return autoModResult.spam }
    if (!(Date.parse(msg.time.toString()) - Date.parse(prev_messages[msg.author.name].time.toString()) > 200) && warnings[msg.author.name] > 5) { delete warnings[msg.author.name]; return autoModResult.kick }
    if (autoModText(msg.text) !== autoModResult.pass) return autoModText(msg.text)

    prev_messages[msg.author.name] = msg
    return autoModResult.pass
}