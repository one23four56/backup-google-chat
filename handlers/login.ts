import { Request, Response } from 'express';
import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import * as crypto from 'crypto';
import * as path from 'path';
//------------------------------------------------
import authUser, { addUserAuth, getUserAuths, addDeviceId, resetUserAuth } from '../modules/userAuth'
import { Users } from '../modules/users';
//------------------------------------------------
dotenv.config();
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS,
    },
});
//------------------------------------------------


type handlerFunction = (req: Request, res: Response) => any;
let confirmationCodes = {}

export const checkEmailHandler: handlerFunction = (req, res) => {
    if (Users.isWhiteListed(req.body.email) && req.body.reset !== "true") {
        const auths = getUserAuths();
        res.cookie("email", req.body.email, {
            maxAge: 1000 * 60 * 60 * 24 * 30,
            secure: true,
            sameSite: "strict",
            httpOnly: true
        })
        if (auths[req.body.email]) res.sendFile(path.join(__dirname, "../", "pages", "login", "password.html"))
        else {
            const confcode = crypto.randomBytes(6).toString("base64")
            confirmationCodes[req.body.email] = confcode
            transporter.sendMail({
                from: "Chat Email",
                to: req.body.email,
                subject: "Verification Code",
                html: `Your eight-digit <b>password set confirmation</b> code is: <h2>${confcode}</h2>If you did not generate this message, no action is required.`,
            }, err => {
                if (!err) res.sendFile(path.join(__dirname, "../", "pages", "login", "create.html"))
                else res.send(500).send("An email was supposed to be sent to you, but the send failed. Please try again and contact me if this persists.")
            })
        }
    } else if (Users.isWhiteListed(req.body.email) && req.body.reset === "true") {
        const confcode = crypto.randomBytes(6).toString("base64")
        confirmationCodes[req.body.email] = confcode
        transporter.sendMail({
            from: "Chat Email",
            to: req.body.email,
            subject: "Verification Code",
            html: `Your eight-digit <b>password reset confirmation</b> code is: <h2>${confcode}</h2>If you did not generate this message, no action is required.`,
        }, err => {
            if (err) {res.status(500).send("There was an internal error");return}
            res.cookie("email", req.body.email, {
                maxAge: 1000 * 60 * 60 * 24 * 30,
                secure: true,
                sameSite: "strict",
                httpOnly: true
            })
            res.sendFile(path.join(__dirname, '../', "pages", "login", "reset.html"))
        })
    } 
    else res.status(401).send(`The email you entered is not whitelisted. Please check for typos and <a href="/login" >try again</a>. Make sure to use lowercase letters. If that does not work, contact me.`)
}

export const loginHandler: handlerFunction = (req, res) => {
    if (req.cookies.email && Users.isWhiteListed(req.cookies.email)) {
        if (authUser.bool(req.cookies.email, req.body.password)) {
            addUserAuth(req.cookies.email, Users.getUserDataByEmail(req.cookies.email).name, req.body.password)
            res.cookie("pass", req.body.password, {
                maxAge: 1000 * 60 * 60 * 24 * 30,
                secure: true,
                sameSite: "strict",
                httpOnly: true
            })
            res.redirect("/")
        } else res.status(401).send("Bad Password")
    } else res.status(401).send(`The email you entered is not whitelisted. Please check for typos and <a href="/login" >try again</a>. Make sure to use lowercase letters. If that does not work, contact me.`)
}

export const createAccountHandler: handlerFunction = (req, res) => {
    if (req.cookies.email && Users.isWhiteListed(req.cookies.email)) {
        if (req.body.code === confirmationCodes[req.cookies.email]) {
            addUserAuth(req.cookies.email, Users.getUserDataByEmail(req.cookies.email).name, req.body.password)
            res.cookie("pass", req.body.password, {
                maxAge: 1000 * 60 * 60 * 24 * 30,
                secure: true,
                sameSite: "strict",
                httpOnly: true
            })
            res.redirect("/")
        } else {
            delete confirmationCodes[req.cookies.email]
            res.status(401).send("The confirmation code you entered is not correct.")
        }
    } else res.status(401).send(`The email you entered is not whitelisted. Please check for typos and <a href="/login" >try again</a>. Make sure to use lowercase letters. If that does not work, contact me.`)
}

// export const twoFactorGetHandler: handlerFunction = (req, res) => {
//     const confcode = crypto.randomBytes(32).toString('base64')
//     const url = encodeURI(`${req.protocol}://${req.get('host')}/login/2fa/${confcode}`)
//     if (authUser.bool(req.headers.cookie) && !authUser.deviceId(req.headers.cookie)) {
//         transporter.sendMail({
//             from: "Chat Email",
//             to: req.cookies.email,
//             subject: "Two-Factor Authentication",
//             html: `You are receiving this email because someone attempted to log on to your account from a new device.<br><br>If this was you, click <a href="${url}">here</a> (${url}) to authenticate your device.<br><br>If this was not you, change your password <b>IMMEDIATELY</b> because someone knows it. You can change your password by logging out, entering your email, and clicking the 'Reset Password' button.`,
//         }, err => {
//             if (err) { res.status(500).send("There was an internal error"); return }
//             confirmationCodes[req.cookies.email] = confcode
//             res.sendFile(path.join(__dirname, "../", "pages", "login", "2fa.html"))
//         })
//     } else res.redirect("/")
// }

// export const twoFactorPostHandler: handlerFunction = (req, res) => {
//     console.log(2)
//     if (authUser.bool(req.headers.cookie) && !authUser.deviceId(req.headers.cookie)) {
//         console.log(3)
//         if (req.params.code === confirmationCodes[req.cookies.email]) {
//             console.log(4)
//             delete confirmationCodes[req.cookies.email]
//             const deviceId = addDeviceId(req.cookies.email)
//             res.cookie('deviceId', deviceId, {
//                 maxAge: 30 * 24 * 60 * 60 * 1000,
//                 secure: true,
//                 sameSite: 'lax',
//                 httpOnly: true,
//                 path: '/',
//             })
//             res.redirect("/")
//         } else res.redirect("/")
//     }
// }

export const resetConfirmHandler: handlerFunction = (req, res) => {
    if (req.cookies.email && confirmationCodes[req.cookies.email] === req.body.code) {
        resetUserAuth(req.cookies.email);
        res.redirect("/")
    } else res.status(400).send()
}