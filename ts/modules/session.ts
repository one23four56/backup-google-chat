/**
 * @module session
 * @version 1.2: add pings
 * 1.1: gave session its own class
 * 1.0: created
 */
import * as crypto from 'crypto';
import { Socket } from 'socket.io';
import { io } from '..';
import { UserData } from "../lib/authdata";
import { Statuses } from '../lib/users';
import * as json from './json';

interface SessionData {
    userData: UserData;
    sessionId: string;
    socket?: Socket;
}

export interface StatusUserData extends UserData {
    status: {
        char: string;
        status: string;
    },
    afk: boolean;
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
        return this.sessions.find(value => value.sessionId === id);
    }

    /**
     * Gets a session
     * @param {string} id User ID of the user who's session to get
     * @returns {Session|undefined} The session (if found)
     * @since session version 1.2
     */
    getByUserID(id: string): Session | void {
        return this.sessions.find(value => value.userData.id === id);
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
     * @returns {StatusUserData[]} A UserData array containing everyone online
     * @since session version 1.0
     */
    getOnlineList(): StatusUserData[] {
        let list: StatusUserData[] = [];
        const statuses: Statuses = json.read("statuses.json")

        for (const session of this.sessions) {
            const toAdd: StatusUserData = {
                name: session.userData.name, 
                email: session.userData.email,
                id: session.userData.id,
                img: session.userData.img,
                status: statuses[session.userData.id],
                afk: session.isAfk
            }
            list.push(toAdd)
        };

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
    private activePing: boolean = false;
    isAfk: boolean = false

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

    /**
     * Sends a ping to the session
     * @param {UserData} from UserData of user who sent the ping
     * @returns {boolean} Whether or not the ping was sent
     * @since sessions version 1.2
     */
    ping(from: UserData): boolean {
        if (!this.socket) return false;
        if (this.activePing) return false;
        // activePing is to prevent ping spamming
        this.activePing = true; 

        this.isAfk = true;
        io.emit("load data updated")

        this.socket.emit("ping", from.name, () => {
            setTimeout(() => {
                this.activePing = false;
                // immune from pings for 2 mins after responding
            }, 2 * 60 * 1000);

            this.isAfk = false;
            io.emit("load data updated")
            
            const startSession = this.manager.getByUserID(from.id)
            if (startSession)
                startSession.socket.emit("alert", "Ping Ponged", `${this.userData.name} has responded to your ping`)
        })

        return true;

    }
}