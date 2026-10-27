import {narrationAnchor,calendarActivitySequence} from './narrative-time.js';
import {ageNumber as number} from './age-facts.js';
const digits='[一二两三四五六七八九十\\d]+';
const clauses=t=>String(t||'').split(/[。！？；\n]/).map(x=>x.trim()).filter(Boolean);
const speculative=t=>/如果|假如|打算|计划|设想|想象|也许|可能|并非|不是|没有说|没说/.test(t);
const recollection=t=>/回忆|回想|想起|记起|记得|去年|当年|以前|另一门|别的课/.test(t);
const quoted=t=>/[“”「」『』"]/.test(t);
const anotherActor=t=>/(?:老师|朋友|同事|他|她|别人)的(?:第|课程?)|老师说|朋友说|同事说/.test(t);
const shifts={昨晚:-1,昨天晚上:-1,昨日晚上:-1,前晚:-2,前天晚上:-2,明晚:1,明天晚上:1};
// Only a direct assertion about the user's same numbered event, at the letter's
// final passage. A memory's yesterday or another person's evening is not proof.
export function narrationAnchorIssues(story,input){
 const anchor=narrationAnchor(input.sources||[]);if(!anchor?.eventOrdinal)return [];
 const i=(story.scenes||[]).length-1,scene=story.scenes?.[i];if(!scene)return [];
 const out=[];let otherCourseMemory=false;
 for(const quote of clauses(scene.text)){
  if(/回忆|回想|想起|记起/.test(quote)&&/另一门|别的课|去年|以前|当年/.test(quote))otherCourseMemory=true;
  if(/回到(?:今晚|当晚|眼前)|回过神|思绪.{0,4}(?:回来|拉回)/.test(quote))otherCourseMemory=false;
  if(otherCourseMemory)continue;
  if(quoted(quote)||speculative(quote)||recollection(quote)||anotherActor(quote))continue;
  for(const m of quote.matchAll(new RegExp('第('+digits+')(?:次|节)('+anchor.eventUnit+')?','g'))){
   if(number(m[1])!==anchor.eventOrdinal)continue;
   const before=quote.slice(0,m.index);
   const bound=m[2]===anchor.eventUnit||(!m[2]&&new RegExp('第'+digits+'(?:次|节)'+anchor.eventUnit+'.{0,12}(?:也就是|也即|即)$').test(before));
   if(!bound)continue;
   const after=quote.slice(m.index+m[0].length),forward=after.match(/^[，, ]*(?:(?:结束|完成|上完)[，, ]*)?(?:是|在|于|结束在|结束于)?(昨晚|昨天晚上|昨日晚上|前晚|前天晚上|明晚|明天晚上)/);
   const reverse=before.match(/(昨晚|昨天晚上|昨日晚上|前晚|前天晚上|明晚|明天晚上)(?:是|上了|完成了|结束了|的)?$/);
   const timeWord=forward?.[1]||reverse?.[1];if(!timeWord)continue;
   out.push({field:`scenes.${i}.text`,reason:'narration_anchor_conflict',proof:{kind:'narration_anchor',rule:{quote:anchor.quote,sourceRef:anchor.sourceRef},quote,eventOrdinal:anchor.eventOrdinal,eventUnit:anchor.eventUnit,timeWord,dayOffset:shifts[timeWord],calculation:`原话要求第${anchor.eventOrdinal}${anchor.eventUnit}结束当晚写信，正文却将同一事件说成${timeWord}，写信锚点发生偏移`}});
  }
 }
 return out.slice(0,2);
}
// Intro is a summary of this story, not an independent timeline. Require a
// source-backed exact course total plus a final-scene completion witness.
export function courseCompletionIssues(story,input){
 const sequence=calendarActivitySequence(input.sources||[]);if(!sequence)return [];
 const final=story.scenes?.at(-1);if(!final)return [];
 let bodyQuote=null;
 for(const block of String(final.text||'').split(/\n\s*\n/)){
  const named=[...block.matchAll(new RegExp('第('+digits+')(?:次|节)课','g'))].some(m=>number(m[1])===sequence.totalCount)||/最后一(?:次|节)课/.test(block);
  if(!named)continue;
  const positive=/课(?:程)?(?:已经|都|也|刚|全)?(?:上完|结束|结课)了/.exec(block)||new RegExp('第('+digits+')(?:次|节)课(?:结束|上完)(?=[，,。； ]|$)').exec(block);
  if(!positive)continue;
  const witness=block.slice(0,positive.index+positive[0].length);
  const completedTarget=[...witness.matchAll(new RegExp('第('+digits+')(?:次|节)课','g'))].some(m=>number(m[1])===sequence.totalCount)||/最后一(?:次|节)课/.test(witness);
  if(!completedTarget)continue;
  if(quoted(witness)||speculative(witness)||recollection(witness)||anotherActor(witness))continue;
  if(/下一期|另一门|其他课程|明年/.test(block.slice(0,positive.index)))continue;
  bodyQuote=block;break;
 }
 if(!bodyQuote)return [];
 const out=[];
 for(const field of ['intro','synopsis']){
  if(field==='synopsis'&&story.synopsis===story.intro)continue;
  for(const quote of clauses(story[field])){
   if(quoted(quote)||speculative(quote)||recollection(quote)||anotherActor(quote))continue;
   const neg=/(?:这(?:一)?轮(?:的)?课程?|课程?)(?:还|仍|尚)?(?:没有|没|未)(?:上完|结束|结课)/.exec(quote);if(!neg)continue;
   if(/下一期|另一门|别的课|下个月|以后/.test(quote.slice(Math.max(0,neg.index-18),neg.index)))continue;
   // The summary must bind itself to this complete story's exact number of lessons.
   if(![...String(story[field]).matchAll(new RegExp('(?:上了|上完|共|总共|一共)('+digits+')(?:次|节)(?:课)?','g'))].some(m=>number(m[1])===sequence.totalCount))continue;
   out.push({field,reason:'course_completion_conflict',proof:{kind:'course_completion',rule:{quote:sequence.totalQuote,sourceRefs:sequence.sourceRefs},expectedTotal:sequence.totalCount,quote,bodyField:`scenes.${story.scenes.length-1}.text`,bodyQuote,calculation:`同一轮共${sequence.totalCount}次，简介明确已上这些课却称未上完，末章明确最后一课已完成；简介须与正文一致`}});
  }
 }
 return out.slice(0,2);
}
export function consistencyProofGrounded(proof,input){
 if(!proof||typeof proof.quote!=='string')return false;
 if(proof.kind==='narration_anchor'){
  const a=narrationAnchor(input.sources||[]);return Boolean(a&&a.quote===proof.rule?.quote&&a.eventOrdinal===proof.eventOrdinal&&a.eventUnit===proof.eventUnit&&shifts[proof.timeWord]===proof.dayOffset&&proof.dayOffset!==0);
 }
 if(proof.kind==='course_completion'){
  const s=calendarActivitySequence(input.sources||[]);return Boolean(s&&s.totalCount===proof.expectedTotal&&s.totalQuote===proof.rule?.quote&&typeof proof.bodyQuote==='string'&&proof.bodyQuote);
 }
 return false;
}
