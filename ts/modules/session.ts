/**
 * @module session
 * @version 1.2: add pings
 * 1.1: gave session its own class
 * 1.0: created
 */
import * as crypto from 'crypto';
import { Socket } from 'socket.io';
import { OnlineStatus, OnlineUserData, UserData } from "../lib/authdata";
import { ClientToServerEvents, ServerToClientEvents } from '../lib/socket';
import { rooms } from './rooms';
import { Users } from './users';
import get from './data';


const sessionLog = get<Record<string, Record<number, number>>>('data/sessions.json');

for (const userId in sessionLog.ref)
    for (const startTime in sessionLog.ref[userId])
        if (typeof sessionLog.ref[userId][startTime] !== "number")
            sessionLog.ref[userId][startTime] = Date.now();


/**
 * @classdesc Manages user sessions
 * @since session version 1.0
 */
export default class SessionManager {
    sessions: Session[];

    /**
     * Creates a new session manager.
     * @since session version 1.0
     */
    constructor() {
        this.sessions = [];
    }
    /**
     * Registers a session
     * @param {Session} session Session to register
     * @since session version 1.0
     */
    register(session: Session) {
        session.managers.push(this)
        this.sessions.push(session)
    }

    /**
     * Gets a session
     * @param {string} id Id of session to find
     * @returns {Session} The session (if found)
     * @since session version 1.0
     */
    get(id: string) {
        return this.sessions.find(value => value.sessionId === id);
    }

    /**
     * Gets a session
     * @param {string} id User ID of the user who's session to get
     * @returns {Session|undefined} The session (if found)
     * @since session version 1.2
     */
    getByUserID(id: string): Session | undefined {
        return this.sessions.find(value => value.userData.id === id) || undefined;
    }

    /**
     * Removes a session
     * @param {string} id Removes a session with this id
     * @since session version 1.0
     */
    deregister(id: string) {
        this.sessions = this.sessions.filter(value => value.sessionId !== id);
    }

    /**
     * Removes duplicates from a UserData array
     * @param {UserData[]} array Removes duplicates from this array
     * @returns {UserData[]} The array with duplicates removed
     * @since session version 1.0
     */
    static removeDuplicates<Type extends UserData>(array: Type[]): Type[] {
        return array
            .filter((value, index, array) => index === array.findIndex(item => item.id === value.id))
    }

    /**
     * Gets a list of everyone online
     * @returns {OnlineUserData[]} A UserData array containing everyone online
     * @since session version 1.0
     */
    getOnlineList(): OnlineUserData[] {

        return SessionManager.removeDuplicates(
            this.sessions.map(s => {
                return {
                    ...s.userData,
                    online: s.onlineState
                }
            })
        );
    }

    get online(): number {
        return this.sessions.length;
    }
}

/**
 * @classdesc A user session
 * @since session version 1.1
 */
export class Session {
    socket: Socket<ClientToServerEvents, ServerToClientEvents>;
    private userId: string;
    sessionId: string;
    managers: SessionManager[] = [];
    onlineState: OnlineStatus = OnlineStatus.online;
    readonly startTime: number;

    /**
     * Creates a new session
     * @param {UserData} data UserData of user to create the session for
     * @since session version 1.1
     */
    constructor(data: UserData, socket: Socket) {
        const id = crypto.randomBytes(3 ** 4).toString("base64");
        this.sessionId = id;
        this.userId = data.id;

        if (!sessionLog.ref[this.userId])
            sessionLog.ref[this.userId] = {};

        this.startTime = Date.now();
        sessionLog.ref[this.userId][this.startTime] = Infinity;

        this.socket = socket;
        socket.emit("id", this.sessionId);

        socket.once("disconnect", () => {
            sessionLog.ref[this.userId][this.startTime] = Date.now();
        })
    }

    /**
     * Sessions's user data
     */
    get userData(): UserData {
        return Users.get(this.userId)
    }

    /**
     * Disconnects the session
     * @param {string?} reason (optional) Reason to be sent to user
     * @since session version 1.1
     */
    disconnect(reason?: string) {
        if (!this.socket) return;
        this.socket.emit("forced to disconnect", reason)
        this.socket.disconnect(true);
        this.managers.forEach(manager => manager.deregister(this.sessionId));
    }

    /**
     * Sends an alert to the client. Shorthand for `session.socket.emit("alert")`
     * @param title Alert title
     * @param content Alert content
     */
    alert(title: string, content: string) {
        this.socket.emit("alert", title, content);
    }
}


type EmitToSetup = {
    userId: string,
    manager: SessionManager
}

// thank god for this stack overflow answer https://stackoverflow.com/a/68352232/
// really saved me here
type EmitToArg = {
    // V -- this makes a big interface w/ all server to client events in the format required
    [Ev in keyof ServerToClientEvents]: {
        event: Ev,
        args: Parameters<ServerToClientEvents[Ev]>
    }
}[keyof ServerToClientEvents]
// ^ -- this turns that interface into one big union type

/**
 * 
 * @param setup an object with the following:
 * - the event will be sent to everyone who shares a room with user id
 * - session manager to use
 * @param args any number of events to send in the {@link EmitToArg} format
 */
export function emitToRoomsWith(setup: EmitToSetup, ...args: EmitToArg[]) {

    const { userId, manager } = setup

    const dms = Object.values(rooms.ref) // get rooms
        .filter(r => r.members.includes(userId)) // filter out other rooms

    for (const session of manager.sessions)
        dms.find(r => r.members.includes(session.userData.id)) &&
            args.forEach(
                arg => session.socket.emit(arg.event, ...arg.args)
            )

}

export function getSessionTimes(userId: string): [number, number][] {
    const times = sessionLog.ref[userId];
    if (!times) return [];

    return Object.entries(sessionLog.ref[userId])
        .map(([s, e]) => [Number(s), e]);
}