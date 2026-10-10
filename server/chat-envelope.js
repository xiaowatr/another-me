import {strictJson} from './structured-story.js';
// Decode only the first reply string; never forward JSON or memory metadata.
export function chatEnvelope(onText){
 let raw='',position=null,decoded='',emitted=0,closed=false;
 const emit=()=>{const end=decoded.length-(/[\uD800-\uDBFF]$/.test(decoded)?1:0);if(end>emitted){onText(decoded.slice(emitted,end));emitted=end;}};
 return {push(chunk){raw+=chunk;if(raw.length>18000)throw Error('chat_envelope_size');if(position===null){const m=/^\s*\{\s*"reply"\s*:\s*"/.exec(raw);if(!m)return;position=m[0].length;}
 while(!closed&&position<raw.length){let c=raw[position];if(c==='"'){closed=true;position++;break;}if(c==='\\'){if(position+1>=raw.length)break;const kind=raw[position+1],size=kind==='u'?6:2;if(position+size>raw.length)break;c=JSON.parse('"'+raw.slice(position,position+size)+'"');position+=size;}else{if(c.charCodeAt(0)<32)throw Error('chat_envelope_control');position++;}decoded+=c;}emit();},
 finish(){const text=raw.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/,'$1');strictJson(text);const data=JSON.parse(text);if(!data||typeof data.reply!=='string'||!data.reply.trim()||data.reply.length>6000)throw Error('chat_envelope_reply');if(emitted&&data.reply!==decoded)throw Error('chat_envelope_mismatch');if(!emitted){decoded=data.reply;emit();}if(emitted<data.reply.length)onText(data.reply.slice(emitted));return {reply:data.reply,updateType:'none',memoryOperations:Array.isArray(data.memoryOperations)&&data.memoryOperations.length<=3?data.memoryOperations:[],...(!Array.isArray(data.memoryOperations)||data.memoryOperations.length>3?{memoryError:'invalid_operations'}:{})};}
 };
}
