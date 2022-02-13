import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as nodemailer from 'nodemailer';
import * as path from 'path';
import * as cookie from 'cookie';
import { Socket } from 'socket.io';
import { users, app } from '..';
import { authUser, addUserAuth, resetUserAuth, getUserAuths, addDeviceId } from '../auth'
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

export const runSignIn = (email: string, callback, socket: Socket) => { //if this line is giving you an error, press ctrl+shift+p and run 'Typescript: Restart TS server'
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
                let username = users.names[email];
                if (isCorrect) respond("correct", {email: email, pass: data.password, name: username})
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
                    respond("sent")
                    socket.once("confirm-password-reset", (code, result)=>{
                        if (code !== confcode) {result("bad-code");return}
                        resetUserAuth(email)
                        result("password-reset")
                    })
                })
            }
        })
    }
}


let currentConfirmationCodes = {}
app.get("/2fa", (req, res) => {
    const conditional = (authUser.fromCookie.bool(req.headers.cookie) && !authUser.deviceId(req.headers.cookie))
    if (conditional) {
        const cookieObj = cookie.parse(req.headers.cookie)
        if (!currentConfirmationCodes[cookieObj.email]) {
            const confcode = crypto.randomBytes(32).toString('base64')
            console.log(confcode);
            const url = encodeURI(`${req.protocol}://${req.get('host')}/2fa/${confcode}`)
            transporter.sendMail({
                from: "Chat Email",
                to: cookieObj.email,
                subject: "Two-Factor Authentication",
                html: `You are receiving this email because someone attempted to log on to your account from a new device.<br><br>If this was you, click <a href="${url}">here</a> (${url}) to authenticate your device.<br><br>If this was not you, change your password <b>IMMEDIATELY</b> because someone knows it. You can change your password by logging out, entering your email, and clicking the 'Reset Password' button.`,
            }, err => {
                if (err) res.status(500).send("There was an error internally. Please contact me right away so I can fix this.")
                else {
                    currentConfirmationCodes[cookieObj.email] = confcode
                    res.sendFile(path.join(__dirname, "mini-pages/2fa.html"))
                }
            })
        } else res.sendFile(path.join(__dirname, "mini-pages/2fa.html"))
    }
    else res.redirect("/")
})

app.get('/2fa/:code', (req, res)=>{
    const conditional = (authUser.fromCookie.bool(req.headers.cookie) && !authUser.deviceId(req.headers.cookie))
    if (conditional) {
            const cookieObj = cookie.parse(req.headers.cookie)
            console.log(currentConfirmationCodes[cookieObj.email]);
            console.log(req.params.code === currentConfirmationCodes[cookieObj.email])
            if (req.params.code === currentConfirmationCodes[cookieObj.email]) {
                let username = users.names[cookieObj.email];
                res.cookie('name', username);

                delete currentConfirmationCodes[cookieObj.email]
                const deviceId = addDeviceId(cookieObj.email)
                res.cookie('deviceId', deviceId, {
                    maxAge: 30 * 24 * 60 * 60 * 1000,
                    secure: true, 
                    sameSite: 'lax',
                    httpOnly: true, 
                    path: '/',
                }).redirect("/")
            } else res.status(400).send("Bad Request")
    } else res.redirect("/")
})