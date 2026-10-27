import {ageFacts,ageNumber} from './age-facts.js';
export const AGE_SLOT='{{AGE_AT_EVENT}}';
export function ageSlotContract(background){
 const f=ageFacts(background);
 return {token:AGE_SLOT,enabled:!f.inputConflict&&f.allowedAgeAtEvent.length===1,scope:'仅明确本节点本人年龄；写成“我当时{{AGE_AT_EVENT}}岁”。不同年份、过去回忆、未来计划、其他人物禁止使用；同年较晚场景须能排除生日变化。无必要省略年龄，生日未知不能自行选值。'};
}
const fields=story=>[...['title','intro','synopsis','identity','character','opening'].map(field=>({field,text:story[field],year:null,month:null})),...(story.scenes||[]).flatMap((s,i)=>['text','title','time'].map(key=>({field:`scenes.${i}.${key}`,text:s[key],year:Number(s.time?.match(/((?:18|19|20|21)\d{2})年/)?.[1])||null,month:ageNumber(s.time?.match(/([一二两三四五六七八九十\d]+)月/)?.[1]||'')})))];
// Do not replace literal ages, historical records, input fields, or unknown slots.
export function fillAgeSlots(story,background){
 const f=ageFacts(background),result=structuredClone(story),filled=[];
 if(!ageSlotContract(background).enabled)return {story:result,filled};
 for(const {field,text,year,month} of fields(story)){
  if(typeof text!=='string'||!text.includes(AGE_SLOT)||field.startsWith('scenes.')&&!field.endsWith('.text'))continue;
  const output=text.replaceAll(AGE_SLOT,(token,index)=>{
   const start=Math.max(...['。','！','？','\n'].map(s=>text.lastIndexOf(s,index-1)))+1;
   const tail=text.slice(index+token.length),end=tail.search(/[。！？\n]/),sentence=text.slice(start,index+token.length+(end<0?tail.length:end));
   const prefix=text.slice(start,index);
   const quoted=[...text.matchAll(/[“「『"][^”」』"]*(?:[”」』"]|$)/g)].some(m=>index>=m.index&&index<m.index+m[0].length);
   if(/回忆|回想|想起|记起|小时候|很多年前/.test(text.slice(0,index))&&!/现在|如今|今年/.test(prefix))return token;
   if(quoted||!/(?:我)(?:(?:当时|那时|今年|现在|如今|已经|才|刚满|满|是|有|正好|也|都))*$/.test(prefix)||!/^岁/.test(tail))return token;
   if(/回忆|回想|想起|记起|小时候|曾经|以前|那时候|将来|未来|以后|明年|明天|下个月|下月|后来|之后|如果|假如|打算|计划|生日|老师|朋友|同事|他|她|你/.test(sentence))return token;
   const years=[...sentence.matchAll(/((?:18|19|20|21)\d{2})年/g)].map(m=>+m[1]);
   if(years.some(y=>y!==f.eventYear)||year!=null&&year!==f.eventYear)return token;
   const mentionedMonths=[...sentence.matchAll(/([一二两三四五六七八九十\d]+)月/g)].map(m=>ageNumber(m[1]));
   if(mentionedMonths.some(m=>m!==f.eventMonth))return token;
   // A lower birthday-range value cannot safely carry into a later month/year.
   if(year!=null&&f.birthYear!=null&&f.allowedAgeAtEvent[0]!==year-f.birthYear&&month!==f.eventMonth)return token;
   if(field.startsWith('scenes.')&&year==null&&!/当时|那时/.test(prefix))return token;
   filled.push({field,token,value:f.allowedAgeAtEvent[0],basis:'程序读取的明确节点年龄及受限时域'});return String(f.allowedAgeAtEvent[0]);
  });
  if(field.startsWith('scenes.'))result.scenes[Number(field.split('.')[1])].text=output;else result[field]=output;
 }
 return {story:result,filled};
}
export function ageSlotIssues(story){return fields(story).filter(({text})=>typeof text==='string'&&/\{\{\s*AGE[^}]*\}\}/i.test(text)).map(({field})=>({field,reason:'unresolved_age_slot'}));}
