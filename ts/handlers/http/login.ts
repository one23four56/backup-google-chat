import * as fs from 'fs';
import * as path from 'path';
//------------------------------------------------
import { OTT, factors, tokens } from '../../modules/userAuth'
import { Users } from '../../modules/users';
import { reqHandlerFunction } from '.';
import { transporter } from '../..'

export const checkEmailHandler: reqHandlerFunction = (req, res) => {
    if (typeof req.body.email === "string" && Users.isWhiteListed(req.body.email)) {
        const userData = Users.getUserDataByEmail(req.body.email);

        if (factors.hasPassword(userData.id)) {
            const code = OTT.generate(userData.id, "user-id");
            let out = fs.readFileSync(path.join(__dirname, "../", "pages", "login", "password.html"), 'utf-8');

            out = out.replace(/{{code}}/g, code);
            res.send(out);
        } else {
            const code = OTT.generate(userData.id, "set-code", 6)

            transporter.sendMail({
                from: "Chat Email",
                to: userData.email,
                subject: "Verification Code",
                html: `Your eight-digit <b>password set confirmation</b> code is: <h2>${code}</h2>` +
                    `This email was generated because someone is attempting to set your password.<br>` +
                    `If you are not attempting to set your password, you don't need to take any action. ` +
                    `Without the code listed above, your password cannot be set.<br><br>This password set ` +
                    `request came from IP address <code>${req.ip}</code><br><br>Generated at ${new Date().toUTCString()}`
            }, err => {
                if (err) return res.sendStatus(500);

                res.sendFile(path.join(__dirname, '../', 'pages', 'login', 'confirm.html'));
            })
        }
    } else res.redirect(303, "/login/email/#error-email")
}

export const resetHandler: reqHandlerFunction = (req, res) => {

    if (typeof req.params.code !== "string")
        return res.sendStatus(400);

    const userId = OTT.consume(req.params.code, "user-id");

    if (!userId)
        return res.sendStatus(400);

    const code = OTT.generate(userId, "set-code", 6);

    transporter.sendMail({
        from: "Chat Email",
        to: Users.get(userId).email,
        subject: "Verification Code",
        html: `Your eight-digit <b>password reset confirmation</b> code is: <h2>${code}</h2>` +
            `This email was generated because someone is attempting to reset your password.<br>` +
            `If you are not attempting to reset your password, you don't need to take any action. ` +
            `Without the code listed above, your password cannot be reset.<br><br>This password reset ` +
            `request came from IP address <code>${req.ip}</code><br><br>Generated at ${new Date().toUTCString()}`,
    }, err => {
        if (err)
            return res.sendStatus(500)

        res.sendFile(path.join(__dirname, '../', "pages", "login", "confirm.html"))
    })

}

export const loginHandler: reqHandlerFunction = (req, res) => {

    if (typeof req.body.code !== "string")
        return res.redirect(303, "/login/email/#error");

    const userId = OTT.consume(req.body.code, "user-id");

    if (!userId)
        return res.redirect(303, "/login/email/#error");

    if (!factors.hasPassword(userId) || typeof req.body.password !== "string")
        return res.sendStatus(400);
    
    if (!factors.checkPassword(userId, req.body.password)) 
        return res.redirect(303, "/login/email/#error-password");

    // user has entered a valid password

    const token = tokens.create(userId, req.ip);

    res.cookie("token", token, {
        maxAge: 1000 * 60 * 60 * 24 * 30,
        secure: true,
        sameSite: 'strict',
        httpOnly: true,
    });

    res.redirect("/");
}

export const resetConfirmHandler: reqHandlerFunction = (req, res) => {
    if (typeof req.body.code !== "string")
        return res.sendStatus(400);

    const userId = OTT.consume(req.body.code, "set-code")

    if (!userId)
        return res.redirect(303, "/login/email#error-code")

    const code = OTT.generate(userId, "set-password")

    let out = fs.readFileSync(path.join(__dirname, '../', 'pages', 'login', 'set.html'), 'utf-8');
    out = out.replace('{{set-code}}', code);

    res.send(out);

}

export const setPassword: reqHandlerFunction = (req, res) => {

    const { conf, code, pass } = req.body;

    if (typeof pass !== "string" || typeof code !== "string" || typeof conf !== "string")
        return res.sendStatus(400);

    const userId = OTT.consume(code, "set-password")

    if (typeof userId !== "string")
        return res.sendStatus(400);

    if (pass !== conf)
        return res.sendStatus(400);

    if (pass.length < 8 || pass.length > 20)
        return res.sendStatus(400);

    // start of actual function

    factors.setPassword(userId, pass);
    tokens.clear(userId);

    const token = tokens.create(userId, req.ip);

    res.cookie("token", token, {
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
        secure: true,
        sameSite: "strict",
        httpOnly: true
    })

    res.redirect(303, "/")

}