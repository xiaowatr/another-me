import {settingNote} from '../src/setting-note.js';
import {createHash,randomUUID} from 'node:crypto';
import {AppError,errorMessages} from './core.js';
export function createStoryTasks({run,check=()=>{},now=Date.now,ttl=3600000,max=100}={}){
 const records=new Map(),instanceId=randomUUID();
 function prune(){for(const [id,t]of records)if(t.status!=='running'&&now()-t.finishedAt>ttl)records.delete(id);}
 function own(owner,id){prune();const t=records.get(id);if(!t||t.owner!==owner)throw new AppError('task_missing',404);return t;}
 const view=t=>({taskId:t.id,instanceId,status:t.status,createdAt:t.createdAt,finishedAt:t.finishedAt,settingNote:t.settingNote||[],...(t.status==='succeeded'?{result:t.result}:{}),...(t.status==='failed'||t.status==='cancelled'?{error:t.error}: {})});
 return {instanceId,submit(owner,{taskId,input,instanceId:expected}){
  if(!/^[a-f0-9-]{36}$/.test(taskId||'')||!input?.background)throw new AppError('input');
  if(expected!==instanceId)throw new AppError('task_expired',409);
  prune();const hash=createHash('sha256').update(JSON.stringify(input)).digest('hex'),old=records.get(taskId);
  if(old){if(old.owner!==owner)throw new AppError('task_missing',404);if(old.hash!==hash)throw new AppError('task_input_changed',409);return view(old);}
  check(owner);if(records.size>=max)throw new AppError('capacity',429);
  const t={id:taskId,owner,hash,status:'running',createdAt:now(),controller:new AbortController()};records.set(taskId,t);
  // Execute immediately, not through a serial queue; keep running across HTTP disconnects.
  let started;try{started=run(input,{signal:t.controller.signal,owner,taskId,onSetting:effective=>{t.settingNote=settingNote(effective);}});}catch(e){started=Promise.reject(e);}
  t.promise=Promise.resolve(started).then(result=>{if(t.controller.signal.aborted){t.status='cancelled';t.error={category:'stopped',error:errorMessages.stopped};}else{t.result=result;t.status='succeeded';}},e=>{t.status=t.controller.signal.aborted?'cancelled':'failed';const category=t.controller.signal.aborted?'stopped':e.category||'upstream';t.error={category,error:errorMessages[category]||errorMessages.upstream,requestId:e.requestId};}).finally(()=>{t.finishedAt=now();});
  return view(t);
 },get:(owner,id)=>view(own(owner,id)),cancel(owner,id){const t=own(owner,id);if(t.status==='running')t.controller.abort();return view(t);},async settled(owner,id){await own(owner,id).promise;return view(own(owner,id));}};
}
