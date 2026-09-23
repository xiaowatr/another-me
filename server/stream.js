// SSE frames may cross UTF-8 and network chunk boundaries.
export async function* readSSE(body) {
  const decoder=new TextDecoder(); let buffer='';
  for await(const bytes of body){
    buffer+=decoder.decode(bytes,{stream:true});
    let match;
    while((match=/\r?\n\r?\n/.exec(buffer))){
      const frame=buffer.slice(0,match.index);buffer=buffer.slice(match.index+match[0].length);
      const data=frame.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');
      if(data) yield data;
    }
    if(buffer.length>100000) throw Error('frame too large');
  }
  if(buffer.trim()) throw Error('incomplete frame');
}
// Never emit a possible partial think tag. Reasoning fields are ignored upstream.
export function textFilter(){
  let pending='',thinking=false;
  return chunk=>{
    pending+=chunk;let out='';
    while(pending){
      if(pending[0]==='<'){
        const end=pending.indexOf('>');if(end<0)break;
        const tag=pending.slice(0,end+1).toLowerCase();pending=pending.slice(end+1);
        if(tag==='<think>')thinking=true;else if(tag==='</think>')thinking=false;
        continue;
      }
      const next=pending.indexOf('<');const n=next<0?pending.length:next;
      if(!thinking)out+=pending.slice(0,n);pending=pending.slice(n);
    }
    return out;
  };
}
