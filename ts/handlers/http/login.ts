import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
//------------------------------------------------
import authUser, { addUserAuth } from '../../modules/userAuth'
import { Users } from '../../modules/users';
import { reqHandlerFunction } from '.';
//------------------------------------------------
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS,
    },
});
//------------------------------------------------


let confirmationCodes = {}

export const checkEmailHandler: reqHandlerFunction = (req, res) => {
    if (req.body.email && Users.isWhiteListed(req.body.email)) {
        res.cookie("email", req.body.email, {
            maxAge: 1000 * 60 * 60 * 24 * 30,
            secure: true,
            sameSite: "strict",
            httpOnly: true
        })
        res.redirect("/login/password/")
        // else {
        //     const confcode = crypto.randomBytes(6).toString("base64")
        //     confirmationCodes[req.body.email] = confcode
        //     transporter.sendMail({
        //         from: "Chat Email",
        //         to: req.body.email,
        //         subject: "Verification Code",
        //         html: `Your eight-digit <b>password set confirmation</b> code is: <h2>${confcode}</h2>If you did not generate this message, no action is required.`,
        //     }, err => {
        //         if (!err) res.sendFile(path.join(__dirname, "../../../", "pages", "login", "create.html"))
        //         else res.send(500).send("An email was supposed to be sent to you, but the send failed. Please try again and contact me if this persists.")
        //     })
        // }
    } else res.redirect(303, "/login/email/#error")
}

export const resetHandler: reqHandlerFunction = (req, res) => {

    if (!Users.isWhiteListed(req.cookies.email))
        return res.sendStatus(400)

    const code = crypto.randomBytes(6).toString("base64");
    confirmationCodes[req.cookies.email] = code;

    transporter.sendMail({
        from: "Chat Email",
        to: req.cookies.email,
        subject: "Verification Code",
        html: `Your eight-digit <b>password reset confirmation</b> code is: <h2>${code}</h2>` + 
              `This email was generated because someone is attempting to reset your password.<br>` +
              `If you are not attempting to reset your password, you don't need to take any action. ` +
              `Without the code listed above, your password cannot be reset.<br><br>This password reset ` +
              `request came from IP address <code>${req.ip}</code><br><br>Generated at ${new Date().toUTCString()}`,
    }, err => {
        if (err)
            return res.sendStatus(500)

        res.sendFile(path.join(__dirname, '../../../', "pages", "login", "reset.html"))
    })

}

//  else if (Users.isWhiteListed(req.body.email) && req.body.reset === "true") {
//         const confcode = crypto.randomBytes(6).toString("base64")
//         confirmationCodes[req.body.email] = confcode

//     }

export const loginHandler: reqHandlerFunction = (req, res) => {
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
        } else res.redirect(303, "/login/password/#error")
    } else res.redirect(303, "/login/email/#error")
}

export const createAccountHandler: reqHandlerFunction = (req, res) => {
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

const setCodes: Record<string, string> = {}

export const resetConfirmHandler: reqHandlerFunction = (req, res) => {
    if (!req.cookies.email || confirmationCodes[req.cookies.email] !== req.body.code)
        return res.redirect(303, "/login/reset/#error")

    delete confirmationCodes[req.cookies.email];

    const code = crypto.randomBytes(16).toString("hex");
    setCodes[Users.getUserDataByEmail(req.cookies.email).id] = code;

    let out = fs.readFileSync(path.join(__dirname, '../../../', 'pages', 'login', 'set-reset.html'), 'utf-8');

    out = out.replace('{{set-code}}', code);

    res.send(out);

}

export const setPassword: reqHandlerFunction = (req, res) => {
    
    const { conf, code, pass } = req.body;

    if (typeof pass !== "string" || typeof code !== "string" || typeof conf !== "string")
        return res.sendStatus(400);

    const { email } = req.cookies;

    if (typeof email !== "string")
        return res.sendStatus(400);

    const user = Users.getUserDataByEmail(email);

    if (!user)
        return res.sendStatus(400);

    if (!setCodes[user.id] || setCodes[user.id] !== code)
        return res.sendStatus(401);

    if (pass !== conf)
        return res.sendStatus(400);

    if (pass.length < 8 || pass.length > 20)
        return res.sendStatus(400);

    // start of actual function

    delete setCodes[user.id];
    
    const hash = addUserAuth(email, user.name, pass);

    res.cookie("pass", hash, {
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
        secure: true, 
        sameSite: "strict",
        httpOnly: true
    })

    res.redirect(303, "/")

}