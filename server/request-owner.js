import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import {AppError} from './core.js';
const context=new AsyncLocalStorage();
export const currentOwner=()=>context.getStore()||'local-test';
export const withOwner=(owner,fn)=>context.run(owner,fn);
export function authenticate(req){const token=req.headers['x-anonymous-token'];if(typeof token!=='string'||!/^([a-f0-9]{64})$/.test(token))throw new AppError('identity',401);return createHash('sha256').update(token).digest('hex');}
export function createSlots(limit=3){const owners=new Map();return {limit,get active(){return owners.size;},checkOwner(owner){if(owners.has(owner))throw new AppError('busy',409);},check(owner){if(owners.has(owner))throw new AppError('busy',409);if(owners.size>=limit)throw new AppError('capacity',429);},acquire(owner){this.check(owner);const ticket=Symbol();owners.set(owner,ticket);return ()=>{if(owners.get(owner)===ticket)owners.delete(owner);};}};}
