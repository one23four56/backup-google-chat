import * as crypto from 'crypto';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as nodemailer from 'nodemailer';
import { users } from '.';
//--------------------------------------
dotenv.config();

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS,
    },
});

export const runSignIn = (msg, callback, socket) => {
    if (users.emails.includes(msg)) {
        const confcode = crypto.randomBytes(8).toString("hex").substr(0, 6);
        transporter.sendMail({
            from: "Chat Email",
            to: msg,
            subject: "Verification Code",
            text: `Your six-digit verification code is: ${confcode}`,
        }, (err) => {
            if (err) {callback("send_err");console.log(err)}
            else {
                callback("sent")
                socket.once("confirm-code", (code, respond) => {
                    if (code === confcode) {
                        let auths = JSON.parse(fs.readFileSync("auths.json", "utf-8"))
                        let mpid = crypto.randomBytes(4 ** 4).toString("base64");
                        let email = users.names[msg] ? msg : users.alt_emails[msg]
                        auths[email] = {
                            name: users.names[email],
                            mpid: mpid
                        }
                        fs.writeFileSync("auths.json", JSON.stringify(auths))
                        respond({
                            status: "auth_done",
                            data: {
                                name: users.names[email],
                                email: email,
                                mpid: mpid
                            }
                        })
                    } else respond({
                        status: "auth_failed"
                    })
                });
            }
        });
    } else {
        callback("bad_email")
    }
}