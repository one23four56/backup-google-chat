import { ClientToServerEvents } from "../../lib/socket";
import { notifications } from "../../modules/notifications";
import { Session } from "../../modules/session";

export function getNotificationsHandler(session: Session): ClientToServerEvents["get notifications"] {
    return respond => {
        if (typeof respond !== "function") return;
        respond(notifications.get(session.userData.id) ?? [])
    }
}

export function dismissNotificationHandler(session: Session): ClientToServerEvents["dismiss notification"] {
    return id => {
        if (typeof id !== "string") return;
        notifications.remove([session.userData.id], id);
    }
}