import {mergeChatMessages,recordStorageFailure} from './storage-recovery.js';
const BASE='another-me.lives.v1',PREFIX=BASE+'.entry:',MESSAGE=BASE+'.message:';
const entryKey=id=>PREFIX+encodeURIComponent(id);
const messageKey=(id,m)=>MESSAGE+encodeURIComponent(id)+':'+encodeURIComponent(m);
function json(storage,key,fallback){try{return JSON.parse(storage.getItem(key)||'null')??fallback;}catch{return fallback;}}
function keys(storage){if(typeof storage.keys==='function')return storage.keys();if(typeof storage.key==='function')return Array.from({length:storage.length},(_,i)=>storage.key(i));return [];}
export function storedLibrary(storage){
 const raw=json(storage,BASE,null),lives=new Map((raw?.lives||[]).map(l=>[l.id,l])),allKeys=keys(storage);
 const ids=new Set([...lives.keys(),...json(storage,BASE+'.index',[])]),deleted=new Set();
 for(const key of allKeys)if(key?.startsWith(PREFIX))try{ids.add(decodeURIComponent(key.slice(PREFIX.length)));}catch{}
 for(const id of ids){const entry=json(storage,entryKey(id),null);if(entry?.deleted){lives.delete(id);deleted.add(id);}else if(entry?.life?.id===id)lives.set(id,{...entry.life,messages:mergeChatMessages(lives.get(id)?.messages,entry.life.messages)});}
 for(const key of allKeys)if(key?.startsWith(MESSAGE)){const row=json(storage,key,null),life=row&&lives.get(row.lifeId);if(life&&!deleted.has(row.lifeId)&&row.message?.id)lives.set(row.lifeId,{...life,messages:mergeChatMessages(life.messages,[row.message])});}
 return {version:2,activeId:raw?.activeId||null,lives:[...lives.values()]};
}
export function saveLibrary(storage,data,prepare,options={}){
 const stored=storedLibrary(storage),incoming=new Map((data.lives||[]).map(l=>[l.id,l])),changed=options.changedIds||[...incoming.keys()],deleted=options.deletedIds||[];
 for(const id of changed){const l=incoming.get(id),old=stored.lives.find(x=>x.id===id);if(!l)continue;if(json(storage,entryKey(id),null)?.deleted){recordStorageFailure(null,'record_deleted');return false;}if((old?.memoryRevision||0)>(l.memoryRevision||0)&&!options.passive){recordStorageFailure(null,'stale_memory');return false;}if(old)incoming.set(id,{...(options.passive&&(old.memoryRevision||0)>(l.memoryRevision||0)?old:l),messages:mergeChatMessages(old.messages,l.messages),draft:l.draft??old.draft});}
 // The independent entry is the commit: another life's writer cannot overwrite it.
 for(const id of deleted){storage.setItem(entryKey(id),JSON.stringify({deleted:true,id}));for(const key of keys(storage))if(key?.startsWith(MESSAGE+encodeURIComponent(id)+':'))storage.removeItem?.(key);}
 for(const id of changed){const l=incoming.get(id);if(!l)continue;for(const m of l.messages||[]){if(typeof m.id!=='string'||!m.id)continue;const key=messageKey(id,m.id),old=json(storage,key,null)?.message,merged=old?mergeChatMessages([old],[m])[0]:m,value=JSON.stringify({lifeId:id,message:merged});if(storage.getItem(key)!==value)storage.setItem(key,value);}storage.setItem(entryKey(id),JSON.stringify({life:prepare(l)}));}
 const allIds=new Set([...stored.lives.map(l=>l.id),...incoming.keys(),...deleted]);
 try{const prior=json(storage,BASE+'.index',[]);storage.setItem(BASE+'.index',JSON.stringify([...new Set([...prior,...allIds])]));const raw=json(storage,BASE,null);const canCompact=(raw?.lives||[]).every(l=>{const e=json(storage,entryKey(l.id),null);return e?.deleted||e?.life?.id===l.id&&(l.messages||[]).every((m,i)=>{const committed=m.id?e.life.messages?.find(x=>x.id===m.id):e.life.messages?.[i];return committed?.role===m.role&&String(committed.text||'').startsWith(m.text||'');});});storage.setItem(BASE,JSON.stringify({version:2,activeId:data.activeId??null,lives:canCompact?[]:raw?.lives||[]}));}catch{if(!changed.length&&!deleted.length)return false;}
 return true;
}

