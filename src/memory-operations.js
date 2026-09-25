// Storage-independent contract: operations are scoped and anchored to user messages.
export function applyMemoryOperations(life,batch){
 if(batch.lifeId!==life.id)throw Error('memory_owner');
 let rows=life.memories.map(m=>({...m}));const applied=new Set(life.sessionMeta?.appliedMemoryOperations||[]);let changed=0;
 for(const op of batch.operations){
  if(applied.has(op.id))continue;
  const source=life.messages.find((m,i)=>(m.id||life.id+':legacy:'+i)===op.sourceId);
  if(!source||source.role!=='user'||source.kind==='closing'||['pending','failed'].includes(source.status)||!op.id||!['add','update','revoke'].includes(op.kind))throw Error('memory_source');
  const index=rows.findIndex(m=>m.id===op.targetId),before=rows[index];
  if(op.kind!=='add'&&(!before||before.text!==op.expectedText))throw Error('memory_stale_target');
  if(op.kind==='add'&&index>=0)throw Error('memory_duplicate_target');
  if(op.kind!=='revoke'&&(!op.text?.trim()||!['reality','preference'].includes(op.type)))throw Error('memory_value');
  const si=life.messages.indexOf(source);
  if(op.kind==='add'&&(life.sessionMeta?.suppressed||[]).some(s=>(s.sourceId===op.sourceId||si<(s.through||0))&&s.text===op.text))throw Error('memory_deleted_source');
  if(op.kind==='revoke')rows.splice(index,1);
  else {const item={...(before||{}),id:op.targetId,text:op.text.trim(),type:op.type,sourceId:op.sourceId,sourceRole:'user',sourceText:source.text,savedAt:new Date().toISOString(),sources:[...(before?.sources|| (before?.sourceId?[before.sourceId]:[])),op.sourceId].filter((x,i,a)=>a.indexOf(x)===i)};if(op.kind==='add')rows.push(item);else rows[index]=item;}
  applied.add(op.id);changed++;
 }
 if(rows.length>30)throw Error('memory_capacity');
 return {...life,memories:rows,sessionMeta:{...life.sessionMeta,appliedMemoryOperations:[...applied],memoryOutcome:changed?'changed':'unchanged'}};
}
export function candidateOperations(life,c){
 const base={sourceId:c.sourceId,type:c.type},operations=[];
 for(const [i,e] of (c.replacementEdits||[]).entries())operations.push({...base,id:c.id+':edit:'+i,kind:e.text?'update':'revoke',targetId:e.id,expectedText:e.previousText,text:e.text});
 if(c.confirmTargetId){const target=life.memories.find(m=>m.id===c.confirmTargetId);if(!target)throw Error('memory_stale_target');return [{...base,id:c.id+':confirmed',kind:'update',targetId:target.id,expectedText:target.text,text:c.text}];}
 // A one-to-one replacement updates the original card rather than deleting and adding.
 if(operations.length===1&&operations[0].kind==='revoke')return [{...operations[0],kind:'update',text:c.text}];
 if(!life.memories.some(m=>m.text===c.text&&!operations.some(o=>o.targetId===m.id)))operations.push({...base,id:c.id+':add',kind:'add',targetId:c.id,text:c.text});
 return operations;
}
