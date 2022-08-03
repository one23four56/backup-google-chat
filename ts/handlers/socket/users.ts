import { ClientToServerEvents } from '../../lib/socket'
import { Session } from '../../modules/session'
import { Users } from '../../modules/users';


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