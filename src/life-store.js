import {storedLibrary,saveLibrary} from './life-storage.js';
import {isIdentityCorrection} from './participant-identity.js';
import {roleRecords} from './role-record.js';
import {migrateBackground,retiredBackground} from './background.js';
import {chatClock,lifeContext,historyRisk} from './session-context.js';
import {backupBeforeMigration} from './storage-migration.js';
import {recoveredLives,withRecoveredChat,retainUnsaved,recordStorageFailure,clearStorageFailure,clearRecovered} from './storage-recovery.js';
﻿export const LIFE_KEY='another-me.lives.v1';
export function readLives(storage,options={}){try{let data;try{data=storedLibrary(storage);}catch{data={version:2,lives:[],activeId:null};}for(const l of recoveredLives(options.recoveryStorage)){const old=data.lives.find(x=>x.id===l.id);if(old)data.lives=data.lives.map(x=>x.id===l.id?withRecoveredChat(x,l):x);else if(!storage?.getItem(LIFE_KEY+'.entry:'+encodeURIComponent(l.id)))data.lives.push(l);}if(!data.activeId&&data.lives.length)data.activeId=data.lives[0].id;if([1,2].includes(data?.version) && Array.isArray(data.lives))return {activeId:data.activeId,lives:data.lives.filter(l=>typeof l.id==='string' && l.story && Array.isArray(l.messages)).map(l=>({...l,background:migrateBackground(l.background),retiredBackground:l.retiredBackground || retiredBackground(l.background),conversationContext:lifeContext(migrateBackground(l.background),l.story,l.memories||[]),chatTime:chatClock(l.background||{},undefined,l.story),sessionMeta:{...(l.sessionMeta||{}),...(l.sessionMeta?.review?.status==='pending'?{review:{...l.sessionMeta.review,status:'failed'}}:{})},messages:l.messages.map((m,i)=>({...m,id:m.id||`${l.id}:legacy:${i}`,...(m.contextExcluded || (m.role==='assistant'&&historyRisk(m.text||'',l.background,l.memories||[],l.story))?{contextExcluded:true}:{}),status:m.status==='pending'?'failed':m.status})),memories:Array.isArray(l.memories)?l.memories:[],candidates:Array.isArray(l.candidates)?l.candidates:[]}))};}catch{}return {activeId:null,lives:[]};}
export function writeLives(storage,data,options={}){const backups=new Map(recoveredLives(options.recoveryStorage).map(l=>[l.id,l]));data={...data,lives:data.lives.map(l=>backups.has(l.id)?{...withRecoveredChat(l,backups.get(l.id)),draft:l.draft??backups.get(l.id).draft}:l)};clearStorageFailure();const changed=data.lives.filter(l=>(options.changedIds||data.lives.map(x=>x.id)).includes(l.id));try{if(!backupBeforeMigration(storage,LIFE_KEY))throw Error('migration_backup');const okay=saveLibrary(storage,data,l=>({...l,background:migrateBackground(l.background),retiredBackground:l.retiredBackground||retiredBackground(l.background),conversationContext:lifeContext(migrateBackground(l.background),l.story,l.memories||[]),chatTime:chatClock(l.background||{},undefined,l.story),roleRecords:roleRecords(l.messages||[],l.background||{},l.memories||[],l.contextStart||0)}),options);if(okay)changed.forEach(l=>clearRecovered(l.id,options.recoveryStorage));else retainUnsaved(changed,options.recoveryStorage);return okay;}catch(error){recordStorageFailure(error);retainUnsaved(changed,options.recoveryStorage);return false;}}
export function modelHistory(messages,skipId=null,contextStart=0){
 const entries=[];const lastIdentity=messages.findLastIndex(m=>m.role==='user'&&!['failed','pending'].includes(m.status)&&isIdentityCorrection(m.text||''));
 for(const m of messages.slice(contextStart)){
   if(m.role==='assistant'&&messages.indexOf(m)<lastIdentity)continue;
   if(m.id===skipId || m.turnId===skipId || m.status==='pending' || m.contextExcluded)continue;
   const role=m.role==='user'?'user':'assistant',text=m.text;
   if(typeof text!=='string' || !text.trim())continue;
   if(role==='assistant' && entries.at(-1)?.role==='assistant')entries.at(-1).content+='\n'+text;else entries.push({role,content:text});
 }
 return entries.slice(-12).map(m=>({...m,content:m.content.slice(0,6000)}));
}
export function applyMemory(memories,item){
 if(!['reality','preference','fiction'].includes(item.type) || !item.text?.trim())return memories;
 const clean={id:item.id,type:item.type,text:item.text.trim().slice(0,1000)};
 return [...memories.filter(m=>m.id!==item.id),clean].slice(-30);
}
// Explicit deletion also removes the same life from the recoverable migration copy.
export function removeLifeBackup(storage,id){try{const key=LIFE_KEY+'.before-v8',raw=storage.getItem(key);if(!raw)return true;const data=JSON.parse(raw);if(Array.isArray(data.lives)){storage.setItem(key,JSON.stringify({...data,activeId:data.activeId===id?null:data.activeId,lives:data.lives.filter(l=>l.id!==id)}));}return true;}catch{return false;}}

// Publish processed-message cursors only after durable storage accepts the whole change.
export function persistLifeChange(storage,lives,activeId,id,current,transform,options={}){
 const stored=readLives(storage).lives.find(l=>l.id===id);if((stored?.memoryRevision||0)>(current.memoryRevision||0)&&!options.rebaseChat){recordStorageFailure(null,'stale_memory');retainUnsaved([current],options.recoveryStorage);return {okay:false,next:current,lives,reason:'stale_memory'};}
 const source=options.rebaseChat&&stored?withRecoveredChat(stored,current):current;
 const next={...transform(source),memoryRevision:(source.memoryRevision||0)+1},all=[...lives.filter(l=>l.id!==id),next];
 const okay=writeLives(storage,{activeId,lives:all},{changedIds:[id],recoveryStorage:options.recoveryStorage});
 if(!okay)return {okay:false,next:current,lives};const saved=readLives(storage).lives;return {okay,next:saved.find(l=>l.id===id)||next,lives:saved};
}

