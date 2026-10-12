import {scopedStorage,STORAGE_SCOPE} from './app-storage.js';
const prefix='another-me.chat-recovery:';
let diagnostic={reason:null,recovered:false};
export const storageDiagnostic=()=>({...diagnostic});
export function recordStorageFailure(error,reason){const name=error?.name;diagnostic={reason:reason||(['QuotaExceededError','NS_ERROR_DOM_QUOTA_REACHED'].includes(name)?'quota_exceeded':name==='SecurityError'?'storage_denied':'storage_write_failed'),recovered:false};}
export function clearStorageFailure(){diagnostic={reason:null,recovered:false};}
export function recoveryStorage(){try{const s=globalThis.sessionStorage||globalThis.window?.sessionStorage;return s?scopedStorage(s,STORAGE_SCOPE):null;}catch{return null;}}
export function retainUnsaved(lives,storage=recoveryStorage()){try{if(!storage)return false;for(const l of lives)storage.setItem(prefix+encodeURIComponent(l.id),JSON.stringify(l));diagnostic.recovered=true;return true;}catch{return false;}}
export function recoveredLives(storage=recoveryStorage()){try{return (storage?.keys?.()||[]).filter(k=>k.startsWith(prefix)).flatMap(k=>{try{const l=JSON.parse(storage.getItem(k));return l?.id&&Array.isArray(l.messages)?[l]:[];}catch{return [];}});}catch{return [];}}
export function clearRecovered(id,storage=recoveryStorage()){try{storage?.removeItem(prefix+encodeURIComponent(id));}catch{}}
export function mergeChatMessages(saved=[],incoming=[]){const key=(m,i)=>m.id?.match(/:legacy:(\d+)$/)?'legacy:'+m.id.match(/:legacy:(\d+)$/)[1]:m.id||'legacy:'+i;const rows=new Map(saved.map((m,i)=>[key(m,i),m]));for(const [i,m] of incoming.entries()){const id=key(m,i),old=rows.get(id);if(!old){rows.set(id,m);continue;}if(old.role!==m.role)continue;if(old.role==='assistant'){if(String(m.text||'').startsWith(old.text||''))rows.set(id,{...old,...m});}else if(old.text===m.text){rows.set(id,{...old,...m,...(old.status==='sent'?{status:'sent'}:{})});}}return [...rows.values()];}
export function withRecoveredChat(canonical,recovery){return canonical?{...canonical,messages:mergeChatMessages(canonical.messages,recovery.messages),draft:recovery.draft??canonical.draft}:recovery;}
export function storageFailureText(){const d=storageDiagnostic(),reason={stale_memory:'记忆版本已变化，旧修改未覆盖新记录。',record_deleted:'这条人生已在另一个窗口删除。',quota_exceeded:'本地存储容量不足。',storage_denied:'浏览器拒绝了本地存储。',storage_write_failed:'本地保存未完成，原因尚未确认。'}[d.reason]||'本地保存未完成，原因尚未确认。';return reason+(d.recovered?'聊天已暂存在本标签页，刷新可恢复；关闭标签页前请导出备份。':'请保留当前页面，并先导出未保存的聊天。');}
