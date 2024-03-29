import { sessions } from '..';
import { Notification, ProtoNotification } from '../lib/notifications';
import get from './data';
import * as crypto from 'crypto';

const notificationsData = get<Record<string, Notification[]>>("data/notifications.json");

/**
 * Sends a notification to a set of users
 * @param userIds User IDs to sent notification to
 * @param proto Proto notification
 * @returns Notification ID
 */
function send<type>(userIds: string[], proto: ProtoNotification<type>) {
    const id = proto.id ? proto.id : crypto.randomBytes(6).toString("hex");
    const notification = {
        time: Date.now(), id,
        ...proto
    };

    for (const userId of userIds) {
        if (!notificationsData.ref[userId])
            notificationsData.ref[userId] = [];

        notificationsData.ref[userId].push(notification);

        // send to user
        const session = sessions.getByUserID(userId);
        if (session) session.socket.emit("notification", notification);

        console.log(`notifications: sent ${id} to ${userId}`);
    }

    return notification.id;

}

/**
 * Removes a notification from the inboxes of a set of users
 * @param userIds Users to remove notification from
 * @param id ID of notification
 */
function remove(userIds: string[], id: string) {
    for (const userId of userIds) {
        if (!notificationsData.ref[userId]) continue;

        notificationsData.ref[userId] = notificationsData.ref[userId].filter(n => n.id !== id);

        if (notificationsData.ref[userId].length === 0)
            delete notificationsData.ref[userId];

        console.log(`notifications: dismissed ${id} for ${userId}`);
    }
}

function getNotifications(userId: string): Notification[] {
    return notificationsData.ref[userId];
}

export const notifications = {
    send, remove,
    get: getNotifications
} 