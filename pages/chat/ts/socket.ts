import type { Socket } from 'socket.io-client';
import { ServerToClientEvents } from '../../../ts/lib/socket';

const bindings: Record<string, Record<string, Function[]>> = {};
const events = new Set<string>();

// not even gonna pretend i know what this shit means 
// ---> https://stackoverflow.com/a/58765199/ <---
type OmitFirstArg<F> = F extends (x: any, ...args: infer P) => infer R ? (...args: P) => R : never;

/**
 * Binds an event listener to the socket
 * @param id Room ID
 * @param event Event to handle
 * @param handler Event handler
 */
function bind<ev extends keyof ServerToClientEvents>(id: string, event: ev, handler: OmitFirstArg<ServerToClientEvents[ev]>) {

    if (typeof bindings[id] === "undefined")
        bindings[id] = {};

    events.add(event);

    if (typeof bindings[id][event] === "undefined")
        bindings[id][event] = [];

    bindings[id][event].push(handler);

};

export function initializeWatchers(socket: Socket) {
    socket.onAny((event, roomId, ...args) => {

        if (!events.has(event)) return;

        const room = bindings[roomId];
        if (!room) return;

        if (!room[event]) return console.info(`Event "${event}" dropped for ${roomId}`);

        room[event].forEach(f => f(...args));

    });
}

/**
 * Removes all bindings for a room
 * @param id Room ID 
 */
function unbindAll(id: string) {
    delete bindings[id];
};

/**
 * Unbinds an event from a room
 * @param id Room ID
 * @param event Event
 */
function unbind(id: string, event: string) {
    if (!bindings[id]) return;
    delete bindings[id][event];
};

/**
 * Generates a socket binder for a channel
 * @param id Room ID
 * @returns Socket binder for a channel
 */
function binderFor(id: string): <ev extends keyof ServerToClientEvents>(event: ev, handler: OmitFirstArg<ServerToClientEvents[ev]>) => void {
    return (event, handler) => bind(id, event, handler);
};

export const roomSockets = {
    bind, binderFor, unbind, unbindAll
};