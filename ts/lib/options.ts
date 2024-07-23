import * as BotObjects from '../modules/bots/botsIndex';

type permission = "owner" | "anyone" | "poll";

export interface RoomOptions {
    /**
     * Controls whether or not webhooks are allowed in the room
     */
    webhooksAllowed: boolean;
    /**
     * Controls whether or not private webhooks are allowed
     */
    privateWebhooksAllowed: boolean;
    /**
     * Controls whether or not users can access the archive viewer for this room
     */
    archiveViewerAllowed: boolean;
    statsPageAllowed: boolean;
    mediaPageAllowed: boolean;
    /**
     * An array of all the bots allowed in the room
     */
    allowedBots: (keyof typeof BotObjects)[];
    /**
     * Automod settings
     */
    autoMod: {
        /**
         * Number controlling the automod strictness, higher = more strict
         */
        strictness: number;
        /**
         * Number of warnings automod will give out before a mute
         */
        warnings: number;
        /**
         * Whether or not to block slow spam
         */
        blockSlowSpam: boolean;
        /**
         * Mute duration
         */
        muteDuration: number;
        allowMutes: boolean;
        allowBlocking: boolean;
        blockDuplicates: boolean;
        canDeleteWebhooks: boolean;
    };
    /**
     * Room permissions
     */
    permissions: {
        /**
         * Controls who can invite people
         */
        invitePeople: permission;
        removePeople: permission;
        /**
         * Controls who can add/remove bots from the room
         */
        addBots: permission;
        kick: permission;
        mute: permission;
        editRules: permission;
        editName: permission;
        muteBots: permission;
    };
    /**
     * If true and the share size is above 500 mb, old files will be deleted to make way for new ones
     */
    autoDelete: boolean;
    /**
     * Max file upload size
     */
    maxFileSize: number;
    ownerDeleteAllMessages: boolean;

}

function validateOptions(options: RoomOptions) {

    for (const name in options.permissions) {

        const permission = options.permissions[name]

        if (permission !== "anyone" && permission !== "owner" && permission !== "poll")
            return false;

    }

    if (options.autoMod.strictness < 1 || options.autoMod.strictness > 5) return false;
    if (options.autoMod.warnings < 1 || options.autoMod.warnings > 5) return false;
    if (options.autoMod.muteDuration < 1 || options.autoMod.muteDuration > 10) return false;

    if (options.maxFileSize < 1 || options.maxFileSize > 10) return false;

    return true;

}

export function isRoomOptions(object: unknown): object is RoomOptions {

    if (typeof object !== "object") return false;

    const recursiveCheck = (item: object, check: object) => {

        for (const name in check) {

            if (typeof item[name] !== typeof check[name]) return false;

            if (Array.isArray(check[name]) !== Array.isArray(item[name])) return false;

            // arrays break it, so it has to ignore them
            if (typeof check[name] === "object" && !Array.isArray(check[name])) {
                if (recursiveCheck(item[name], check[name]) === false)
                    return false;
            }

        }

        return true;

    }

    // make sure all the required options are there
    if (recursiveCheck(object, defaultOptions) === false) return false;

    // make sure there are no extra options
    if (recursiveCheck(defaultOptions, object) === false) return false;

    // validate option inputs
    return validateOptions(object as RoomOptions)

}

export const defaultOptions: RoomOptions = {
    webhooksAllowed: false,
    privateWebhooksAllowed: false,
    archiveViewerAllowed: true,
    statsPageAllowed: true,
    mediaPageAllowed: true,
    allowedBots: [
        "ArchiveBot",
        "RandomBot",
    ],
    autoMod: {
        strictness: 3,
        warnings: 3,
        allowBlocking: true,
        allowMutes: true,
        blockDuplicates: true,
        blockSlowSpam: true,
        canDeleteWebhooks: true,
        muteDuration: 2
    },
    permissions: {
        invitePeople: "anyone",
        removePeople: "anyone",
        addBots: "owner",
        editName: "owner",
        editRules: "owner",
        kick: "owner",
        mute: "owner",
        muteBots: "owner"
    },
    autoDelete: true,
    maxFileSize: 5,
    ownerDeleteAllMessages: false
}

export const defaultDMOptions: RoomOptions = {
    allowedBots: [
        "ArchiveBot",
        "RandomBot",
    ],
    archiveViewerAllowed: false,
    statsPageAllowed: false,
    mediaPageAllowed: false,
    webhooksAllowed: false,
    privateWebhooksAllowed: false,
    autoMod: {
        strictness: 3,
        warnings: 3,
        allowBlocking: true,
        allowMutes: false,
        blockDuplicates: true,
        blockSlowSpam: true,
        canDeleteWebhooks: true,
        muteDuration: 2
    },
    permissions: { // all of these gotta be owner to block anyone from inviting anyone
        invitePeople: "owner",
        addBots: "owner",
        removePeople: "owner",
        editName: "owner",
        editRules: "owner",
        kick: "owner",
        mute: "owner",
        muteBots: "owner"
    },
    autoDelete: true,
    maxFileSize: 5,
    ownerDeleteAllMessages: false
}

export const optionsDisplay = (options: RoomOptions): SectionFormat[] => [
    {
        name: 'Pages',
        description: `Room pages offer a variety of different functionality. Specific pages can be enabled or disabled below.`,
        color: {
            accent: '#3b798d',
            text: 'white'
        },
        items: [
            {
                type: "boolean",
                boolean: options.archiveViewerAllowed,
                question: 'Enable archive page',
                description: "The archive page allows users to easily view and save large amounts of messages.",
                manipulator: (value, options) => options.archiveViewerAllowed = value,
            }, {
                type: "boolean",
                boolean: options.statsPageAllowed,
                question: "Enable stats page",
                description: "The stats page displays various statistics about the room.",
                manipulator: (v, o) => o.statsPageAllowed = v,
            }, {
                type: "boolean",
                boolean: options.mediaPageAllowed,
                question: "Enable media page",
                description: "The media page shows all the files that were shared in the room",
                manipulator: (v, o) => o.mediaPageAllowed = v,
            }
        ]
    },
    {
        name: 'Auto Moderator',
        description: `The Auto Moderator is a system that can help prevent spamming using a variety of methods that can be configured below.`,
        color: {
            accent: '#46d160',
            text: 'black'
        },
        items: [
            {
                type: "boolean",
                boolean: options.autoMod.allowBlocking,
                manipulator: (v, o) => o.autoMod.allowBlocking = v,
                question: "Detect and block spamming from people",
                children: [
                    {
                        type: "boolean",
                        boolean: true,
                        disabled: true,
                        manipulator: () => null,
                        question: "Block fast spam",
                        description: "Block spam messages that are sent quickly over a shorter period of time\nAlways enabled if spam detection is on"
                    },
                    {
                        type: "boolean",
                        boolean: options.autoMod.blockSlowSpam,
                        manipulator: (v, o) => o.autoMod.blockSlowSpam = v,
                        question: "Block slow spam",
                        description: "Block spam messages that are sent slowly over a longer period of time.\nThis causes the \"You are sending too many messages!\" message."
                    },
                    {
                        type: "number",
                        number: options.autoMod.strictness,
                        max: 5,
                        min: 1,
                        question: "Spam detection strictness",
                        description: "1 is the least strict, 5 is the most strict. Higher strictness means more messages will be flagged as spam.",
                        manipulator: (value, options) => options.autoMod.strictness = value,
                    },
                    {
                        type: "boolean",
                        boolean: options.autoMod.allowMutes,
                        manipulator: (v, o) => o.autoMod.allowMutes = v,
                        question: "Allow AutoMod to mute people who are spamming",
                        description: "If disabled, spam messages will still be blocked but warnings and mutes will not be issued.",
                        children: [
                            {
                                type: "number",
                                number: options.autoMod.warnings,
                                max: 5,
                                min: 1,
                                question: "Warnings before muting someone",
                                manipulator: (value, options) => options.autoMod.warnings = value,
                            },
                            {
                                type: "number",
                                number: options.autoMod.muteDuration,
                                max: 10,
                                min: 1,
                                manipulator: (v, o) => o.autoMod.muteDuration = v,
                                question: "Mute duration (minutes)"
                            }
                        ]
                    }
                ]
            },
            {
                type: "boolean",
                boolean: options.autoMod.blockDuplicates,
                manipulator: (v, o) => o.autoMod.blockDuplicates = v,
                question: "Block duplicate messages",
                description: "Block sending the same message twice in a row."
            },
            // {
            //     type: "boolean",
            //     boolean: options.autoMod.canDeleteWebhooks,
            //     manipulator: (v, o) => o.autoMod.canDeleteWebhooks = v,
            //     question: "Allow AutoMod to delete webhooks",
            //     description: "If enabled, AutoMod will delete spamming webhooks instead of temporarily disabling them."
            // }
        ]
    },
    {
        name: 'Permissions',
        description: `The following options control who can do what in the room.\n\nOwner allows only the room owner to complete the action\nAnyone allows anyone to do it\nPoll allows anyone to do it, but non-owners require the approval of a poll.\n`,
        color: {
            accent: '#cc33ff',
            text: 'white'
        },
        items: [
            {
                type: "permissionSelect",
                permission: options.permissions.editName,
                question: "Edit room name and emoji",
                manipulator: (v, o) => o.permissions.editName = v
            },
            {
                type: "permissionSelect",
                permission: options.permissions.editRules,
                question: "Add or remove room rules",
                manipulator: (v, o) => o.permissions.editRules = v
            },
            {
                type: "permissionSelect",
                permission: options.permissions.invitePeople,
                question: 'Invite people',
                manipulator: (value, options) => options.permissions.invitePeople = value
            },
            {
                type: 'permissionSelect',
                permission: options.permissions.removePeople,
                question: "Remove people",
                manipulator: (v, o) => o.permissions.removePeople = v,
            },
            {
                type: "permissionSelect",
                permission: options.permissions.mute,
                question: "Mute people",
                manipulator: (v, o) => o.permissions.mute = v
            },
            {
                type: "permissionSelect",
                permission: options.permissions.kick,
                question: "Kick people",
                manipulator: (v, o) => o.permissions.kick = v
            },
            {
                type: "permissionSelect",
                permission: options.permissions.addBots,
                question: "Add or remove bots",
                manipulator: (value, options) => options.permissions.addBots = value
            },
            {
                type: "permissionSelect",
                permission: options.permissions.muteBots,
                question: "Mute bots",
                manipulator: (v, o) => o.permissions.muteBots = v
            },
        ]
    },
    {
        name: `Mediashare`,
        description: `Mediashare is the system that allows files to be shared in rooms. Mediashare can store up to 500 MB of files per room.`,
        color: {
            accent: '#ff9933',
            text: 'black'
        },
        items: [
            {
                type: "boolean",
                boolean: options.autoDelete,
                question: `Enable auto-delete`,
                description: "Auto-delete automatically deletes old files when there is no space for new files. If disabled, files must be deleted manually.",
                manipulator: (value, options) => options.autoDelete = value
            },
            {
                type: "number",
                number: options.maxFileSize,
                question: "Max File Size (MB)",
                description: "Maximum allowed size of uploaded files. Files larger than this size cannot be uploaded.",
                manipulator: (v, o) => o.maxFileSize = v,
                max: 10,
                min: 1
            }
        ]
    },
    {
        name: "Miscellaneous",
        color: {accent: "#737373", text: "white"},
        description: "Options that do not fit into any other category",
        items: [
            {
                type: "boolean",
                boolean: options.ownerDeleteAllMessages,
                question: "Allow the room owner to delete other people's messages",
                manipulator: (v, o) => o.ownerDeleteAllMessages = v,
                description: "Note: this only applies to other people and bots. System/Info messages cannot be deleted."
            }
        ]
    }
];

// barely used types down here lol

export interface SectionFormat {
    description: string;
    name: string;
    color: {
        accent: string;
        text: string;
    }
    items: ItemFormat[];
}

export type Manipulator<dataType> = (value: dataType, RoomOptions: RoomOptions) => void;

export interface BaseItemFormat {
    question: string;
    description?: string;
    disabled?: true;
}

export interface TextFormat extends BaseItemFormat {
    type: "text"
}

export interface BooleanFormat extends BaseItemFormat {
    type: "boolean";
    boolean: boolean;
    manipulator: Manipulator<boolean>;
    children?: ItemFormat[];
}

export interface SelectFormat extends BaseItemFormat {
    type: "select";
    selected: string;
    options: string[];
    manipulator: Manipulator<string>;
}

export interface PermissionFormat extends BaseItemFormat {
    type: "permissionSelect";
    permission: "anyone" | "owner" | "poll";
    manipulator: Manipulator<"anyone" | "owner" | "poll">;
}

export interface NumberFormat extends BaseItemFormat {
    type: "number";
    number: number;
    min: number;
    max: number;
    manipulator: Manipulator<number>;
}

export type ItemFormat = NumberFormat | PermissionFormat | SelectFormat | BooleanFormat | TextFormat;

