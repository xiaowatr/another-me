import {isIdentityCorrection} from './participant-identity.js';
// Explicit, bounded checks; not a natural-language fact verifier.
const number=s=>/^\d+$/.test(s)?Number(s):({'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10}[s]??null);
export function durationIssues(text){const issues=[];for(const m of String(text).matchAll(/((?:19|20)\d{2})年(?:至|到|—|-)s*((?:19|20)\d{2})年[^。！？；\n]{0,25}?(?:共|整整|持续了?|工作了|住了|待了)([\d一二两三四五六七八九十]+)年/g)){const n=number(m[3]);if(n!=null&&(Number(m[2])<Number(m[1])||n!==Number(m[2])-Number(m[1])))issues.push('explicit_year_duration');}return issues;}
export function relevantAnswer(b){return !b.followupSkipped?b.followupAnswer||'':'';}
export function placementFacts(b){const text=[b.details,relevantAnswer(b)].filter(Boolean).join('。');return [...text.matchAll(/(妻子|丈夫|伴侣|爱人|父亲|母亲)(?:留|待)?在岸上(?:照顾|陪伴|带着)?孩子/g)].map(m=>({subject:m[1],place:'岸上'}));}
export function placementIssues(text,b){return placementFacts(b).filter(f=>new RegExp(f.subject+'[^。！？]{0,10}(?:随船|上船|跟船|在船上|一起出海)').test(text)&&!new RegExp(f.subject+'[^。！？]{0,8}(?:没|不|未)[^。！？]{0,5}(?:随船|上船|跟船|在船上|出海)').test(text)).map(()=> 'explicit_location_conflict');}
export function inputConflicts(b){const text=[b.hypotheticalDirection,b.details].join('。'),answer=relevantAnswer(b);const out=[];for(const person of ['妻子','丈夫','伴侣','爱人','父亲','母亲']){const parts=(answer.includes(person)?answer:text).split(/[。！？；]/);const shore=parts.some(s=>new RegExp(person+'[^。！？]{0,10}在岸上').test(s)&&!/(?:不在|没有在)/.test(s));const aboard=parts.some(s=>new RegExp(person+'[^。！？]{0,10}(?:随船|一起出海)').test(s)&&!/(?:不|没|未)[^。！？]{0,5}(?:随船|一起出海)/.test(s));if(shore&&aboard)out.push(person+'是在岸上，还是一起出海');}return out;}
export function recallTarget(message){return /(?:记得|记住|记忆).{0,10}我|我.{0,10}(?:学了什么|喜欢什么|住在哪|做什么工作)/.test(message)?'realUser':null;}

export function replacementIssues(text,b){
 if(!/(?:改为我|换成我)/.test(b.hypotheticalDirection||''))return [];
 const real=b.realityOutcome||'';const actor=real.match(/(邻居|朋友|同学|同事|他|她)(?:那次|当时)?(?:中了|中|获得|被录取)/)?.[1];if(!actor)return [];
 const event=/中.{0,6}奖/.test(real)?'中[^。！？]{0,6}奖':/被录取/.test(real)?'被录取':null;if(!event)return [];
 return String(text).split(/[。！？；，,\n]/).some(s=>{
  if(/(?:原本|本来|现实中)/.test(s))return false;
  const claim=new RegExp(actor+'([^。！？]{0,10}?)'+event).exec(s);
  return claim && !/(?:不|没|未)(?:再|曾|能|有)?$/.test(claim[1]);
 })?['replaced_actor_event']:[];
}

export function careerIssues(text,evidence){for(const m of String(text).matchAll(/我(?:以前|曾经|之前)?在([^，。！？]{2,12}?)(?:工作|上班|待)(?:过|了)?([一二两三四五六七八九十\d]+)年/g))if(!evidence.includes(m[1])||!evidence.includes(m[2]+'年'))return ['unsupported_role_career'];return [];}

// A time directive followed by a question is still a directive; keep it across fact-context resets.
export function chatTimeCorrection(text){return String(text||'').split(/(?<=[。！？?\n])/).filter(t=>!/[？?]/.test(t)&&/(?:从|按|回到|回到故事里的)[^。！？\n]{0,35}(?:那天|当天|\d{1,2}月\d{1,2}日|(?:19|20)\d{2}年)[^。！？\n]{0,12}(?:聊|说起|开始)/.test(t)).join('').slice(0,2000);}
export function eventOrderCorrection(text){return String(text||'').split(/(?<=[。！？?\n])/).filter(t=>!/[？?]/.test(t)&&/(?:其实|纠正|更正)[^。！？\n]{0,12}(?:那次|当时|那天)[^。！？\n]{0,35}(?:前|后|尚未|还没)/.test(t)).join('').slice(0,2000);}
export function explicitCorrections(messages,start=0){const time=messages.filter(m=>m.role==='user'&&m.status!=='pending').map(m=>chatTimeCorrection(m.text||m.content)).filter(Boolean).slice(-1).map(text=>({type:'chat_time',text}));const order=messages.filter(m=>m.role==='user'&&m.status!=='pending').map(m=>eventOrderCorrection(m.text||m.content)).filter(Boolean).slice(-1).map(text=>({type:'event_order',text}));return [...messages.slice(start).filter(m=>m.role==='user'&&!['failed','pending'].includes(m.status)&&!/[？?]/.test(m.text||m.content||'')).flatMap(m=>{const t=m.text||m.content||'';const type=isIdentityCorrection(t)?'identity':/^(?:更正|纠正)(?:一下)?[：，\s]*(?:我的|现实|我)/.test(t)?'reality':/^(?:修改|纠正|更正)(?:一下)?[：，\s]*(?:你的|你|角色|另一个自己)/.test(t)?'fiction':null;return type?[{type,text:t.slice(0,2000)}]:[];}).slice(-18),...time,...order];}

export function replacementPremise(b){if(!/(?:改为我|换成我)/.test(b.hypotheticalDirection||''))return null;const text=b.realityOutcome||'',actor=text.match(/(邻居|朋友|同学|同事|他|她)(?:那次|当时)?(?:中了|中|获得|被录取)/)?.[1];if(!actor)return null;const event=/中.{0,6}奖/.test(text)?'中奖':/被录取/.test(text)?'被录取':null;return event?'本篇实际发生：我'+event+'；'+actor+'不'+(event==='中奖'?'中奖':'被录取')+'。这是替换，不是两人都'+event+'。':null;}
