import { ClientToServerEvents } from '../../lib/socket'
import { Session } from '../../modules/session'
import { Users, blockList } from '../../modules/users';
import { BotList, BotData } from '../../modules/bots';
import { sessions } from '../..';
import * as Invites from '../../modules/invites'


export function generateQueryUsersByNameHandler(session: Session) {
    const handler: ClientToServerEvents["query users by name"] = (name, includeBlocked, respond) => {

        // block malformed requests

        if (typeof name !== "string" || typeof respond !== "function")
            return;

        // query users and respond

        const query = Users.queryByName(name), blocklist = blockList(session.userData.id);

        respond(includeBlocked ? query : query.filter(u => !blocklist.mutualBlockExists(u.id)))

    }

    return handler;
}

export function generateQueryBotsHandler(session: Session) {
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

        for (const botData of BotList.getData()) {

            if (botData.private && !botData.private.includes(session.userData.id))
                continue;

            const botDispName: string = botData.name.slice(0, name.length)

            if (comparer.compare(botDispName, name) === 0) // 0 = they are the same, it is weird i know
                output.push(botData)

        }


        respond(output
            .sort((a, b) => comparer.compare(a.name, b.name))
            .sort((a, b) => b.roomCount - a.roomCount)
        );
    }

    return handler

}

export function generateBlockHandler(session: Session) {
    const handler: ClientToServerEvents["block"] = (blockUserId, block) => {

        if (typeof blockUserId !== "string" || typeof block !== "boolean")
            return;

        if (!Users.get(blockUserId) || session.userData.id === blockUserId)
            return;

        const list = blockList(session.userData.id);

        session.socket.emit("block", blockUserId, block, 0);
        const blockSession = sessions.getByUserID(blockUserId);
        if (blockSession) blockSession.socket.emit("block", session.userData.id, block, 1);

        if (!block)
            return list.unblock(blockUserId);

        list.block(blockUserId);

        const invites = [
            ...Invites.getInvitesFrom(session.userData.id).filter(i => i.to.id === blockUserId),
            ...Invites.getInvitesFrom(blockUserId).filter(i => i.to.id === session.userData.id),
        ].filter(i => (i as Invites.DMInviteFormat).type === "dm");

        console.log(`users: found ${invites.length} invites between ${session.userData.id} and ${blockUserId}`)

        invites.forEach(i => Invites.deleteInvite(i));
    }

    return handler;
}