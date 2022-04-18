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
        todayMessages: archive.filter(message => (Date.now() - Date.parse(message.time as any as string)) < (24 * 60 * 60 * 1000)).length,
        date: new Date().toUTCString(),
        messageRank: 0,
        adjustedRank: 0, 
        milestoneRank: 0, 
        todayRank: 0,
        likeRank: 0,
        dislikeRank: 0,
    }

    const leaderBoards = {
        main: {},
        adjusted: {},
        webhook: {},
        bot: {},
        milestone: {},
        today: {},
        likes: {},
        dislikes: {}
    }

    const leaderBoardLengths = {
        main: archive.length,
        adjusted: archive.length,
        webhook: archive.filter(message => message.isWebhook ? true : false).length,
        bot: archive.filter(message => message.tag?.bg_color === '#3366ff').length,
        milestone: archive.filter((_message, index) => ((index + 1) % 100 === 0)).length,
        today: archive.filter(message => (Date.now() - Date.parse(message.time as any as string)) < (24 * 60 * 60 * 1000)).length,
        likes: archive.filter(message => (message.reactions && message.reactions['👍'] && message.reactions['👍'].length > 0)).length,
        dislikes: archive.filter(message => (message.reactions && message.reactions['👎'] && message.reactions['👎'].length > 0)).length
    }

    const leaderBoardStrings: { [key: string]: string } = {}
    
    for (const message of archive) {
        if (leaderBoards.main[message.author.name] !== undefined) continue;

        leaderBoards.main[message.author.name] = 0
        leaderBoards.adjusted[message.author.name] = 0
        leaderBoards.webhook[message.author.name] = 0
        leaderBoards.bot[message.author.name] = 0
        leaderBoards.milestone[message.author.name] = 0
        leaderBoards.today[message.author.name] = 0
        leaderBoards.likes[message.author.name] = 0
        leaderBoards.dislikes[message.author.name] = 0
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

        if ((Date.now() - Date.parse(message.time as any as string)) < (24 * 60 * 60 * 1000))
            leaderBoards.today[message.author.name]++

        if (message.reactions && message.reactions['👍'] && message.reactions['👍'].length > 0)
            leaderBoards.likes[message.author.name] += message.reactions['👍'].length

        if (message.reactions && message.reactions['👎'] && message.reactions['👎'].length > 0)
            leaderBoards.dislikes[message.author.name] += message.reactions['👎'].length
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
            case 'today':
                stats.todayRank = sorted.indexOf(userData.name) + 1
                break;
            case 'likes':
                stats.likeRank = sorted.indexOf(userData.name) + 1
                break;
            case 'dislikes':
                stats.dislikeRank = sorted.indexOf(userData.name) + 1
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
    statsPage = statsPage.replace('<!--todayLeaderBoard-->', leaderBoardStrings.today)
    statsPage = statsPage.replace('<!--likesLeaderBoard-->', leaderBoardStrings.likes)
    statsPage = statsPage.replace('<!--dislikesLeaderBoard-->', leaderBoardStrings.dislikes)

    for (const stat in stats) 
        statsPage = statsPage.replace(`{${stat}}`, stats[stat].toString())

    res.send(statsPage)
}