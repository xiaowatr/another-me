import {dailyLifeIssue} from './daily-life.js';
import {temporalIssues} from '../src/input-anchors.js';
import {coordinates} from '../src/context.js';
﻿import { AppError } from './core.js';
// Conservative guard for common claims about the real past. It is not a semantic verifier.
export function checkStoryGrounding(story,background,temporal){
 const source=JSON.stringify(background);
 const timeIssue=temporalIssues(story,background,temporal)[0];if(timeIssue)throw new AppError('background_conflict',422,{stage:'business',reason:timeIssue.reason==='outside_observation_window'?'outside_explicit_short_range':timeIssue.reason,field:timeIssue.field,evidence:timeIssue.evidence});
 const fields=[...['title','identity','intro','character','opening'].map(key=>({field:key,text:story[key]})),...(story.scenes||[]).flatMap((s,i)=>['time','title','text'].map(key=>({field:`scenes.${i}.${key}`,text:s[key]})))].filter(f=>typeof f.text==='string');
 const text=fields.map(f=>f.text).join('。');
 for(const f of fields){const reason=dailyLifeIssue(f.text,background);if(reason)throw new AppError('background_conflict',422,{stage:'business',reason,field:f.field});}
 // Missing information alone is not a contradiction. Keep explicit constraints and sourced-policy checks.
 if(/求职市场[^。]{0,15}(?:动荡|萎缩|低迷)|招聘(?:名额|数量)[^。]{0,10}(?:下降|增加|减少)/.test(text))throw new AppError('background_conflict',422,{stage:'business',reason:'unsourced_trend'});
 return story;
}

export function checkChatGrounding(text,background,memories=[],roleEvidence='',target=null){
 // Check only explicit first-person recollections against established role evidence.
 if(!/如果|假如|比喻|像是|仿佛|打算|想象/.test(text)){
 const means=['飞机','火车','高铁','轮船','汽车'];
 const established=means.filter(m=>new RegExp('(?:坐|乘|乘坐|搭乘|登上|上)'+m).test(roleEvidence));
 const claimed=means.filter(m=>new RegExp('我(?:当年|那次|当时)[^。！？]{0,16}(?:坐|乘|乘坐|搭乘|登上|上)'+m).test(text));
 if(established.length===1&&claimed.some(m=>m!==established[0]))throw new AppError('background_conflict',422,{stage:'business',reason:'role_transport_conflict'});
 if(/我(?:最终|那次|当时)?(?:没有|没|并未)出发/.test(roleEvidence)&&/我(?:当年|那次|当时|已经)?(?:已经)?(?:踏上旅程|出发了)/.test(text)&&!/后来.{0,8}出发/.test(roleEvidence))throw new AppError('background_conflict',422,{stage:'business',reason:'role_departure_conflict'});
 }
 const provided=JSON.stringify({background,memories:memories.filter(m=>m.type!=='fiction')});
 for(const m of String(text).matchAll(/我(?:以前|曾经|之前)?在([^，。！？]{2,12}?)(?:工作|上班|待)(?:过|了)?([一二两三四五六七八九十\d]+)年/g)){if(!roleEvidence.includes(m[1])||!roleEvidence.includes(m[2]+'年'))throw new AppError('background_conflict',422,{stage:'business',reason:'unsupported_role_career'});}
 if(target==='realUser')for(const m of String(text).matchAll(/你(?:最近|之前|以前|正在|开始)?(?:学过|在学|学了|学习)([^，。！？？]{1,20})/g)){const claim=m[1].replace(/(?:啊|呀|吧|呢|来着|对吧|对吗|对不对|了|嘛)+$/,'').trim();if(!/什么|哪些/.test(claim)&&!provided.includes(claim))throw new AppError('background_conflict',422,{stage:'business',reason:'unconfirmed_user_memory'});}
 // A city of upbringing alone does not license a shared childhood scene.
 if(!(coordinates(background).forkAge===0||/从出生|出生时/.test(background.hypotheticalDirection||'')) && /那些[^。！？]{0,70}(?:玩耍|上学|放学)[^。！？]{0,30}(?:日子|时候)|小时候[^。！？]{0,60}(?:一起|常去|玩耍)/.test(text) && !/童年|小时候|儿时|玩耍/.test(provided))throw new AppError('background_conflict',422);
 if(/已保存到记忆|要记住这件事吗|已存入记忆/.test(text))throw new AppError('invalid_response',502);
 return text;
}
