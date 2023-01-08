import { isBoolItem, SettingsMetaData } from '../../lib/settings';
import { ClientToServerEvents } from '../../lib/socket'
import { Session } from '../../modules/session'
import ServerSettings from '../../modules/settings';

export function genUpdateSettingHandler(session: Session) {
    const handler: ClientToServerEvents["update setting"] = (setting, value) => {

        // block malformed requests

        if (typeof setting !== "string" || typeof SettingsMetaData[setting] !== "object")
            return;

        const meta = SettingsMetaData[setting];

        if (
            (isBoolItem(meta) && typeof value !== "boolean") ||
            (!isBoolItem(meta) && typeof value !== "number")
        )
            return;

        if (!isBoolItem(meta) && (value < 0 || value >= meta.options.length))
            return;

        // update settings

        ServerSettings.setFor(session.userData.id, setting, value)
    }

    return handler;
}