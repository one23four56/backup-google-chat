const DEFAULT = "Backup Google Chat";

let notificationObject: Record<string, number> = {}, currentTitle;
const notifications = () => Object.values(notificationObject).reduce((p, c) => p + c, 0)

/**
 * Collection of functions for handling the page title
 */
export namespace title {

    /**
     * adds the current number of notifications to a string  
     * **not exported, internal use only**
     * @param string string to add notifications to
     * @returns notifications + string
     */
    function addNotificationsToString(string: string) {
        return notifications() === 0 ?
            string :
            notifications() <= 100 ?
                `(${notifications()}) ${string}` :
                `(100+) ${string}`
    }
    
    /**
     * Reset the page title
     */
    export function reset() {
        document.title = addNotificationsToString(DEFAULT);
        currentTitle = undefined;
    }

    /**
     * Sets the page title
     * @param title title to set to
     */
    export function set(title: string) {

        if (typeof title === "undefined")
            return reset(); // to avoid making the title (x)  - Backup Google Chat

        currentTitle = title;
        document.title = addNotificationsToString(`${title} - ${DEFAULT}`);
    }

    /**
     * sets a section of notifications to a specific number.  
     * all sections are added up to get the total number of notifications
     * @param section section to set
     * @param number number to set to
     */
    export function setNotifications(section: string, number: number) {
        notificationObject[section] = number;
        set(currentTitle) // add notifications to the current title
    }
    
}
