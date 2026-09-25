import {safeOpeningAddress} from './participant-identity.js';
import {storyClock,beyondStoryEnd} from './story-clock.js';
import {scenePhase} from './input-anchors.js';
import {replacementIssues,durationIssues,placementIssues,relevantAnswer} from './consistency.js';
﻿import {coordinates} from './context.js';
const ended=/(去世|离世|过世|病故|身故|死亡|倒闭|停办|拆除)/;
const yearOf=text=>{const m=String(text).match(/((?:19|20)\d{2})年/);return m?Number(m[1]):null;};
export function criticalFacts(background,memories=[]){
 const c=coordinates(background),facts=new Map();
 const texts=[background.realityOutcome,background.details,background.choiceReason,relevantAnswer(background),...memories.filter(m=>m.type==='reality').map(m=>m.text)].filter(Boolean);
 for(const text of texts)for(const clause of text.split(/[。！？；，,\n]/)){
  if(/^(?:不改变|保留|维持|不要|不能|不希望|请)/.test(clause.trim()))continue;
  if(!ended.test(clause)||/希望|假如|如果|设定|没有去世|没去世|未去世/.test(clause))continue;
  const match=clause.trim().match(/^(?:现实中|现实里|现实|后来)?([\u4e00-\u9fa5A-Za-z]{1,12}?)(?:(?:在|于)?((?:19|20)\d{2})年|(?:在)?(同年|当年|那年))?(?:的)?(?:春天|夏天|秋天|冬天|春季|夏季|秋季|冬季|年底|冬|夏|秋|春)?(?:就|已经|已|因病)?(去世|离世|过世|病故|身故|死亡|倒闭|停办|拆除)/);
  if(!match)continue;
  const subject=match[1],year=match[2]?Number(match[2]):match[3]?c.forkYear:null;
  facts.set(subject,{subject,year,event:match[4],text:clause.trim(),source:'user'});
 }
 // Only an explicit alternative involving the event authorizes changing it.
 const direction=background.hypotheticalDirection||'';
 const override=/(?:不再去世|没有去世|没去世|仍然健在|仍健在|还活着|复活|救活|避免死亡|没有倒闭|不停办|没有拆除)/.test(direction);
 return {events:[...facts.values()],overrideExplicit:override};
}
export function inspectFactText(text,background,{frame='chat',anchorYear,memories=[]}={}){
 const c=coordinates(background),now=new Date().getFullYear(),year=anchorYear===null?null:anchorYear??(frame==='story'?c.forkYear:now),age=c.birthYear!=null&&year!=null?year-c.birthYear:null;
 const issues=[...replacementIssues(text,background),...durationIssues(text),...placementIssues(text,background)],facts=criticalFacts(background,memories);
 const source=[background.realityOutcome,background.details,background.choiceReason,relevantAnswer(background),...memories.filter(m=>m.type==='reality').map(m=>m.text)].join(' ');
 if(/(?:不要|不写|禁止|不得|不编造)[^。；]{0,25}(?:临终|遗言|葬礼|病情|最后一面)/.test(source)&&facts.events.some(f=>/去世|离世|过世|病故|身故|死亡/.test(f.event))){for(const word of ['临终','最后一程','最后一面','最后一次见面','灵堂','葬礼','抢救','病情突然恶化','病情恶化','查出来','确诊','没人告诉我'])if(String(text).split(/[。！？；\n]/).some(line=>line.includes(word)&&!/(?:害怕|很怕|担心|如果|假如|没有见到|并未见到|不是最后)/.test(line))&&!source.includes(word))issues.push('unsupported_terminal_scene');}
 for(const sentence of String(text||'').split(/(?<=[。！？；\n])/)){
  if(/(?:遗憾|难过|后悔)[^。！？]{0,100}(?:带着|伴着|跟着)[^。！？]{0,10}一辈子/.test(sentence))issues.push('permanent_regret_assertion');
  if(/(?:后悔|遗憾|难过)[^。！？]{0,8}(?:一辈子|永远)|(?:永远|一辈子)[^。！？]{0,8}(?:后悔|遗憾|难过)/.test(sentence)&&!/(?:不会|不必|不一定|不是)/.test(sentence))issues.push('permanent_regret_assertion');
  const retrospective=sentence.match(/(?:上次|以前|那时|当时|那年|曾经)[^。！？]{0,24}?(\d{1,3})岁/);
  if(age!=null&&retrospective&&Number(retrospective[1])>age)issues.push('future_age_in_memory');
  const presentAge=sentence.match(/(?:我|我们)?(?:现在|今年|如今)[^。！？]{0,8}?(\d{1,3})岁/);
  if(frame==='chat'&&age!=null&&presentAge&&Math.abs(Number(presentAge[1])-age)>1)issues.push('wrong_present_age');
  if(facts.overrideExplicit)continue;
  for(const fact of facts.events){
   const reference=sentence.includes(fact.subject)||(facts.events.length===1&&/[她他它]/.test(sentence));
   if(!reference)continue;
   const explicit=yearOf(sentence),recent=frame==='chat'&&/(刚|今年|最近|这几天|上周|昨天|今天|上个月|现在|这些年|每年都)/.test(sentence);
   const recurring=/(?:之后|后来|此后)?每年|每次放假|每逢.{0,5}假期/.test(sentence);
   const when=explicit??(recent?year:frame==='story'?year:null);
   const remembered=/(回忆|想起|那年|当年|梦里|照片里|怀念|祭|墓|遗像)/.test(sentence);
   const wish=/(希望|愿望|想以后|想明年|打算|我明年|说明年|说.*明年|如果|假如)/.test(sentence);
   const denied=/(?:没有|没再|不能|不可能|不会|不再|并未|不是|未曾)[^。！？]{0,20}(?:陪|一起|合影|拍照|过节|过中秋|工作|上课)/.test(sentence);
   const interaction=/(陪|一起|合影|拍照|通电话|聊天|过节|过中秋|看望|见到|上班|工作|上课|仍然健在|仍健在|还活着)/.test(sentence);
   if(fact.year!=null&&when!=null&&(when>fact.year||(recurring&&year!=null&&year>=fact.year))&&interaction&&!remembered&&!wish&&!denied)issues.push('event_after_known_end');
  }
 }
 return [...new Set(issues)];
}
export function reviewStory(story,background,memories=[],{strictTime=false}={}){
 const issues=[],trusted={intro:'',character:'',scenes:[],future:[]};const c=coordinates(background);let lastYear=c.forkYear;
 if(strictTime&&c.birthYear!=null){
  for(const clause of String(story.identity||'').split(/[。；，]/)){
   const match=clause.match(/(\d{1,3})岁/);if(!match)continue;
   const explicit=yearOf(clause),past=/那年|当时|暑假|夏天|回忆|曾经/.test(clause),present=/现在|如今|今年|此刻/.test(clause);
   const anchor=explicit??(present?storyClock(background,story).year:past?c.forkYear:storyClock(background,story).year);
   if(anchor!=null&&Math.abs(Number(match[1])-(anchor-c.birthYear))>1)issues.push({field:'identity',reasons:[present?'wrong_present_age':'age_year_conflict']});
  }
 }
 for(const key of ['intro','character']){const risk=inspectFactText(story[key],background,{frame:'story',anchorYear:yearOf(story[key])??lastYear,memories});if(risk.length)issues.push({field:key,reasons:risk});else trusted[key]=story[key]||'';}
 for(const [i,scene] of (story.scenes||[]).entries()){
  if(scenePhase(scene,background)==='future'){trusted.future.push({...scene,modality:'possible'});continue;}
  const explicit=yearOf(scene.time);if(explicit)lastYear=explicit;
  else if(!/同年|次年|翌年/.test(scene.time||''))lastYear=null;
  if(/次年|翌年/.test(scene.time||'')&&lastYear!=null)lastYear++;
  const risk=inspectFactText(scene.text,background,{frame:'story',anchorYear:lastYear,memories});
  // A missing calendar year is uncertainty, not a contradiction in user background.
  // Preserve the complete scene and its original label; never invent an anchor.
  if(risk.length)issues.push({field:'scenes.'+i,reasons:[...new Set(risk)]});else trusted.scenes.push({...scene,time:explicit||(lastYear!=null&&/同年|次年|翌年/.test(scene.time))?scene.time:`${lastYear?'约'+lastYear+'年':'年份未明确'} · ${scene.time}`});
 }
 const openingIssues=inspectFactText(story.opening,background,{frame:'chat',memories,anchorYear:storyClock(background,story).year});
 if(openingIssues.length)issues.push({field:'opening',reasons:openingIssues});
 return {issues,trusted,openingSafe:!openingIssues.length};
}
export function currentOpening(story,background){
 const end=storyClock(background,story);if(beyondStoryEnd(story.opening||'',end)&&!/如果|计划|打算|希望/.test(story.opening||''))return '我在这里。刚说完这段日子，你想从哪件事聊起？';
 if(story.openingVersion===2 && story.opening?.trim() && !inspectFactText(story.opening,background).length)return safeOpeningAddress(story.opening,background);
 const year=coordinates(background).forkYear;
 // A clearly current and consistent opening can be reused verbatim. Old openings stay in the story view.
 if(/现在|如今|此刻/.test(story.opening||'')&&!inspectFactText(story.opening,background).length&&!/今年暑假|今年夏天/.test(story.opening))return safeOpeningAddress(story.opening,background);
 return year?`我在这里。那条路已经走过来了，${year}年的事，可以慢慢说。`:'我在这里。那条路已经走过来了，你想从哪里聊起？';
}
export function sceneTimeLabel(time,background){if(scenePhase({time},background)==='future'&&!/未来设想/.test(time))return '未来设想 · '+time;if(/\d{4}年|同年|次年|翌年/.test(time))return time;return /年份未明确/.test(time)?time:`${time} · 年份未明确`;}
