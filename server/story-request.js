import {GENERATION_SECTIONS,sectionText} from './generation-rules.js';

// Rules retain system priority. Data and examples precede the sole final core block.
export function orderedStoryMessages(input,{task,output,content}={}){
 const {writingReference,identityMap,...data}=input;
 return [
  {role:'system',content:(task||sectionText(GENERATION_SECTIONS[0]))+'\n\n'+sectionText(GENERATION_SECTIONS[1])},
  {role:'user',content:JSON.stringify(data)},
  {role:'system',content:content||sectionText(GENERATION_SECTIONS[2])},
  {role:'user',content:JSON.stringify({writingReference})},
  {role:'system',content:output||sectionText(GENERATION_SECTIONS[3])},
  {role:'system',content:sectionText(GENERATION_SECTIONS[4])}
 ];
}
// A trailing system message must not be parsed as JSON; legacy requests still work.
export function storyRequestInput(messages){
 const result={};
 for(const m of messages||[]){if(m.role!=='user')continue;let data;try{data=JSON.parse(m.content);}catch{continue;}
  if(data&&typeof data==='object'&&!Array.isArray(data)&&(data.effectiveSetting||Object.hasOwn(data,'canClarify')||data.writingReference))Object.assign(result,data);
 }
 return result;
}
export function updateStoryRequestInput(messages,update){
 const index=messages.findIndex(m=>{if(m.role!=='user')return false;try{const p=JSON.parse(m.content);return p&&typeof p==='object'&&(p.effectiveSetting||Object.hasOwn(p,'canClarify'));}catch{return false;}});
 if(index<0)throw Error('Missing story input');
 return messages.map((m,i)=>i===index?{...m,content:JSON.stringify(update(JSON.parse(m.content)))}:{...m});
}
