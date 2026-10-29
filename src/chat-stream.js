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
export const messageDelay=text=>Math.min(350,120+text.length*1.5);
export function appendBubble(messages,piece,turnId,bubbleIds){
 if(bubbleIds.length>=4 || (!piece.trim() && bubbleIds.length)){const id=bubbleIds.at(-1);return messages.map(m=>m.id===id?{...m,text:m.text+piece}:m);}
 if(!piece.trim())return messages;
 const id=crypto.randomUUID();bubbleIds.push(id);
 return [...messages,{id,turnId,role:'assistant',text:piece,status:'sent'}];
}


// Reveal received text in one bubble, opening another only at a paragraph boundary.
export function takeStreamCharacters(buffer,count=4){
 let end=Array.from(buffer).slice(0,count).join('').length;
 const paragraph=/\n[ \t]*\n/.exec(buffer);
 if(paragraph&&paragraph.index+paragraph[0].length<=end)end=paragraph.index+paragraph[0].length;
 else if(end>0&&buffer[end-1]==='\n'&&buffer[end]==='\n')end--;
 return [buffer.slice(0,end),buffer.slice(end)];
}
export function chatDisplayUpdate(turn,piece){
 const create=!turn.bubbleIds.length||(turn.paragraphComplete&&piece.trim()&&turn.bubbleIds.length<4);
 const id=create?crypto.randomUUID():turn.bubbleIds.at(-1);
 if(create)turn.bubbleIds.push(id);
 turn.paragraphComplete=/\n[ \t]*\n$/.test(piece)||(!piece.trim()&&turn.paragraphComplete);
 return {id,create,text:piece,turnId:turn.messageId};
}
export function applyChatDisplay(messages,update){
 return update.create?[...messages,{id:update.id,turnId:update.turnId,role:'assistant',text:update.text,status:'sent'}]:messages.map(m=>m.id===update.id?{...m,text:m.text+update.text}:m);
}
