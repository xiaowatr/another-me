import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import {AppError} from './core.js';
const context=new AsyncLocalStorage();
export const currentOwner=()=>context.getStore()||'local-test';
export const withOwner=(owner,fn)=>context.run(owner,fn);
export function authenticate(req){const token=req.headers['x-anonymous-token'];if(typeof token!=='string'||!/^([a-f0-9]{64})$/.test(token))throw new AppError('identity',401);return createHash('sha256').update(token).digest('hex');}
export function createSlots(limit=5){const owners=new Map();const key=(owner,scope='')=>JSON.stringify([owner,scope]);return {limit,get active(){return owners.size;},checkOwner(owner,scope=''){if(owners.has(key(owner,scope)))throw new AppError('busy',409);},check(owner,scope=''){if(owners.has(key(owner,scope)))throw new AppError('busy',409);if(owners.size>=limit)throw new AppError('capacity',429);},availability(owner,scope=''){return {available:!owners.has(key(owner,scope))&&owners.size<limit,task:owners.get(key(owner,scope))?.task||null};},acquire(owner,task=null,scope=''){this.check(owner,scope);const ticket={id:Symbol(),task};owners.set(key(owner,scope),ticket);return ()=>{if(owners.get(key(owner,scope))===ticket)owners.delete(key(owner,scope));};}};}
