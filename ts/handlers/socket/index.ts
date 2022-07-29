import { Socket } from 'socket.io'
import { ClientToServerEvents, ServerToClientEvents } from '../../lib/socket';
export type HandlerSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
export { 
    generateMessageHandler, 
    generateEditHandler, 
    generateDeleteHandler, 
    generateStartTypingHandler, 
    generateStopTypingHandler,
    generateReactionHandler
} from './message'
export { 
    generateGetWebhooksHandler,
    generateAddWebhookHandler,
    generateEditWebhookHandler,
    generateDeleteWebhookHandler
} from './webhooks'
export { generateGetMessagesHandler } from './rooms'
export { generateVoteInPollHandler } from './poll'