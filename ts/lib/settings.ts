
interface RootItem {
    sub: string;
    category: SettingsCategory;
}

export enum SettingsCategory {
    display = "Appearance",
    notify = "Notifications",
    people = "People",
    misc = "Other",
}

interface MultiItem extends RootItem {
    options: string[]
}

interface BoolItem extends RootItem {
    description: string
}

export const DefaultSettings = {
    "sound-new-message": true,
    "sound-connection": true,
    "sound-on-send": false,
    "desktop-new-message": true,
    "theme": 0,
    "always-show-popups": false,
    "hide-webhooks": false,
    "image-display": 1,
    "animate-new-messages": false,
    "hide-blocked-statuses": true,
    "hide-blocked-chats": true,
    "show-offline-on-sidebar": true,
    "show-invites-on-sidebar": false,
    "site-style": 0,
    "animate-popups": false,
    "inactive-users": 1,
    "send-button": false,
    "notify-me-statuses": true,
    "notify-friends-statuses": true,
    "show-tips": true,
    "message-clip-length": 1,
    "user-card-show-actions": false
}

export const SettingsMetaData: SettingsMetaData = {
    "always-show-popups": {
        category: SettingsCategory.misc,
        sub: "Popups",
        description: "Always show initial popups"
    },
    "desktop-new-message": {
        sub: "Desktop Notifications",
        description: "Show a desktop notification when a new message is received",
        category: SettingsCategory.notify
    },
    "sound-connection": {
        category: SettingsCategory.notify,
        sub: "Sound",
        description: "Play a sound when someone connects"
    },
    "sound-new-message": {
        category: SettingsCategory.notify,
        sub: "Sound",
        description: "Play a sound when you receive a new message"
    },
    "sound-on-send": {
        category: SettingsCategory.notify,
        sub: "Sound",
        description: "Play a sound when you send a message"
    },
    theme: {
        category: SettingsCategory.display,
        sub: "Theme",
        options: [
            "Light",
            "Dark",
            "Ukraine"
        ]
    },
    "site-style": {
        category: SettingsCategory.display,
        sub: "Style",
        options: ["Bordered", "Borderless (beta)"]
    },
    "hide-webhooks": {
        category: SettingsCategory.misc,
        sub: "Webhooks",
        description: "Hide webhooks that you don't have access to"
    },
    "animate-new-messages": {
        category: SettingsCategory.display,
        sub: "Animation",
        description: "Animate new messages"
    },
    "animate-popups": {
        category: SettingsCategory.display,
        sub: "Animation",
        description: "Animate popups (beta)"
    },
    "image-display": {
        category: SettingsCategory.display,
        sub: "Attached Images",
        options: ["Scale down images to fit", "Crop images to fit"]
    },
    "hide-blocked-statuses": {
        category: SettingsCategory.people,
        sub: "Blocked Users",
        description: "Hide statuses and schedules of people you blocked"
    },
    "hide-blocked-chats": {
        category: SettingsCategory.people,
        sub: "Blocked Users",
        description: "Hide chats with people you blocked and people who blocked you"
    },
    "show-offline-on-sidebar": {
        category: SettingsCategory.people,
        sub: "Sidebar",
        description: "Show offline people on room sidebars"
    },
    "show-invites-on-sidebar": {
        category: SettingsCategory.people,
        sub: "Sidebar",
        description: "Show invited people on room sidebars"
    },
    "inactive-users": {
        category: SettingsCategory.people,
        sub: "Inactive User Effect",
        options: [
            "No effect",
            "Darken sidebar item",
            "Hide from sidebar"
        ]
    },
    "send-button" : {
        category: SettingsCategory.display,
        sub: "Accessibility",
        description: "Show a send button next to the message bar"
    },
    "notify-me-statuses": {
        category: SettingsCategory.notify,
        sub: "Statuses",
        description: "Notify you when one of your friends updates their status"
    },
    "notify-friends-statuses": {
        category: SettingsCategory.notify,
        sub: "Statuses",
        description: "Notify your friends when you update your status"
    },
    "show-tips": {
        category: SettingsCategory.misc,
        sub: "Tips",
        description: "Show tips on the home screen"
    },
    "message-clip-length": {
        category: SettingsCategory.display,
        sub: "Message Clipping",
        options: [
            "Clip after 5 lines",
            "Clip after 10 lines",
            "Don't clip messages"
        ]
    },
    "user-card-show-actions": {
        category: SettingsCategory.people,
        sub: "Profile Room Actions",
        description: "Show room member actions (remove/mute/kick) in user profiles"
    }
}

type SettingsMetaData = {
    [id in keyof typeof DefaultSettings]: typeof DefaultSettings[id] extends Boolean ?
    BoolItem : MultiItem
}

export function isBoolItem(obj: unknown): obj is BoolItem {
    return typeof obj["description"] === "string";
}