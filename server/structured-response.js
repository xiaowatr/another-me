import {internalTimelineEnabled,extractInternalTimeline,internalTimelineIssues,internalTimeSchema} from './internal-timeline.js';
import {storyRequestInput} from './story-request.js';
import {decodeJson,AppError} from './core.js';
import {strictJson} from './structured-story.js';
import {validateSchema} from './schema-validation.js';
export function receiveStructured(content,task,tools,messages,diagnostic={}){
 try{strictJson(content);}catch(e){if(e.message.startsWith('duplicate_field:'))throw new AppError('invalid_response',502,{stage:'schema',reason:'duplicate_field'});}
 let data=decodeJson(content,diagnostic);const tool=tools.find(t=>t.function.name===(data?.kind==='clarification'?'ask_clarification':'submit_story')),repairs=[];
 const schema=tool?.function.parameters;
 const setting=storyRequestInput(messages).effectiveSetting;let internalTimeline=null,internalTimeDiagnostics=[];
 if(task==='story'&&data?.kind==='story'&&storyRequestInput(messages).generationStage==='body'&&internalTimelineEnabled(setting)&&schema?.properties?.chapter1){
  const raw=extractInternalTimeline(data);internalTimeDiagnostics=internalTimelineIssues(raw,null,setting);
  internalTimeline=raw.map(x=>x!=null&&!validateSchema(internalTimeSchema(setting),x).length?x:null);
  data={...data};for(const k of ['chapter1','chapter2','chapter3'])if(data[k]&&typeof data[k]==='object'&&!Array.isArray(data[k])){const {internalTime,...chapter}=data[k];data[k]=chapter;}
 }
 if(task==='story'&&data?.kind==='story'){const normalize=(object,key,path)=>{if(typeof object?.[key]!=='string')return;const text=object[key].replace(/\\r\\n|\\n|\\r/g,'\n');if(text!==object[key]){object[key]=text;repairs.push({field:path,operation:'normalize_literal_newline'});}};for(const k of ['intro','character','opening'])normalize(data,k,'/'+k);for(const k of ['chapter1','chapter2','chapter3','chapter4'])normalize(data[k],'text','/'+k+'/text');}
 // The optional null-only fourth slot has no story content when it is an empty string.
 // Omit that slot, record compatibility handling, then validate the same original schema.
 // The provider also encodes an empty null slot as the exact object {null:""}.
 // All content-bearing strings/objects, missing chapters and partial-repair extras remain invalid.
 if(schema?.properties?.chapter4?.type==='null'&&!schema.required?.includes('chapter4')&&((typeof data?.chapter4==='string'&&!data.chapter4.trim())||(data?.chapter4&&typeof data.chapter4==='object'&&!Array.isArray(data.chapter4)&&Object.keys(data.chapter4).length===1&&data.chapter4.null===''))){
  const {chapter4,...rest}=data;data=rest;repairs.push({field:'/chapter4',operation:'omit_empty_optional_slot',original:chapter4});
 }
 return {data,internalTimeline,internalTimeDiagnostics,errors:tool?validateSchema(schema,data):[{path:'',keyword:'allowed_tool'}],repairs};
}
