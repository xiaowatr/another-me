// Preserve exact prefixes for acknowledgement; paragraphs are semantic units.
export function takeMessage(buffer,final=false){
 const paragraph=/\n[ \t]*\n/.exec(buffer);
 if(paragraph && paragraph.index>0)return [buffer.slice(0,paragraph.index+paragraph[0].length),buffer.slice(paragraph.index+paragraph[0].length)];
 // Fallback for models that omit paragraph breaks: a full thought, not every sentence.
 for(const m of buffer.matchAll(/[。！？!?][”」』"]?/g)){
  const end=m.index+m[0].length;
  if(end>=180)return [buffer.slice(0,end),buffer.slice(end)];
 }
 if(final)return [buffer,''];
 return ['',buffer];
}
export const messageDelay=text=>Math.min(3000,1000+text.length*22);
export function appendBubble(messages,piece,turnId,bubbleIds){
 if(bubbleIds.length>=4 || (!piece.trim() && bubbleIds.length)){const id=bubbleIds.at(-1);return messages.map(m=>m.id===id?{...m,text:m.text+piece}:m);}
 if(!piece.trim())return messages;
 const id=crypto.randomUUID();bubbleIds.push(id);
 return [...messages,{id,turnId,role:'assistant',text:piece,status:'sent'}];
}

