import {dateParts} from './input-anchors.js';
﻿export function coordinates(b){
 const birth=/^\d{4}$/.test(b.birthYear || '')?Number(b.birthYear):null;
 const age=/^\d{1,3}$/.test(b.forkAge || '')?Number(b.forkAge):null;
 const eventYear=dateParts(b.hypotheticalDirection)[0]?.year??dateParts(b.realityOutcome)[0]?.year??null;
 const direct=/^\d{4}$/.test(b.forkYear || '')?Number(b.forkYear):null;
 const calculated=birth!=null && age!=null?birth+age:null;
 const useCalculated=['3','4','5','6'].includes(b.inputVersion) && calculated!=null;
 const free=typeof b.locationText==='string';
 const place=free?b.locationText.trim()||null:b.cityMode==='specific'?(b.city || '').trim()||null:b.cityMode==='type'?(b.cityType || '').trim()||null:null;
 return {birthYear:birth,forkAge:age,forkYear:eventYear??(useCalculated?calculated:direct??calculated),yearSource:eventYear?'user':useCalculated?'estimated':direct?'user':calculated?'estimated':'unknown',estimatedYear:calculated,
   locationAtFork:place,
   locationKind:free?(place?'description':'unknown'):b.cityMode==='specific'?'city':b.cityMode==='type'?'environment':'unknown',
   hometown:null,futureWorkplace:null};
}
export const unknownCoordinate=v=>!String(v||'').trim()||/^(?:不确定|不知道|未知|不记得|记不清|不愿透露|不透露|不填写)$/.test(String(v).trim());
export function coordinateError(b){
 for(const [key,min,max] of [['birthYear',1850,new Date().getFullYear()],['forkAge',0,120],['forkYear',1850,2200]]){
  if(key==='forkYear' && ['3','4','5','6'].includes(b.inputVersion) && b.birthYear && b.forkAge)continue;
  if(!unknownCoordinate(b[key]) && (!/^\d+$/.test(b[key]) || Number(b[key])<min || Number(b[key])>max))return '请检查出生年份、分岔年龄或年份的范围。';
 }
 if(!(['3','4','5','6'].includes(b.inputVersion) && b.birthYear && b.forkAge) && b.birthYear && b.forkYear && Number(b.forkYear)<Number(b.birthYear))return '分岔年份不能早于出生年份，请核对。';
 return '';
}
