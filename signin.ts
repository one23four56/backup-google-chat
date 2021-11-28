import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as nodemailer from 'nodemailer';
import { Socket } from 'socket.io';
import { users } from '.';
import { authUser, addUserAuth, resetUserAuth, getUserAuths } from './auth'
//--------------------------------------
dotenv.config();
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS,
    },
});
//--------------------------------------

export const runSignIn = (email: string, callback, socket: Socket) => {
    const auths = getUserAuths()
    if (!users.emails.includes(email)) {callback("bad-email");return}
    if (!auths[email]) {
        callback("set-password")
        const confcode = crypto.randomBytes(6).toString('base64');
        transporter.sendMail({
            from: "Chat Email",
            to: email,
            subject: "Verification Code",
            html: `Your eight-digit <b>password set confirmation</b> code is: <h2>${confcode}</h2>If you did not generate this message, no action is required.`,
        }, err => {
            if (err) { callback("send-error"); return }
            socket.once("set-password", (data: { password: string, code: string }, respond) => {
                if (data.code!==confcode) {respond("bad-code");return}
                addUserAuth(email, users.names[email], data.password)
                respond("set-password", {
                    email: email, 
                    pass: data.password
                })
            })
        })
    } else {
        callback("give-password")
        socket.once("give-password", (data: { type: string, password: string}, respond)=>{
            if (data.type !== "reset") {
                const isCorrect = authUser.bool(email, data.password)
                if (isCorrect) respond("correct", {email: email, pass: data.password})
                else respond("incorrect")
            } else {
                const confcode = crypto.randomBytes(6).toString('base64');
                transporter.sendMail({
                    from: "Chat Email",
                    to: email,
                    subject: "Verification Code",
                    html: `Your eight-digit <b>password reset confirmation</b> code is: <h2>${confcode}</h2>If you did not generate this message, no action is required.`,
                }, err => {
                    if (err) { callback("send-error"); return }
                    socket.once("confirm-password-reset", (code, result)=>{
                        if (code !== result) {result("bad-code");return}
                        resetUserAuth(email)
                        result("password-reset")
                    })
                })
            }
        })
    }
}