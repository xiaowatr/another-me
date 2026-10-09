import {settingNote} from '../src/setting-note.js';
import {STORY_MAX_MODEL_CALLS,STORY_MAX_TOTAL_CALLS} from '../src/story-budget.js';
import {createHash,randomUUID} from 'node:crypto';
import {AppError,errorMessages} from './core.js';
export function createStoryTasks({run,check=()=>{},now=Date.now,ttl=3600000,max=100,archive=()=>{}}={}){
 const records=new Map(),instanceId=randomUUID();
 const prune=()=>{for(const [id,t]of records)if(t.status!=='running'&&now()-t.finishedAt>ttl)records.delete(id);};
 const own=(owner,id)=>{prune();const t=records.get(id);if(!t||t.owner!==owner)throw new AppError('task_missing',404);return t;};
 const view=t=>({taskId:t.id,operationId:t.operation.id,parentTaskId:t.parentTaskId,attempt:t.operation.attempts,cumulativeCallCount:t.operation.calls,storyCallCount:t.operation.stageCalls?.story||0,stageCallCounts:t.operation.stageCalls||{story:0},instanceId,status:t.status,createdAt:t.createdAt,finishedAt:t.finishedAt,settingNote:t.settingNote||[],...(t.status==='succeeded'?{result:t.result}:{}),...(['failed','cancelled'].includes(t.status)?{error:t.error}:{})});
 return {instanceId,submit(owner,{taskId,input,instanceId:expected,parentTaskId=null,continuation=null}){
  if(!/^[a-f0-9-]{36}$/.test(taskId||'')||!input?.background)throw new AppError('input');
  if(expected!==instanceId)throw new AppError('task_expired',409);
  prune();const hash=createHash('sha256').update(JSON.stringify(input)).digest('hex'),old=records.get(taskId);
  if(old){if(old.owner!==owner)throw new AppError('task_missing',404);if(old.hash!==hash)throw new AppError('task_input_changed',409);return view(old);}
  let operation;
  if(parentTaskId){const parent=own(owner,parentTaskId);if(parent.status==='running')throw new AppError('busy',409);if(parent.operation.lastTaskId!==parentTaskId||continuation!=='clarification'||parent.result?.kind!=='clarification')throw new AppError('retry_exhausted',409);operation=parent.operation;}
  else {if(continuation)throw new AppError('input');operation={id:taskId,calls:0,attempts:0,drafts:[]};}
  if((operation.stageCalls?.story??operation.pool?.generated??operation.calls??0)>=STORY_MAX_MODEL_CALLS||(operation.calls||0)>=STORY_MAX_TOTAL_CALLS)throw new AppError('retry_exhausted',409);
  check(owner);if(records.size>=max)throw new AppError('capacity',429);
  operation.attempts++;operation.lastTaskId=taskId;
  if(operation.poolHash!==hash){operation.pool={generated:operation.pool?.generated||0,drafts:[]};operation.poolHash=hash;}
  const t={operation,parentTaskId,id:taskId,owner,hash,status:'running',createdAt:now(),controller:new AbortController()};records.set(taskId,t);
  const onDraft=d=>{const saved={...d,inputHash:hash,taskId,createdAt:now()},old=operation.drafts.find(x=>x.id===d.id&&x.inputHash===hash);archive(owner,operation.id,saved);if(old)Object.assign(old,saved);else operation.drafts.push(saved);};
  let started;try{started=run(input,{signal:t.controller.signal,owner,taskId,parentTaskId,operation,poolState:operation.pool,onDraft,onSetting:effective=>t.settingNote=settingNote(effective)});}catch(e){started=Promise.reject(e);}
  t.promise=Promise.resolve(started).then(result=>{if(t.controller.signal.aborted){t.status='cancelled';t.error={category:'stopped',error:errorMessages.stopped};}else{t.result=result;t.status='succeeded';}},e=>{t.status=t.controller.signal.aborted?'cancelled':'failed';const category=t.controller.signal.aborted?'stopped':e.category||'upstream';t.error={category,error:errorMessages[category]||errorMessages.upstream,requestId:e.requestId};}).finally(()=>t.finishedAt=now());return view(t);
 },get:(owner,id)=>view(own(owner,id)),cancel(owner,id){const t=own(owner,id);if(t.status==='running')t.controller.abort();return view(t);},async settled(owner,id){await own(owner,id).promise;return view(own(owner,id));}};
}
