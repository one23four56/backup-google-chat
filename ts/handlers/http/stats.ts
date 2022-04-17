import { reqHandlerFunction } from ".";
import * as fs from 'fs'
import { Archive } from "../../modules/archive";
import authUser from "../../modules/userAuth";

export const generateStats: reqHandlerFunction = (req, res) => {
    const userData = authUser.full(req.headers.cookie);
    if (typeof userData === 'boolean') {
        res.status(401).send();
        return;
    }

    
    let statsPage: string = fs.readFileSync('pages/stats/index.html', 'utf8');
    const archive = Archive.getArchive()

    const stats = {
        messages: archive.length,
        size: (fs.statSync('messages.json').size / 1000000).toFixed(3),
        date: new Date().toUTCString(),
        messageRank: 0,
        adjustedRank: 0, 
        milestoneRank: 0, 
        imageRank: 0,
    }

    const leaderBoards = {
        main: {},
        adjusted: {},
        webhook: {},
        bot: {},
        milestone: {},
        image: {}
    }

    const leaderBoardLengths = {
        main: archive.length,
        adjusted: archive.length,
        webhook: archive.filter(message => message.isWebhook ? true : false).length,
        bot: archive.filter(message => message.tag?.bg_color === '#3366ff').length,
        milestone: archive.filter((_message, index) => ((index + 1) % 100 === 0)).length,
        image: archive.filter(message => message.image ? true : false).length
    }

    const leaderBoardStrings: { [key: string]: string } = {}
    
    for (const message of archive) {
        if (leaderBoards.main[message.author.name] !== undefined) continue;

        leaderBoards.main[message.author.name] = 0
        leaderBoards.adjusted[message.author.name] = 0
        leaderBoards.webhook[message.author.name] = 0
        leaderBoards.bot[message.author.name] = 0
        leaderBoards.milestone[message.author.name] = 0
        leaderBoards.image[message.author.name] = 0
    }

    for (const [index, message] of archive.entries()) {
        if (message.isWebhook) {
            leaderBoards.webhook[message.author.name]++
            leaderBoards.adjusted[message.author.name]++
            leaderBoards.main[message.sentBy]++
        } else {
            leaderBoards.main[message.author.name]++
            leaderBoards.adjusted[message.author.name]++

            if (message.tag?.bg_color === '#3366ff') 
                leaderBoards.bot[message.author.name]++
        }

        if ((index + 1) % 100 === 0)
            leaderBoards.milestone[message.author.name]++

        if (message.image)
            leaderBoards.image[message.author.name]++
    }

    for (const leaderBoardName in leaderBoards) {
        const leaderBoard = leaderBoards[leaderBoardName]

        const sorted = Object.keys(leaderBoard).sort((a, b) => leaderBoard[b] - leaderBoard[a])

        switch (leaderBoardName) {
            case 'main':
                stats.messageRank = sorted.indexOf(userData.name) + 1
                break;
            case 'adjusted':
                stats.adjustedRank = sorted.indexOf(userData.name) + 1
                break;
            case 'milestone':
                stats.milestoneRank = sorted.indexOf(userData.name) + 1
                break;
            case 'image':
                stats.imageRank = sorted.indexOf(userData.name) + 1
                break;
        }

        for (const [index, name] of sorted.entries()) {
            if (index > 9) 
                break;

            if (leaderBoardStrings[leaderBoardName] === undefined) 
                leaderBoardStrings[leaderBoardName] = ''

            if (leaderBoard[name] === 0) {
                leaderBoardStrings[leaderBoardName] += `<span class="item">`
                leaderBoardStrings[leaderBoardName] += `<p>${index + 1}. Nobody</p>`
                leaderBoardStrings[leaderBoardName] += `<p>${leaderBoard[name]} / ${((leaderBoard[name] / leaderBoardLengths[leaderBoardName]) * 100).toFixed(2)}%</p>`
                leaderBoardStrings[leaderBoardName] += `</span>`
                continue;
            }
            
            leaderBoardStrings[leaderBoardName] += `<span class="item">`
            leaderBoardStrings[leaderBoardName] += `<p>${index + 1}. ${name}</p>`
            leaderBoardStrings[leaderBoardName] += `<p>${leaderBoard[name]} / ${((leaderBoard[name] / leaderBoardLengths[leaderBoardName]) * 100).toFixed(2)}%</p>`
            leaderBoardStrings[leaderBoardName] += `</span>`
        }
    }

    statsPage = statsPage.replace('<!--mainLeaderBoard-->', leaderBoardStrings.main)
    statsPage = statsPage.replace('<!--adjustedLeaderBoard-->', leaderBoardStrings.adjusted)
    statsPage = statsPage.replace('<!--webhookLeaderBoard-->', leaderBoardStrings.webhook)
    statsPage = statsPage.replace('<!--botLeaderBoard-->', leaderBoardStrings.bot)
    statsPage = statsPage.replace('<!--milestoneLeaderBoard-->', leaderBoardStrings.milestone)
    statsPage = statsPage.replace('<!--imageLeaderBoard-->', leaderBoardStrings.image)

    for (const stat in stats) 
        statsPage = statsPage.replace(`{${stat}}`, stats[stat].toString())

    res.send(statsPage)
}