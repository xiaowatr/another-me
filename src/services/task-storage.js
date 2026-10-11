import {appStorage,scopedStorage,STORAGE_SCOPE} from '../app-storage.js';
// Each window owns its pending task. Histories and anonymous identity stay shared.
export function createTaskStorage(local,tab,id){
 const scoped=key=>key+'.window:'+id;
 return {getItem(key){const value=tab.getItem(key)??local.getItem(scoped(key));if(value!==null)return value;const legacy=local.getItem(key);if(legacy===null)return null;const claim=local.getItem(key+'.window-owner');if(claim&&claim!==id)return null;local.setItem(key+'.window-owner',id);tab.setItem(key,legacy);local.setItem(scoped(key),legacy);return legacy;},setItem(key,value){local.setItem(scoped(key),value);tab.setItem(key,value);},removeItem(key){tab.removeItem(key);local.removeItem(scoped(key));if(local.getItem(key+'.window-owner')===id)local.setItem(key+'.window-owner','retired:'+id);}};
}
export function taskStorage(){
 const storage=globalThis.sessionStorage||globalThis.window?.sessionStorage;
 if(!storage){if(typeof window!=='undefined')throw Error('浏览器无法保存本窗口任务，请允许会话存储后重试。');return appStorage();}
 const tab=scopedStorage(storage,STORAGE_SCOPE),key='another-me.task-window.v1';let id=tab.getItem(key);if(!id){id=crypto.randomUUID();tab.setItem(key,id);}
 return createTaskStorage(appStorage(),tab,id);
}
