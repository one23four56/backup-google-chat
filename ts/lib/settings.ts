
interface RootItem {
    sub: string;
    category: SettingsCategory;
}

export enum SettingsCategory {
    notify = "Notifications",
    display = "Appearance",
    misc = "Other"
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
            "Light Mode",
            "Dark Mode",
            "Ukraine Mode"
        ]
    },
    "hide-webhooks": {
        category: SettingsCategory.misc,
        sub: "Webhooks",
        description: "Hide webhooks that you don't have access to"
    },
    "image-display": {
        category: SettingsCategory.display,
        sub: "Attached Images",
        options: ["Scale down images to fit", "Crop images to fit"]
    },
    "animate-new-messages": {
        category: SettingsCategory.display,
        sub: "Messages",
        description: "Slide and fade in new messages"
    }
}

type SettingsMetaData = {
    [id in keyof typeof DefaultSettings]: typeof DefaultSettings[id] extends Boolean ? 
        BoolItem : MultiItem
}

export function isBoolItem(obj: unknown): obj is BoolItem {
    return typeof obj["description"] === "string";
}