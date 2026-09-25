export const memoryKey=text=>String(text||'').normalize('NFKC').replace(/\s+/g,'').replace(/[。.!！?？]+$/,'');
export function dedupeMemories(rows){return rows.reduce((unique,row)=>{const same=unique.find(m=>(m.subject||(m.type==='fiction'?'parallelCharacter':'user'))===(row.subject||(row.type==='fiction'?'parallelCharacter':'user'))&&memoryKey(m.text)===memoryKey(row.text));if(same){same.sources=[...new Set([...(same.sources||[]),same.sourceId,...(row.sources||[]),row.sourceId].filter(Boolean))];}else unique.push({...row,sources:[...new Set([...(row.sources||[]),row.sourceId].filter(Boolean))]});return unique;},[]);}
// Storage-independent contract: operations are scoped and anchored to user messages.
export function applyMemoryOperations(life,batch){
 if(batch.lifeId!==life.id)throw Error('memory_owner');
 let rows=life.memories.map(m=>({...m}));const applied=new Set(life.sessionMeta?.appliedMemoryOperations||[]);let changed=0;
 for(const op of batch.operations){
  if(applied.has(op.id))continue;
  const source=life.messages.find((m,i)=>(m.id||life.id+':legacy:'+i)===op.sourceId);
  if(!source||source.role!=='user'||source.kind==='closing'||source.status==='pending'||!op.id||!['add','update','revoke'].includes(op.kind))throw Error('memory_source');
  if(op.subject&&op.subject!=='user')throw Error('memory_subject');
  const index=rows.findIndex(m=>m.id===op.targetId),before=rows[index];
  if(op.kind!=='add'&&(!before||before.text!==op.expectedText))throw Error('memory_stale_target');
  if(op.kind==='add'&&index>=0)throw Error('memory_duplicate_target');
  if(op.kind!=='revoke'&&(!op.text?.trim()||!['reality','preference'].includes(op.type)))throw Error('memory_value');
  const si=life.messages.indexOf(source);
  if(op.kind==='add'&&(life.sessionMeta?.suppressed||[]).some(s=>(s.sourceId===op.sourceId||si<(s.through||0))&&memoryKey(s.text)===memoryKey(op.text)))throw Error('memory_deleted_source');
  if(op.kind==='revoke')rows.splice(index,1);
  else {const item={...(before||{}),subject:'user',...(op.timeState?{timeState:op.timeState}:{}),id:op.targetId,text:op.text.trim(),type:op.type,sourceId:op.sourceId,sourceRole:'user',sourceText:source.text,savedAt:new Date().toISOString(),sources:[...(before?.sources|| (before?.sourceId?[before.sourceId]:[])),op.sourceId].filter((x,i,a)=>a.indexOf(x)===i)};if(op.kind==='add')rows.push(item);else rows[index]=item;}
  // Deduplicate both this batch and existing rows without losing provenance.
  rows=dedupeMemories(rows);
  applied.add(op.id);changed++;
 }
 if(rows.length>30)throw Error('memory_capacity');
 return {...life,memories:rows,sessionMeta:{...life.sessionMeta,appliedMemoryOperations:[...applied],memoryOutcome:changed?'changed':'unchanged'}};
}
export function candidateOperations(life,c){
 const base={sourceId:c.sourceId,type:c.type},operations=[];
 for(const [i,e] of (c.replacementEdits||[]).entries())operations.push({...base,id:c.id+':edit:'+i,kind:e.text?'update':'revoke',targetId:e.id,expectedText:e.previousText,text:e.text});
 if(c.origin==='model'&&c.requiresConfirmation&&c.confirmationKind==='add')return [{...base,id:c.id+':confirmed',kind:'add',targetId:c.id,text:c.text}];
 if(c.confirmTargetId){const target=life.memories.find(m=>m.id===c.confirmTargetId);if(!target)throw Error('memory_stale_target');if(c.expectedText!==undefined&&c.expectedText!==target.text)throw Error('memory_stale_target');return [{...base,id:c.id+':confirmed',kind:c.confirmationKind==='revoke'?'revoke':'update',targetId:target.id,expectedText:target.text,text:c.text}];}
 // A one-to-one replacement updates the original card rather than deleting and adding.
 if(operations.length===1&&operations[0].kind==='revoke')return [{...operations[0],kind:'update',text:c.text}];
 if(!life.memories.some(m=>m.text===c.text&&!operations.some(o=>o.targetId===m.id)))operations.push({...base,id:c.id+':add',kind:'add',targetId:c.id,text:c.text});
 return operations;
}
