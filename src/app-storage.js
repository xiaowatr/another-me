// Only an explicit local-test build uses a separate browser namespace.
export const STORAGE_SCOPE=import.meta.env?.MODE==='local-test'?'local-test':'';
export function scopedStorage(storage,scope=''){
 const prefix=scope?'another-me.test:'+scope+':':'';
 return {getItem:key=>storage.getItem(prefix+key),setItem:(key,value)=>storage.setItem(prefix+key,value),removeItem:key=>storage.removeItem(prefix+key)};
}
export function appStorage(){const storage=globalThis.localStorage||globalThis.window?.localStorage;if(!storage)throw Error('浏览器无法使用本地存储');return scopedStorage(storage,STORAGE_SCOPE);}
