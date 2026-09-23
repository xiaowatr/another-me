import {roleRecords} from './role-record.js';
import {migrateBackground,retiredBackground} from './background.js';
import {chatClock,lifeContext,historyRisk} from './session-context.js';
import {backupBeforeMigration} from './storage-migration.js';
﻿export const LIFE_KEY='another-me.lives.v1';
export function readLives(storage){try{const data=JSON.parse(storage.getItem(LIFE_KEY));if([1,2].includes(data?.version) && Array.isArray(data.lives))return {activeId:data.activeId,lives:data.lives.filter(l=>typeof l.id==='string' && l.story && Array.isArray(l.messages)).map(l=>({...l,background:migrateBackground(l.background),retiredBackground:l.retiredBackground || retiredBackground(l.background),conversationContext:lifeContext(migrateBackground(l.background),l.story,l.memories||[]),chatTime:chatClock(l.background||{}),sessionMeta:{...(l.sessionMeta||{}),...(l.sessionMeta?.review?.status==='pending'?{review:{...l.sessionMeta.review,status:'failed'}}:{})},messages:l.messages.map((m,i)=>({...m,id:m.id||`${l.id}:legacy:${i}`,...(m.contextExcluded || (m.role==='assistant'&&historyRisk(m.text||'',l.background))?{contextExcluded:true}:{}),status:m.status==='pending'?'failed':m.status})),memories:Array.isArray(l.memories)?l.memories:[],candidates:Array.isArray(l.candidates)?l.candidates:[]}))};}catch{}return {activeId:null,lives:[]};}
export function writeLives(storage,data){try{if(!backupBeforeMigration(storage,LIFE_KEY))return false;storage.setItem(LIFE_KEY,JSON.stringify({...data,version:2,lives:(data.lives||[]).map(l=>({...l,background:migrateBackground(l.background),retiredBackground:l.retiredBackground||retiredBackground(l.background),conversationContext:lifeContext(migrateBackground(l.background),l.story,l.memories||[]),chatTime:chatClock(l.background||{}),roleRecords:roleRecords(l.messages||[],l.background||{},l.memories||[],l.contextStart||0)}))}));return true;}catch{return false;}}
export function modelHistory(messages,skipId=null,contextStart=0){
 const entries=[];
 for(const m of messages.slice(contextStart)){
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
