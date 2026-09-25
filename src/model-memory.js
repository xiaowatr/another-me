import {isIdentityCorrection} from './participant-identity.js';
import {applyMemoryOperations} from './memory-operations.js';
import {reviseMemories} from './memory-review.js';
export function memoryInput(life){
 const start=life.sessionMeta?.organizedUntil||0;let end=life.messages.length;
 const blocked=life.messages.findIndex((m,i)=>i>=start&&m.role==='user'&&m.status==='pending');if(blocked>=0)end=blocked;
 const user=(m,i)=>({id:m.id||life.id+':legacy:'+i,text:m.text});
 const eligible=m=>m.role==='user'&&m.kind!=='closing'&&m.status!=='pending';
 const messages=life.messages.slice(start,end).flatMap((m,i)=>eligible(m)?[user(m,start+i)]:[]);
 if(messages.length>80||messages.some(m=>m.text.length>2500))throw Error('memory_input_limit');
 return {identityContext:{realityOutcome:(life.background?.realityOutcome||'').slice(0,2500),hypotheticalDirection:(life.background?.hypotheticalDirection||'').slice(0,2500),corrections:life.messages.slice(0,end).filter(m=>eligible(m)&&isIdentityCorrection(m.text)).slice(-20).map(m=>m.text.slice(0,2000))},lifeId:life.id,start,end,blocked:blocked>=0,messages,context:life.messages.slice(0,start).flatMap((m,i)=>eligible(m)?[user(m,i)]:[]).slice(-12),memories:life.memories.filter(m=>m.type!=='fiction').map(({id,text,type})=>({id,text,type}))};
}
export function acceptMemoryResult(life,job,result){
 if(life.sessionMeta?.memoryJob?.id!==job.id||life.memoryRevision!==job.expectedRevision)throw Error('memory_stale_revision');
 if(result.lifeId!==life.id||result.batchId!==job.id)throw Error('memory_owner');
 const sourceIds=new Set(job.input.messages.map(m=>m.id));
 if(result.operations.some(o=>!sourceIds.has(o.sourceId)))throw Error('memory_source');
 const pending=result.operations.filter(o=>o.needsConfirmation).map(o=>({id:o.id,type:o.type||'reality',text:o.text||'请填写更正后的内容',sourceId:o.sourceId,sourceText:job.input.messages.find(m=>m.id===o.sourceId).text,sourceRole:'user',requiresConfirmation:true,confirmationKind:o.kind,confirmTargetId:o.targetId||'',expectedText:o.expectedText,origin:'model'}));
 const applied=applyMemoryOperations(life,{lifeId:life.id,operations:result.operations.filter(o=>!o.needsConfirmation)});
 const next=reviseMemories({...life,sessionMeta:applied.sessionMeta},applied.memories);
 return {...next,candidates:[...next.candidates,...pending],sessionMeta:{...next.sessionMeta,organizedUntil:job.input.end,roundStart:job.input.end,memoryJob:{...job,status:'complete',requestId:result.requestId},review:{status:'complete',end:job.input.end},memoryOutcome:pending.length?'confirmation':applied.sessionMeta.memoryOutcome}};
}

export function retryMemoryJob(job,instanceId,newId){
 if(!job||!['invalid_response','task_expired'].includes(job.error)||(job.retryUsed||job.attempt||0)>=1)throw Error('memory_retry_exhausted');
 return {...job,...(job.instanceId!==instanceId?{id:newId,instanceId,attempt:0}:{attempt:1}),retryUsed:1,status:'pending'};
}
