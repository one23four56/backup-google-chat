import { ClientToServerEvents } from '../../lib/socket';
import AutoMod, { autoModResult } from '../../modules/autoMod';
import { Session } from '../../modules/session'
import { Statuses } from "../../modules/users";

export function generateSetStatusHandler(session: Session) {
    const handler: ClientToServerEvents["status-set"] = ({ char, status }) => {

        // block malformed requests

        if (typeof char !== "string" || typeof status !== "string")
            return;
        
        // run automod checks

        if (AutoMod.autoModText(status, 50) !== autoModResult.pass || AutoMod.autoModText(char, 6) !== autoModResult.pass) 
            return session.socket.emit("alert", "Status Not Set", `The status text and/or emoji does not meet requirements`);

        // update status

        Statuses.set(session.userData.id, { char, status })

    }

    return handler;
}

export function generateResetStatusHandler(session: Session) {
    const handler: ClientToServerEvents["status-reset"] = () => {

        Statuses.set(session.userData.id) // resets status

    }

    return handler;
}