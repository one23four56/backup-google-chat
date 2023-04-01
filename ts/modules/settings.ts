import { DefaultSettings } from "../lib/settings";
import get from "./data";

export type PartialSettings = Partial<typeof DefaultSettings>

const data = get<Record<string, PartialSettings>>("data/settings.json").ref;

/**
 * Server-side settings functions
 */
namespace ServerSettings {
    /**
     * Gets a users settings  
     * **Note:** Only settings that are not equal to their defaults are returned.
     * To get all the settings even if they are defaults, use {@link getFor.full}
     * @param userId user id to get for
     * @returns a partial settings object with the users settings
     */
    export function getFor(userId: string): PartialSettings {
        return data[userId] || {}
    }

    /**
     * Gets all of a users settings, even if they are equal to their defaults.  
     * To get only the changed ones, use {@link getFor}
     * @param userId user id to get for
     * @returns the users settings
     */
    getFor.full = (userId: string): typeof DefaultSettings => {
        const settings = structuredClone(getFor(userId));

        for (const key in DefaultSettings)
            if (typeof settings[key] === "undefined")
                settings[key] = DefaultSettings[key]

        return settings as typeof DefaultSettings;
    }

    /**
     * sets a setting for the user
     * @param userId user id to set for
     * @param setting setting to set
     * @param value value to set the setting to
     */
    export function setFor<key extends keyof typeof DefaultSettings>
        (userId: string, setting: key, value: typeof DefaultSettings[key]): void {

        if (!data[userId])
            data[userId] = {}

        if (value === DefaultSettings[setting])
            delete data[userId][setting]
        else
            data[userId][setting] = value;

    }
}

export default ServerSettings;