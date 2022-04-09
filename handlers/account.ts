import { reqHandlerFunction } from "."
import authUser, { resetUserAuth } from "../modules/userAuth"
import { Users } from '../modules/users';
import * as fs from 'fs'
import Bots from "../modules/bots";

export const logout: reqHandlerFunction = (req, res) => {
    res.clearCookie('pass')
    res.clearCookie('email')
    res.send("Logged out")
}

export const updateProfilePicture: reqHandlerFunction = (req, res) => {
    const data = authUser.full(req.headers.cookie)
    if (typeof data !== 'object') {
        res.status(401).send('You are not authorized');
        return;
    }

    Users.updateUser(data.id, {
        name: data.name,
        id: data.id,
        email: data.email,
        img: req.body.link
    })

    res.redirect('/account')
}

export const changePassword: reqHandlerFunction = (req, res) => {
    const data = authUser.full(req.headers.cookie)

    if (typeof data !== 'object') {
        res.status(401).send('You are not authorized');
        return;
    }

    const passwordCorrect = authUser.bool(data.email, req.body.password);

    if (typeof passwordCorrect !== 'object') {
        res.status(401).send('Incorrect password');
        return;
    }

    resetUserAuth(data.email);

    res.redirect('/');

}

export const bots: reqHandlerFunction = (req, res) => {
    const bots = Bots.botData

    let response = fs.readFileSync('pages/bots/index.html', 'utf-8');

    for (const bot of bots) {
        response += `<tr>`
        response += `<td>${bot.name}</td>`
        response += `<td><img src="${bot.image}" width="100px" height="100px"></td>`
        response += `<td>${bot.type}</td>`
        response += `<td>${bot.commands ? bot.commands.join(', ') : 'N/A'}</td>`
        response += `<td>${bot.desc}</td>`
        response += `</tr>`
    }

    response += `</table>`

    res.send(response)

}

export const me: reqHandlerFunction = (req, res) => {
    const data = authUser.bool(req.headers.cookie);
    if (typeof data !== 'boolean')
        res.json(data)
    else
        res.status(401).send('You are not authorized') // should never happen
}