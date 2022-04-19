import { Request, Response } from 'express';
export type reqHandlerFunction = (req: Request, res: Response) => any;
//------------------------------------------------
export * as login from './login'
export * as archive from './archive'
export * as account from './account'
export * as update from './update'
export * as stats from './stats'