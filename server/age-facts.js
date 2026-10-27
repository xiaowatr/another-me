import {eventDate} from '../src/age-validation.js';
import {coordinates} from '../src/context.js';
const integer=(v,min,max)=>/^\d+$/.test(String(v??''))&&Number(v)>=min&&Number(v)<=max?Number(v):null;
export function ageFacts(background){
 const c=coordinates(background),birth=integer(background.birthYear,1850,2200),explicit=integer(background.forkAge,0,120),year=c.yearSource==='user'?c.forkYear:null;
 const range=birth!=null&&year!=null?[year-birth-1,year-birth].filter(n=>n>=0&&n<=120):[];
 const conflict=explicit!=null&&range.length>0&&!range.includes(explicit);
 return {version:1,birthYear:birth,eventYear:year,eventMonth:eventDate(background)?.month??null,explicitAgeAtEvent:explicit,allowedAgeAtEvent:conflict?[]:explicit!=null?[explicit]:range,birthdayUnknown:true,inputConflict:conflict,sourceFields:[...(birth!=null?['birthYear']:[]),...(explicit!=null?['forkAge']:[]),...(year!=null?['hypotheticalDirection','realityOutcome']:[])],meaning:'用户明确当时年龄优先；仅出生年和事件年时保留生日前后一岁范围，未知不猜。只适用于同一人物/同一时点，回忆、计划和配角年龄须另辨；无需主动写出年龄。'};
}
export function ageNumber(text){
 if(/^\d{1,3}$/.test(text))return +text<=120?+text:null;
 const unit={零:0,〇:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
 if(Object.hasOwn(unit,text))return unit[text];
 if(text==='一百')return 100;
 if(/^一百(?:零)?[一二两三四五六七八九]$/.test(text))return 100+unit[text.at(-1)];
 if(text==='一百一十')return 110;if(/^一百一十[一二三四五六七八九]$/.test(text))return 110+unit[text.at(-1)];if(text==='一百二十')return 120;
 const m=text.match(/^([一二两三四五六七八九])?十([一二两三四五六七八九])?$/);return m?(m[1]?unit[m[1]]:1)*10+(m[2]?unit[m[2]]:0):null;
}
const ageToken='(?:[0-9]{1,3}|[零〇一二两三四五六七八九十百]{1,7})';
const yearOf=text=>{const years=[...String(text).matchAll(/((?:18|19|20|21)\d{2})年/g)];return years.length===1?+years[0][1]:null;};
const quotedRanges=text=>[...text.matchAll(/[“「『"][^”」』"]*(?:[”」』"]|$)/g)].map(m=>[m.index,m.index+m[0].length]);
// Only explicit first-person, exact-number claims are eligible. Ambiguous scope
// stays a semantic-review observation; never replace every occurrence of 岁.
export function ageFactIssues(story,background){
 const f=ageFacts(background);if(f.inputConflict||!f.allowedAgeAtEvent.length)return [];
 const fields=['title','intro','synopsis','identity','character','opening'].map(field=>({field,text:story[field],year:null}));
 for(const [i,s] of (story.scenes||[]).entries())fields.push({field:`scenes.${i}.text`,text:s.text,year:yearOf(s.time)});
 const issues=[];
 for(const {field,text,year:sceneYear} of fields){
  if(typeof text!=='string')continue;
  const regex=new RegExp('我(?:在((?:18|19|20|21)\\d{2})年[，,]?)?(?:(?:那年|当时|那时|今年|现在|如今|已经|才|刚满|满|是|有|正好|也|都)){0,3}('+ageToken+')岁','g');
  const quoted=quotedRanges(text),activity=String(background.hypotheticalDirection||'').match(/(?:开始|继续)?学([^，。！？；\s]{1,12})/)?.[1];
  const current=new RegExp('(?:今年|现在|如今)('+ageToken+')(?:岁)?(?:了|，|。|$)|('+ageToken+')岁的人了','g');
  const matches=[...text.matchAll(regex)].map(m=>({index:m.index,0:m[0],1:m[1],2:m[2]}));
  for(const m of text.matchAll(current)){
   if(matches.some(a=>m.index>=a.index&&m.index<a.index+a[0].length))continue;
   const start=Math.max(text.lastIndexOf('。',m.index-1),text.lastIndexOf('！',m.index-1),text.lastIndexOf('？',m.index-1),text.lastIndexOf('\n',m.index-1))+1;
   const prefix=text.slice(start,m.index);
   if(!/我/.test(prefix)||/老师|同事|朋友|妈妈|爸爸|母亲|父亲|他|她|别人|有人|你|说|问|回答/.test(prefix))continue;
   matches.push({index:m.index,0:m[0],1:undefined,2:m[1]||m[2]});
  }
  // 我都三十了 has no 岁; require the explicit first-person current-age form.
  const noSui=new RegExp('我(?:今年|现在|如今|已经|都)('+ageToken+')了','g');
  for(const m of text.matchAll(noSui))if(!matches.some(a=>m.index===a.index))matches.push({index:m.index,0:m[0],1:undefined,2:m[1]});
  for(const m of matches){
   if(quoted.some(([a,b])=>m.index>=a&&m.index<b))continue;
   const n=ageNumber(m[2]);if(n==null)continue;
   const start=Math.max(text.lastIndexOf('。',m.index-1),text.lastIndexOf('！',m.index-1),text.lastIndexOf('？',m.index-1),text.lastIndexOf('\n',m.index-1))+1;
   const tail=text.slice(m.index+m[0].length),prefix=text.slice(start,m.index),end=tail.search(/[。！？\n]/),quote=text.slice(start,m.index+m[0].length+(end<0?tail.length:end));
   if(/大概|大约|差不多|将近|快到|不到|至少|最多/.test(prefix)||/^(?:左右|上下|出头|多|来|半)/.test(tail))continue;
   if(/如果|假如|设想|想象|打算|计划|将来|以后/.test(prefix))continue;
   const explicitYear=m[1]?+m[1]:yearOf(prefix);
   const changingActivity=Boolean(activity&&quote.includes(activity)&&/报了|报名|报班|开始|第一次/.test(quote));
   if(explicitYear==null&&(/回忆|回想|想起|记起|小时候|很多年前/.test(text.slice(0,m.index))&&!/现在|如今|今年/.test(m[0])||/曾经|想过|考虑过/.test(quote)))continue;
   if(explicitYear==null&&/^那年/.test(tail)&&!changingActivity)continue;
   const past=/回忆|回想|想起|记起|曾经|小时候|上学时|很多年前|以前/.test(prefix)||/^(?:时|的时候)/.test(tail);
   let anchor=explicitYear??(!past?sceneYear:null),sameEvent=false;
   const summary=['intro','synopsis','identity','title'].includes(field);
   if(anchor==null&&summary&&!past){anchor=f.eventYear;sameEvent=true;}
   if(anchor==null&&!past&&/我(?:当时|那时)/.test(m[0])){anchor=f.eventYear;sameEvent=true;}
   if(anchor===f.eventYear&&!past&&summary)sameEvent=true;
   if(anchor===f.eventYear&&!past&&/开始|报(?:了|名|班)|第一次|当时|那时/.test(quote))sameEvent=true;
   const mentionedMonth=prefix.match(/([一二两三四五六七八九十\d]+)月/);
   if(/后来|之后|生日|个月后|到了?/.test(prefix)||(mentionedMonth&&f.eventMonth!=null&&ageNumber(mentionedMonth[1])!==f.eventMonth))sameEvent=false;
   let allowed=sameEvent?f.allowedAgeAtEvent:anchor!=null&&f.birthYear!=null?[anchor-f.birthYear-1,anchor-f.birthYear].filter(x=>x>=0&&x<=120):[];
   if(!allowed.length||allowed.includes(n))continue;
   issues.push({field,reason:'age_fact_conflict',proof:{kind:'age_fact',quote,observedAge:n,expectedAges:allowed,anchorYear:anchor,sameEvent,sourceFields:f.sourceFields,factsSignature:[f.birthYear,f.eventYear,f.explicitAgeAtEvent].join('|'),calculation:sameEvent&&f.explicitAgeAtEvent!=null?`用户明确本节点年龄${f.explicitAgeAtEvent}岁，正文却明确${n}岁`:`${anchor}年与出生年份只能支持${allowed.join('或')}岁，正文却明确${n}岁`}});
  }
 }
 return [...new Map(issues.map(i=>[i.field+'|'+i.proof.quote,i])).values()];
}
export function ageProofIsGrounded(proof,background){
 if(proof?.kind!=='age_fact'||typeof proof.quote!=='string'||!Array.isArray(proof.expectedAges))return false;
 const f=ageFacts(background);if(f.inputConflict||proof.factsSignature!==[f.birthYear,f.eventYear,f.explicitAgeAtEvent].join('|'))return false;
 const allowed=proof.sameEvent?f.allowedAgeAtEvent:integer(proof.anchorYear,1850,2200)!=null&&f.birthYear!=null?[proof.anchorYear-f.birthYear-1,proof.anchorYear-f.birthYear].filter(x=>x>=0&&x<=120):[];
 return allowed.length>0&&JSON.stringify(allowed)===JSON.stringify(proof.expectedAges)&&Number.isInteger(proof.observedAge)&&!allowed.includes(proof.observedAge);
}
