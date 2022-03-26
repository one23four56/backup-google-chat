/**
 * @module session
 * @version 1.1: gave session its own class
 * 1.0: created
 */
import * as crypto from 'crypto';
import { Socket } from 'socket.io';
import { UserData } from "../lib/authdata";

interface SessionData {
    userData: UserData;
    sessionId: string;
    socket?: Socket;
}

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
        session.manager = this;
        this.sessions.push(session)
    }

    /**
     * Gets a session
     * @param {string} id Id of session to find
     * @returns {Session} The session (if found)
     * @since session version 1.0
     */
    get(id: string) {
        for (const session of this.sessions) {
            if (session.sessionId = id) return session;
        }
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
    static removeDuplicates(array: UserData[]) {
        return array.filter((value, index, array) => index === array.findIndex(item => item.id === value.id))
    }

    /**
     * Gets a list of everyone online
     * @returns {UserData[]} A UserData array containing everyone online
     * @since session version 1.0
     */
    getOnlineList() {
        let list: UserData[] = [];
        for (const session of this.sessions) list.push(session.userData);
        list = SessionManager.removeDuplicates(list);
        return list;
    }
}

/**
 * @classdesc A user session
 * @since session version 1.1
 */
export class Session {
    socket: Socket;
    userData: UserData;
    sessionId: string;
    manager: SessionManager;

    /**
     * Creates a new session
     * @param {UserData} data UserData of user to create the session for
     * @since session version 1.1
     */
    constructor(data: UserData) {
        const id = crypto.randomBytes(3 ** 4).toString("base64");
        this.sessionId = id;
        this.userData = data;
    }

    /**
     * Binds a socket with a session
     * @param {Socket} socket Socket to bind
     * @since session version 1.1
     */
    bindSocket(socket: Socket) {
        this.socket = socket;
        socket.emit("id", this.sessionId)
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
        this.manager.deregister(this.sessionId)
    }
}