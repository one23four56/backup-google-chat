import * as fs from 'fs';
import * as path from 'path';
//------------------------------------------------
import { OTT, factors, tokens } from '../../modules/userAuth'
import { Users } from '../../modules/users';
import { reqHandlerFunction } from '.';
import { sendEmail, sessions, transporter } from '../..'
import { parse } from '../../modules/parser';

const EMAIL_PAGE = fs.readFileSync("pages/login/email.html", "utf-8");

export const getEmailHandler: reqHandlerFunction = async (req, res) => {
    const ip = parse.ip(req.ip);

    if (attempts[ip] && attempts[ip] >= (bad.has(ip) ? 2 : 5))
        return res.redirect("https://www.youtube.com/watch?v=caq8XpjAswo");

    const code = OTT.generate(ip, "check-email");
    const page = EMAIL_PAGE.replace("{{code}}", code);

    res.send(page);
}

let attempts: Record<string, number> = {};
const bad: Set<string> = new Set();

setInterval(() => {
    for (const ip in attempts)
        if (attempts[ip] >= 5)
            bad.add(ip);

    attempts = {};
}, 2 * 60 * 1000);

export const checkEmailHandler: reqHandlerFunction = async (req, res) => {
    if (typeof req.body.email !== "string" || typeof req.body.code !== "string")
        return res.sendStatus(400);

    const email = String(req.body.email).toLowerCase();
    const ip = OTT.consume(String(req.body.code), "check-email");

    if (!ip) return res.redirect("/login/email/#error-timeout");
    if (ip !== parse.ip(req.ip)) return res.sendStatus(400);

    if (!attempts[ip]) attempts[ip] = 0;
    else if (attempts[ip] >= (bad.has(ip) ? 2 : 5))
        return res.redirect("https://www.youtube.com/watch?v=caq8XpjAswo");


    attempts[ip] += 1;

    if (Users.isWhiteListed(email)) {
        // user has account
        const userData = Users.getUserDataByEmail(email);

        if (factors.hasPassword(userData.id)) {
            const code = OTT.generate(userData.id, "user-id");
            let out = fs.readFileSync("pages/login/password.html", 'utf-8');

            out = out.replace(/{{code}}/g, code);
            res.send(out);
        } else {
            const code = OTT.generate(userData.id, "set-code", 6);
            const csrf = OTT.generate(code, "check-code");

            sendEmail({
                from: "Chat Email",
                to: userData.email,
                subject: "Verification Code",
                html: `Your eight-digit <b>password set confirmation</b> code is: <h2>${code}</h2>` +
                    `This email was generated because someone is attempting to set your password.<br>` +
                    `If you are not attempting to set your password, you don't need to take any action. ` +
                    `Without the code listed above, your password cannot be set.<br><br>This password set ` +
                    `request came from IP address <code>${parse.ip(req.ip)}</code><br><br>Generated at ${new Date().toUTCString()}`
            }).then(
                () => res.send(fs.readFileSync("pages/login/confirm.html", "utf-8")
                    .replace("{{code}}", csrf)
                )
            ).catch(() => res.redirect(303, "/login/email/#error-send"))
        }

    } else if (parse.email(email)) {
        const code = OTT.generate(email, "create-account", 6);
        const csrf = OTT.generate(code, "check-code");

        const err = await sendEmail({
            from: "Chat Email",
            to: email,
            subject: "Verification Code",
            html: `Your eight-digit <b>account creation</b> code is: <h2>${code}</h2>` +
                `This email was generated because someone is attempting to create an account using your email address.<br>` +
                `If this is not you, you don't need to take any action. ` +
                `Without the code listed above, no account can be created.<br><br>This account creation ` +
                `request came from IP address <code>${parse.ip(req.ip)}</code><br><br>Generated at ${new Date().toUTCString()}`
        }).catch(() => true);

        if (err) return res.redirect(303, "/login/email/#error-email");

        res.send(fs.readFileSync("pages/login/create.html", "utf-8")
            .replace("{{code}}", csrf)
        );

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
            `request came from IP address <code>${parse.ip}</code><br><br>Generated at ${new Date().toUTCString()}`,
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
    if (typeof req.body.code !== "string" || typeof req.body.csrf !== "string")
        return res.sendStatus(400);

    const csrf = OTT.consume(req.body.csrf, "check-code");
    if (!csrf || csrf !== req.body.code)
        return res.redirect(303, "/login/email#error-code");

    const userId = OTT.consume(req.body.code, "set-code");

    if (!userId)
        return res.redirect(303, "/login/email#error-code")

    const code = OTT.generate(userId, "set-password")

    let out = fs.readFileSync(path.join(__dirname, '../', 'pages', 'login', 'set.html'), 'utf-8');
    out = out.replace('{{set-code}}', code);

    res.send(out);

}

export const createHandler: reqHandlerFunction = async (req, res) => {
    if (typeof req.body.code !== "string" || typeof req.body.csrf !== "string")
        return res.sendStatus(400);

    const csrf = OTT.consume(req.body.csrf, "check-code");
    if (!csrf || csrf !== req.body.code)
        return res.redirect(303, "/login/email#error-code");

    const email = OTT.consume(req.body.code, "create-account");

    if (!email)
        return res.redirect(303, "/login/email#error-code");

    if (Users.isWhiteListed(email)) return res.sendStatus(400);

    const id = await Users.createAccount(email);
    if (!id) return res.sendStatus(500);

    const code = OTT.generate(id, "set-password")

    let out = fs.readFileSync(path.join(__dirname, '../', 'pages', 'login', 'set.html'), 'utf-8');
    out = out.replace('{{set-code}}', code);

    setTimeout(() => res.send(out), 2000); // makes it seem like it is doing something
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

    if (sessions.getByUserID(userId))
        sessions.getByUserID(userId).disconnect("Your password has changed. Please reload")

    res.redirect(303, "/")

}

export const getLogout: reqHandlerFunction = (req, res) => {
    const code = OTT.generate(req.userData.id, "logout");

    let out = fs.readFileSync(path.join(__dirname, '../', 'pages', 'login', 'logout.html'), 'utf-8');
    out = out.replace('{{code}}', code);

    res.send(out);
}

export const postLogout: reqHandlerFunction = (req, res) => {

    if (typeof req.body.code !== "string" || typeof req.cookies.token !== "string")
        return res.sendStatus(400);

    const userId = OTT.consume(req.body.code, "logout");

    if (!userId || userId !== req.userData.id)
        return res.sendStatus(400);

    tokens.remove(req.cookies.token, userId);
    res.clearCookie("token");

    if (sessions.getByUserID(userId))
        sessions.getByUserID(userId).disconnect("You have logged out")

    res.send("This device has been logged out. You can now close this tab.");

}

export const getSecureLogout: reqHandlerFunction = (req, res) => {
    const code = OTT.generate(req.userData.id, "secure-logout");

    let out = fs.readFileSync(path.join(__dirname, '../', 'pages', 'login', 'secureLogout.html'), 'utf-8');
    out = out.replace('{{code}}', code);

    res.send(out);
}

export const postSecureLogout: reqHandlerFunction = (req, res) => {
    if (typeof req.body.code !== "string" || typeof req.cookies.token !== "string" || typeof req.body.password !== "string")
        return res.sendStatus(400);

    const userId = OTT.consume(req.body.code, "secure-logout");

    if (!userId || userId !== req.userData.id)
        return res.sendStatus(400);

    if (!factors.checkPassword(userId, req.body.password))
        return res.redirect("/logout/secure/#error-password")

    tokens.clear(userId);
    res.clearCookie("token");

    if (sessions.getByUserID(userId))
        sessions.getByUserID(userId).disconnect("You have logged out")

    res.send("All devices have been logged out. You can now close this tab.")
}

export const getChangePassword: reqHandlerFunction = (req, res) => {
    const code = OTT.generate(req.userData.id, "change-password");

    let out = fs.readFileSync(path.join(__dirname, '../', 'pages', 'login', 'changePassword.html'), 'utf-8');
    out = out.replace('{{code}}', code);

    res.send(out);
}

export const postChangePassword: reqHandlerFunction = (req, res) => {
    if (typeof req.body.code !== "string" || typeof req.cookies.token !== "string" || typeof req.body.password !== "string")
        return res.sendStatus(400);

    const userId = OTT.consume(req.body.code, "change-password");

    if (!userId || userId !== req.userData.id)
        return res.sendStatus(400);

    if (!factors.checkPassword(userId, req.body.password))
        return res.redirect("/login/password/change/#error-password")

    const code = OTT.generate(userId, "set-password")

    let out = fs.readFileSync(path.join(__dirname, '../', 'pages', 'login', 'set.html'), 'utf-8');
    out = out.replace('{{set-code}}', code);

    res.send(out);
}