import { Request, Response } from 'express';
export type reqHandlerFunction = (req: Request, res: Response) => any;
//------------------------------------------------
export * as login from './login'
export * as archive from './archive'
export * as stats from './stats'
export * as mediashare from './mediashare'
export * as settings from './settings'
export * as api from './api'
export * as userBots from './userBots';
export * as userBotsAPI from './userBotsAPI';