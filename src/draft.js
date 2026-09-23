import {migrateBackground,retiredBackground,ACTIVE_FIELDS} from './background.js';
import {backupBeforeMigration} from './storage-migration.js';
﻿export const DRAFT_KEY = 'another-me.background-draft.v1';
export const EMPTY_BACKGROUND = {...Object.fromEntries(ACTIVE_FIELDS.map(k=>[k,''])),inputVersion:'6'};
const fallback = () => ({background:{...EMPTY_BACKGROUND},step:0,detailsOpen:false,question:'',clarification:''});
export function readDraft(storage) {
  try {
    const value=JSON.parse(storage.getItem(DRAFT_KEY));
    if(!value || ![1,2].includes(value.version)) return fallback();
    return {background:migrateBackground(value.background||{}),retired:value.retired || retiredBackground(value.background),step:Number.isInteger(value.step)&&value.step>=0&&value.step<=2?value.step:0,detailsOpen:Boolean(value.detailsOpen),question:typeof value.question==='string'?value.question.slice(0,300):'',clarification:typeof value.clarification==='string'?value.clarification.slice(0,1500):''};
  } catch { return fallback(); }
}
export function writeDraft(storage, value) {
  try {if(!backupBeforeMigration(storage,DRAFT_KEY))return false;const old=JSON.parse(storage.getItem(DRAFT_KEY)||'null');storage.setItem(DRAFT_KEY,JSON.stringify({...value,version:2,background:migrateBackground(value.background),retired:old?.retired || retiredBackground(old?.background || value.background)}));return true;}catch{return false;}
}
export function clearDraft(storage) {try {storage.removeItem(DRAFT_KEY);return true;}catch{return false;}}
