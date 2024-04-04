import type { Socket } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '../../lib/socket';

export type HandlerSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// |||                              |||
// ||| -- function exports below -- |||
// VVV                              VVV

export * from './message'
export * from './webhooks'
export * from './rooms'
export * from './poll'
export * from './users'
export * from './invites'
export * from './dms'
export * from './statuses'
export * from './settings'
export * from './notification'