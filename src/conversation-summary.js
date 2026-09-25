// Every available user utterance is covered, independently of fact extraction.
export function retainConversationSummary(life){
 const previous=new Map((life.sessionMeta?.conversationSummary||[]).map(row=>[row.sourceId,row]));
 const rows=life.messages.flatMap((m,i)=>{
  if(m.role!=='user'||m.kind==='closing'||m.status==='pending'||typeof m.text!=='string'||!m.text.trim())return [];
  const sourceId=m.id||life.id+':legacy:'+i,old=previous.get(sourceId);
  return [old?.sourceText===m.text?old:{sourceId,sourceText:m.text,text:m.text,mode:'excerpt'}];
 });
 return {...life,sessionMeta:{...life.sessionMeta,conversationSummary:rows}};
}
export function applyConversationSummary(life,rows=[]){
 const next=retainConversationSummary(life),updates=new Map(rows.map(row=>[row.sourceId,row]));
 return {...next,sessionMeta:{...next.sessionMeta,conversationSummary:next.sessionMeta.conversationSummary.map(row=>{
  const update=updates.get(row.sourceId);
  return update&&typeof update.text==='string'&&update.text.trim()&&update.text.length<=600?{...row,text:update.text.trim(),mode:'summary'}:row;
 })}};
}
