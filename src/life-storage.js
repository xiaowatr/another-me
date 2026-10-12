const BASE='another-me.lives.v1',PREFIX=BASE+'.entry:';
const entryKey=id=>PREFIX+encodeURIComponent(id);
function keys(storage){if(typeof storage.keys==='function')return storage.keys();if(typeof storage.key==='function')return Array.from({length:storage.length},(_,i)=>storage.key(i));return [];}
export function storedLibrary(storage){
 const raw=JSON.parse(storage.getItem(BASE)||'null'),lives=new Map((raw?.lives||[]).map(l=>[l.id,l]));
 const ids=new Set([...lives.keys(),...(JSON.parse(storage.getItem(BASE+'.index')||'[]'))]);
 for(const key of keys(storage))if(key?.startsWith(PREFIX))try{ids.add(decodeURIComponent(key.slice(PREFIX.length)));}catch{}
 for(const id of ids){const saved=storage.getItem(entryKey(id));if(saved===null)continue;const entry=JSON.parse(saved);if(entry?.deleted)lives.delete(id);else if(entry?.life?.id===id)lives.set(id,entry.life);}
 return {version:2,activeId:raw?.activeId||null,lives:[...lives.values()]};
}
export function saveLibrary(storage,data,prepare,options={}){
 const stored=storedLibrary(storage),incoming=new Map((data.lives||[]).map(l=>[l.id,l])),changed=options.changedIds||[...incoming.keys()],deleted=options.deletedIds||[];
 for(const id of changed){const l=incoming.get(id),old=stored.lives.find(x=>x.id===id);if(!l)continue;if((old?.memoryRevision||0)>(l.memoryRevision||0))return false;const prior=storage.getItem(entryKey(id));if(prior&&JSON.parse(prior).deleted)return false;}
 // The independent entry is the commit: another life's writer cannot overwrite it.
 for(const id of deleted)storage.setItem(entryKey(id),JSON.stringify({deleted:true,id}));
 for(const id of changed){const l=incoming.get(id);if(l)storage.setItem(entryKey(id),JSON.stringify({life:prepare(l)}));}
 const allIds=new Set([...stored.lives.map(l=>l.id),...incoming.keys(),...deleted]);
 try{const prior=JSON.parse(storage.getItem(BASE+'.index')||'[]');storage.setItem(BASE+'.index',JSON.stringify([...new Set([...prior,...allIds])]));const latest=storedLibrary(storage);storage.setItem(BASE,JSON.stringify({...latest,activeId:data.activeId??null}));}catch{if(!changed.length&&!deleted.length)return false;}
 return true;
}
