import {applyMemoryOperations} from './memory-operations.js';
import {reviseMemories} from './memory-review.js';
export function memoryInput(life){
 const start=life.sessionMeta?.organizedUntil||0;let end=life.messages.length;
 const blocked=life.messages.findIndex((m,i)=>i>=start&&m.role==='user'&&['pending','failed'].includes(m.status));if(blocked>=0)end=blocked;
 const user=(m,i)=>({id:m.id||life.id+':legacy:'+i,text:m.text});
 const eligible=m=>m.role==='user'&&m.kind!=='closing'&&!['pending','failed'].includes(m.status);
 const messages=life.messages.slice(start,end).flatMap((m,i)=>eligible(m)?[user(m,start+i)]:[]);
 if(messages.length>80||messages.some(m=>m.text.length>2500))throw Error('memory_input_limit');
 return {lifeId:life.id,start,end,messages,context:life.messages.slice(0,start).flatMap((m,i)=>eligible(m)?[user(m,i)]:[]).slice(-12),memories:life.memories.filter(m=>m.type!=='fiction').map(({id,text,type})=>({id,text,type}))};
}
export function acceptMemoryResult(life,job,result){
 if(life.sessionMeta?.memoryJob?.id!==job.id||life.memoryRevision!==job.expectedRevision)throw Error('memory_stale_revision');
 if(result.lifeId!==life.id||result.batchId!==job.id)throw Error('memory_owner');
 const sourceIds=new Set(job.input.messages.map(m=>m.id));
 if(result.operations.some(o=>!sourceIds.has(o.sourceId)))throw Error('memory_source');
 const pending=result.operations.filter(o=>o.needsConfirmation).map(o=>({id:o.id,type:o.type||'reality',text:o.text||'请填写更正后的内容',sourceId:o.sourceId,sourceText:job.input.messages.find(m=>m.id===o.sourceId).text,sourceRole:'user',requiresConfirmation:true,origin:'model'}));
 const applied=applyMemoryOperations(life,{lifeId:life.id,operations:result.operations.filter(o=>!o.needsConfirmation)});
 const next=reviseMemories({...life,sessionMeta:applied.sessionMeta},applied.memories);
 return {...next,candidates:[...next.candidates,...pending],sessionMeta:{...next.sessionMeta,organizedUntil:job.input.end,roundStart:job.input.end,memoryJob:{...job,status:'complete',requestId:result.requestId},review:{status:'complete',end:job.input.end},memoryOutcome:pending.length?'confirmation':applied.sessionMeta.memoryOutcome}};
}
