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
export { 
    generateGetMessagesHandler,
    generateGetMembersHandler,
    generateInviteUserHandler,
    generateRemoveUserHandler,
    generateGetOnlineListHandler,
    generateGetBotDataHandler,
    generateModifyRulesHandler,
    generateModifyDescriptionHandler,
    generateCreateRoomHandler,
    generateModifyOptionsHandler,
    generateModifyNameOrEmojiHandler,
    generateModifyBotsHandler,
    generateLeaveRoomHandler,
    generateDeleteRoomHandler
} from './rooms'
export { generateVoteInPollHandler } from './poll'
export { 
    generateQueryUsersByNameHandler,
    generateQueryBotsHandler 
} from './users'
export { generateInviteActionHandler } from './invites'
export { generateStartDMHandler } from './dms'