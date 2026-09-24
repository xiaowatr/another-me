import {coordinates} from '../src/context.js';
﻿import { AppError } from './core.js';
// Conservative guard for common claims about the real past. It is not a semantic verifier.
export function checkStoryGrounding(story,background){
 const source=JSON.stringify(background);
 // Only explicit short ranges with a known start year; do not constrain present-day opening/identity.
 const requested=[background.hypotheticalDirection,background.details,background.followupSkipped?'':background.followupAnswer].filter(Boolean).join('。');
 const shortRange=/(?:只写|只看|仅写|仅看)[^。；]{0,25}(?:[一二两三四五六七八九]|[1-9])个月/.test(requested);
 const startYear=coordinates(background).forkYear;
 if(shortRange && Number.isInteger(startYear))for(const [i,scene] of (story.scenes||[]).entries()){
  const year=String(scene.time).match(/((?:19|20)\d{2})年/);
  if(year && (Number(year[1])<startYear || Number(year[1])>startYear+1))throw new AppError('background_conflict',422,{stage:'business',reason:'outside_explicit_short_range',field:`scenes.${i}.time`});
 }
 const fields=[...['title','identity','intro','character','opening'].map(key=>({field:key,text:story[key]})),...(story.scenes||[]).flatMap((s,i)=>['time','title','text'].map(key=>({field:`scenes.${i}.${key}`,text:s[key]})))].filter(f=>typeof f.text==='string');
 const text=fields.map(f=>f.text).join('。');
 // Missing information alone is not a contradiction. Keep explicit constraints and sourced-policy checks.
 if(/求职市场[^。]{0,15}(?:动荡|萎缩|低迷)|招聘(?:名额|数量)[^。]{0,10}(?:下降|增加|减少)/.test(text))throw new AppError('background_conflict',422,{stage:'business',reason:'unsourced_trend'});
 return story;
}

export function checkChatGrounding(text,background,memories=[],roleEvidence='',target=null){
 const provided=JSON.stringify({background,memories:memories.filter(m=>m.type!=='fiction')});
 for(const m of String(text).matchAll(/我(?:以前|曾经|之前)?在([^，。！？]{2,12}?)(?:工作|上班|待)(?:过|了)?([一二两三四五六七八九十\d]+)年/g)){if(!roleEvidence.includes(m[1])||!roleEvidence.includes(m[2]+'年'))throw new AppError('background_conflict',422,{stage:'business',reason:'unsupported_role_career'});}
 if(target==='realUser')for(const m of String(text).matchAll(/你(?:最近|之前|以前|正在|开始)?(?:学过|在学|学了|学习)([^，。！？？]{1,20})/g)){const claim=m[1].replace(/(?:啊|呀|吧|呢|来着|对吧|对吗|对不对|了|嘛)+$/,'').trim();if(!/什么|哪些/.test(claim)&&!provided.includes(claim))throw new AppError('background_conflict',422,{stage:'business',reason:'unconfirmed_user_memory'});}
 // A city of upbringing alone does not license a shared childhood scene.
 if(!(coordinates(background).forkAge===0||/从出生|出生时/.test(background.hypotheticalDirection||'')) && /那些[^。！？]{0,70}(?:玩耍|上学|放学)[^。！？]{0,30}(?:日子|时候)|小时候[^。！？]{0,60}(?:一起|常去|玩耍)/.test(text) && !/童年|小时候|儿时|玩耍/.test(provided))throw new AppError('background_conflict',422);
 if(/已保存到记忆|要记住这件事吗|已存入记忆/.test(text))throw new AppError('invalid_response',502);
 return text;
}
