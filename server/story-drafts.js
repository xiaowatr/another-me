import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {AppError} from './core.js';
// Private server-side archive. Never returned by task polling or copied into a story.
export function createDraftArchive(directory='.local/story-drafts'){
 return (owner,operationId,draft)=>{
  if(!/^[a-f0-9-]{36}$/.test(operationId))throw new AppError('local_storage',500);
  const ownerTag=createHash('sha256').update(owner).digest('hex').slice(0,24);
  const folder=path.join(directory,ownerTag,operationId);fs.mkdirSync(folder,{recursive:true});
  const id=createHash('sha256').update(draft.id).digest('hex');const file=path.join(folder,id+'.json'),temp=file+'.tmp';
  const stored=draft;
  try{fs.writeFileSync(temp,JSON.stringify(stored));fs.renameSync(temp,file);}catch{throw new AppError('local_storage',500);}
 };
}
