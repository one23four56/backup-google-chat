import { Request, Response } from 'express';
export type reqHandlerFunction = (req: Request, res: Response) => any;
//------------------------------------------------
export * as login from './http/login'
export * as archive from './http/archive'
export * as account from './http/account'
export * as update from './http/update'