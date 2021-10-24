import { Message } from './index'

export enum autoModResult {
    same = "You cannot send the same message twice in a row.",
    spam = "You are sending messages too quickly! Slow down!",
    kick = "You have been kicked for spamming.",
    pass = "Message approved"
}

let prev_messages = {}
let warnings = {}

/**
 * Determines whether a message can be sent or not
 * @param msg The message to check
 * @returns Result of the check
 */
export const autoMod: (msg: Message) => autoModResult = (msg: Message) => {
    if (!warnings[msg.author.name]) warnings[msg.author.name]=0
    if (!prev_messages[msg.author.name]) {prev_messages[msg.author.name]=msg;return autoModResult.pass}
    if (prev_messages[msg.author.name].text === msg.text) return autoModResult.same
    if (!(Date.parse(msg.time.toString())-Date.parse(prev_messages[msg.author.name].time.toString())>200)&&warnings[msg.author.name]<=5) {warnings[msg.author.name]++;return autoModResult.spam}
    if (!(Date.parse(msg.time.toString())-Date.parse(prev_messages[msg.author.name].time.toString())>200)&&warnings[msg.author.name]>5) {delete warnings[msg.author.name];return autoModResult.kick}

    prev_messages[msg.author.name] = msg
    return autoModResult.pass
}