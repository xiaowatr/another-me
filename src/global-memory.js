export const PROFILE_FIELDS=['facts','preferences','impressions'];
import {STORAGE_SCOPE} from './app-storage.js';
const key='another-me:global-user-memory:v1',pendingKey=id=>'another-me:global-memory-review:'+id;
export function profileFields(value={}){return Object.fromEntries(PROFILE_FIELDS.map(k=>{if(typeof value[k]!=='string'||value[k].length>1000)throw Error('profile_invalid');return [k,value[k].trim()];}));}
export const emptyProfile=()=>({facts:'',preferences:'',impressions:''});
export function reviewProfile(base,proposed){const suggestion=profileFields(proposed),draft=profileFields(base),changes=[];for(const k of PROFILE_FIELDS){if(!draft[k])draft[k]=suggestion[k];else if(draft[k]!==suggestion[k])changes.push(k);}return {draft,suggestion,changes,empty:PROFILE_FIELDS.every(k=>!suggestion[k]),missing:changes.filter(k=>!suggestion[k])};}
export function adoptProfileSuggestion(review,field){if(!PROFILE_FIELDS.includes(field)||!review.suggestion?.[field])throw Error('profile_empty_suggestion');return {...review,draft:{...review.draft,[field]:review.suggestion[field]},changes:review.changes.filter(k=>k!==field)};}
export function readGlobalMemory(storage){try{const v=JSON.parse(storage?.getItem(key)||'null');return v?{revision:v.revision||0,...profileFields(v)}:{revision:0,...emptyProfile()};}catch{return {revision:0,...emptyProfile()};}}
export function saveGlobalMemory(storage,base,draft){if(!storage)throw Error('profile_storage');const latest=readGlobalMemory(storage),next=profileFields(draft);for(const k of PROFILE_FIELDS){if(latest[k]!==base[k]&&next[k]!==base[k]&&next[k]!==latest[k])throw Error('profile_conflict');if(next[k]===base[k])next[k]=latest[k];}const saved={...next,revision:latest.revision+1,confirmedAt:new Date().toISOString()};storage.setItem(key,JSON.stringify(saved));return saved;}
export async function saveGlobalMemoryLocked(storage,base,draft,locks=globalThis.navigator?.locks){return locks?.request?locks.request('another-me-global-user-memory:'+STORAGE_SCOPE,()=>saveGlobalMemory(storage,base,draft)):saveGlobalMemory(storage,base,draft);}
export function readProfileReview(storage,id){try{return JSON.parse(storage?.getItem(pendingKey(id))||'null');}catch{return null;}}
export function writeProfileReview(storage,id,value){if(!storage)throw Error('profile_storage');storage.setItem(pendingKey(id),JSON.stringify(value));}
export function clearProfileReview(storage,id){storage?.removeItem(pendingKey(id));}
// A new message batch is a new job, not a retry of a stale cached result.
// Preserve the old draft and its base so conflict checks still protect later confirmations.
export function prepareProfileReview(previous,life,global){
 const input=profileInput(life,global);
 if(previous&&JSON.stringify(previous.input?.messages)===JSON.stringify(input.messages)&&previous.input?.start===input.start)return previous;
 const base=previous?.base||global;
 return {lifeId:life.id,base,draft:previous?.draft||base,input,ready:!input.messages.length,calls:0,
  ...(previous?{previousReview:{base:previous.base,draft:previous.draft,suggestion:previous.suggestion,input:previous.input},editedFields:previous.editedFields||PROFILE_FIELDS.filter(k=>previous.draft[k]!==previous.base[k]),notice:'旧草稿已保留，本次会纳入新增聊天；你手动修改或采用的字段继续保留。'}:{})};
}
export function completeProfileReview(review,proposed){
 const result=reviewProfile(review.base,proposed),editedFields=review.editedFields||[];
 for(const k of editedFields)result.draft[k]=review.draft[k];
 result.changes=PROFILE_FIELDS.filter(k=>result.draft[k]!==result.suggestion[k]);
 result.missing=result.changes.filter(k=>!result.suggestion[k]);
 return {...review,...result,ready:true};
}
export function profileInput(life,global){const start=life.sessionMeta?.globalOrganizedUntil||0,eligible=m=>m.role==='user'&&!['pending','failed','stopped'].includes(m.status)&&m.kind!=='closing';const window=life.messages.slice(start),cut=window.findIndex(m=>m.role==='user'&&m.status==='pending');const rows=(cut<0?window:window.slice(0,cut));let count=0,end=start,bytes=0;const messages=[];for(const m of rows){if(eligible(m)){const size=new TextEncoder().encode(JSON.stringify({id:m.id,text:m.text})).length;if(count===80||bytes+size>140000)break;messages.push({id:m.id,text:m.text});count++;bytes+=size;}end++;}return {identityContext:{realityOutcome:(life.background?.realityOutcome||'').slice(0,2500),hypotheticalDirection:(life.background?.hypotheticalDirection||'').slice(0,2500),corrections:[]},lifeId:life.id,start,end,globalProfile:profileFields(global),messages,context:life.messages.slice(0,start).filter(eligible).slice(-12).map(m=>({id:m.id,text:m.text.slice(-500)})),memories:[]};}
