import { ClientToServerEvents } from '../../lib/socket'
import { Session } from '../../modules/session'
import { Users } from '../../modules/users';
import { BotData } from '../../modules/bots';
import { allBots } from '../..';


export function generateQueryUsersByNameHandler(_session: Session) {
    // session is unused, that is intentional 

    // while this function doesn't need to be generated now, it may need to be later if a block
    // system is ever added, so this function is generated for future-proofing
    const handler: ClientToServerEvents["query users by name"] = (name, respond) => {

        // block malformed requests

        if (typeof name !== "string" || typeof respond !== "function")
            return;

        // query users and respond

        respond(Users.queryByName(name));

    }

    return handler;
}

export function generateQueryBotsHandler(_session: Session) {
    const handler: ClientToServerEvents["query bots by name"] = (name, respond) => {

        // block malformed requests

        if (typeof name !== "string" || typeof respond !== "function")
            return;

        // get bots
        // totally not copy and pasted from the query users by name function (don't even bother checking)

        const output: BotData[] = [];

        // complicated af, but it works better than ===
        const comparer = new Intl.Collator('en', {
            sensitivity: 'base', // sets it to case and accent insensitive
        })

        for (const botData of allBots.botData ) {

            const botDispName: string = botData.name.slice(0, name.length)

            if (comparer.compare(botDispName, name) === 0) // 0 = they are the same, it is weird i know
                output.push(botData)

        }


        respond(output.sort((a, b) => comparer.compare(a.name, b.name)));
    }

    return handler

}