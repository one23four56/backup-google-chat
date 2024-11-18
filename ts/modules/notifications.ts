import { sessions } from '..';
import { Notification, NotificationType, ProtoNotification, UpdateNotification } from '../lib/notifications';
import get from './data';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as Update from '../update.json';
import { Users } from './users';

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
        const session = sessions?.getByUserID(userId);
        if (session) session.socket.emit("notification", notification);

        console.log(`notifications: sent ${id} to ${userId}`);
    }

    return notification.id;

}

/**
 * Removes a notification from the inboxes of a set of users
 * @param userIds Users to remove notification from
 * @param id ID of notification
 * @param broadcast Whether or not broadcast this to clients and force remove it from inboxes (default: false)
 */
function remove(userIds: string[], id: string, broadcast: boolean = false) {
    for (const userId of userIds) {
        if (!notificationsData.ref[userId]) continue;

        notificationsData.ref[userId] = notificationsData.ref[userId].filter(n => n.id !== id);

        if (notificationsData.ref[userId].length === 0)
            delete notificationsData.ref[userId];

        console.log(`notifications: dismissed ${id} for ${userId}`);

        if (broadcast) {
            const session = sessions.getByUserID(userId);
            if (!session) continue;

            session.socket.emit("remove notification", id);
        }
    }
}

function getNotifications(userId: string): Notification[] {
    return notificationsData.ref[userId];
}

export const notifications = {
    send, remove,
    get: getNotifications
} 

// update notifications

const lastVersion = fs.existsSync("data/VERSION") ? 
    fs.readFileSync("data/VERSION", "utf-8") : false;

if (lastVersion !== Update.version.number) {
    fs.writeFileSync("data/VERSION", Update.version.number, "utf-8");
    notifications.send<UpdateNotification>(Users.all, {
        data: Update,
        type: NotificationType.update,
        id: Update.version.number,
        icon: {
            type: "icon",
            content: Update.icon
        },
        title: `${Update.version.name}${Update.version.patch !== 0 ? ` Patch ${Update.version.patch}` : ""} (v${Update.version.number}) released`
    });

    if (Update.lastVersion.delete) notifications.remove(Users.all, Update.lastVersion.id);
}