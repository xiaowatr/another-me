export function strictJson(raw){
 const value=JSON.parse(raw),tokens=raw.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]/g)||[],stack=[];
 for(const t of tokens){const top=stack.at(-1);if(t==='{')stack.push({object:true,keys:new Set(),key:true});else if(t==='[')stack.push({object:false});else if(t==='}'||t===']')stack.pop();else if(t===','&&top?.object)top.key=true;else if(t===':'&&top?.object)top.key=false;else if(t.startsWith('"')&&top?.object&&top.key){const k=JSON.parse(t);if(top.keys.has(k))throw Error('duplicate_field:'+k);top.keys.add(k);}}
 return value;
}
export function normalizeChapters(raw){const data=strictJson(raw);if(!Array.isArray(data.scenes)||data.scenes.length!==3)throw Error('three_chapters_required');return {...data,scenes:data.scenes.map((s,i)=>{if(!s||typeof s.text!=='string'||!s.text.trim())throw Error('missing_or_empty_body:'+i);if(s.text.length>4000)throw Error('body_too_long');return {time:typeof s.time==='string'&&s.time.trim()?s.time.trim():'时间未注明',title:typeof s.title==='string'&&s.title.trim()?s.title.trim():`片段${i+1}`,text:s.text};})};}
