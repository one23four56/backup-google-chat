import { sessions } from '../..';
import { isOnlineStatus, OnlineStatus } from '../../lib/authdata';
import { ClientToServerEvents } from '../../lib/socket';
import AutoMod, { autoModResult } from '../../modules/autoMod';
import { emitToRoomsWith, Session } from '../../modules/session'
import { Schedules, Statuses } from "../../modules/users";

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


export function generateSetScheduleHandler(session: Session) {
    const handler: ClientToServerEvents["set schedule"] = (schedule) => {

        // block malformed requests
        if (typeof schedule !== "object" || !Array.isArray(schedule) || schedule.length !== 7)
            return;

        // run automod checks
        for (const item of schedule) {
            if (typeof item !== "string" || AutoMod.autoModText(item, 20) !== autoModResult.pass)
                return;
        }

        // update schedule
        Schedules.set(session.userData.id, schedule);

    }

    return handler;
}

export function generateSetOnlineStateHandler(session: Session): ClientToServerEvents["set online state"] {
    return (status) => {

        if (!isOnlineStatus(status) || status === OnlineStatus.offline) 
            return;

        session.onlineState = status;

        emitToRoomsWith(
            { userId: session.userData.id, manager: sessions },
            { event: "online state change", args: [session.userData.id, status] }
        )

    }    
}