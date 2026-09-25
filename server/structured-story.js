export function strictJson(raw){
 const value=JSON.parse(raw),tokens=raw.match(/"(?:\\.|[^"\\])*"|[{}\[\]:,]/g)||[],stack=[];
 for(const t of tokens){const top=stack.at(-1);if(t==='{')stack.push({object:true,keys:new Set(),key:true});else if(t==='[')stack.push({object:false});else if(t==='}'||t===']')stack.pop();else if(t===','&&top?.object)top.key=true;else if(t===':'&&top?.object)top.key=false;else if(t.startsWith('"')&&top?.object&&top.key){const k=JSON.parse(t);if(top.keys.has(k))throw Error('duplicate_field:'+k);top.keys.add(k);}}
 return value;
}
export function normalizeChapters(raw){
 const data=strictJson(raw);
 if(!Array.isArray(data.scenes))throw Error('chapters_array_required');
 if(data.scenes.length<3||data.scenes.length>4)throw Error('chapter_count');
 return {...data,scenes:data.scenes.map((s,i)=>{
  if(!s||typeof s!=='object'||Array.isArray(s))throw Error('invalid_chapter_field:'+i);
  if(s.text==null||typeof s.text==='string'&&!s.text.trim())throw Error('missing_or_empty_body:'+i);
  if(typeof s.text!=='string'||['time','title'].some(k=>s[k]!=null&&typeof s[k]!=='string'))throw Error('invalid_chapter_field:'+i);
  if(s.text.length>2000)throw Error('body_too_long:'+i);
  return {time:s.time?.trim()||'时间未注明',title:s.title?.trim()||`片段${i+1}`,text:s.text};
 })};
}
