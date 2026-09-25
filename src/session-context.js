import {storyClock} from './story-clock.js';
import {criticalFacts,reviewStory,inspectFactText} from './fact-frame.js';
import {coordinates} from './context.js';
import {activeBackground} from './background.js';
import {timelineInput} from './story-input.js';
export function chatClock(background,now=new Date(),story=null){if(story)return storyClock(background,story);const year=now.getFullYear(),birth=Number(background.birthYear);return {mode:'present',asOf:now.toISOString().slice(0,10),year,approxAge:/^\d{4}$/.test(background.birthYear||'')&&birth<=year?year-birth:null};}
export function chatIdentity(background,story){const t=chatClock(background,undefined,story);if(story)return `故事结束时${t.year?` · ${t.year}年${t.month?`${t.month}月`:""}`:""}${t.approxAge!=null?` · 大约${t.approxAge}岁`:""}`;return t.approxAge==null?'此刻，走过那条路的我':`现在的我 · 大约${t.approxAge}岁`;}
export function historyRisk(text,background={},memories=[],story=null){
 const factRisk=inspectFactText(text,background,{memories,...(story?{anchorYear:storyClock(background,story).year}:{})});if(factRisk.length)return factRisk[0];
 const conditional=/(?:如果|要是|假如)[^。！？\n]{0,16}(?:那年|当年|当初|那次)[^。！？\n]{0,12}(?:我|我们)([^。！？\n]{0,30})/.exec(text);
 const dir=background.hypotheticalDirection||'';const actions=['回','回去','答应','接受','学习','报考','选择','留下','离开'];
 const negative=(value,action)=>new RegExp('(?:没(?:有)?|不|未曾|未能)'+action).test(value);
 if(conditional && actions.some(action=>dir.includes(action)&&conditional[1].includes(action)&&negative(conditional[1],action)===negative(dir,action)))return 'past_counterfactual';
 if(/(?:如果|要是|假如)[^。！？]{0,25}(?:我|我们)/.test(text))return null;
 const original=background.realityOutcome||'',direction=background.hypotheticalDirection||'';
 for(const match of original.matchAll(/(?:没(?:有)?|未曾|未能|不曾)(回去|回家|回|答应|接受|学习|报考|选择|留下|离开)/g)){const action=match[1];if(direction.includes(action)&&new RegExp('(?:我|我们)[^。！？]{0,12}(?:没(?:有)?|未曾|未能|不曾)'+action).test(text))return 'reversed_choice';}
 return null;
}
export function safeHistory(history,background,memories=[],story=null){return history.filter(m=>m.role==='user'||!historyRisk(m.content,background,memories,story)).slice(-12);}
export function lifeContext(background,story,memories=[]){const b=activeBackground(background),t=timelineInput(b),review=reviewStory(story,b,memories),clock=chatClock(b,undefined,story);const atEnd=(review.trusted.future||[]).filter(s=>{const d=s.time.match(/((?:19|20)\d{2})年(?:(\d{1,2})月)?/);return d&&clock.year&&(Number(d[1])<clock.year||Number(d[1])===clock.year&&(!d[2]||!clock.month||Number(d[2])<=clock.month));});review.trusted.scenes.push(...atEnd.map(s=>({...s,modality:'fictional_experience'})));review.trusted.future=review.trusted.future.filter(s=>!atEnd.includes(s));return {
 identityMap:{assistant:{id:'parallelCharacter',pronoun:'我',meaning:'助手只扮演这条平行人生的角色'},user:{id:'realUser',pronoun:'你',meaning:'正在对话的现实用户，不是故事里的朋友或同事'},thirdPersons:{meaning:'朋友、同事等是各自世界中的第三人；用姓名或关系称谓，不将其替换为对话用户'},storyVoice:'故事正文和开场的第一人称属于平行角色；角色与朋友的经历不等于与现实用户共同经历'},
 criticalFacts:criticalFacts(b,memories),
 sharedBeforeFork:{scope:coordinates(b).forkAge===0||/从出生|出生时/.test(b.hypotheticalDirection||'')?'从出生开始不同；现实成长经历不是共同前情':'只共享选择之前已明确的经历',birthYear:b.birthYear||null,gender:b.gender&&b.gender!=='不透露'?b.gender:null,locationAtFork:b.locationText||null,reportedSpeech:t.atFork.reportedSpeech},
 realUser:{lifeSituation:b.lifeSituation||null,events:t.atFork.eventAndMotivation,laterEvents:t.realityLater,feelings:t.atFork.feelings,unclassifiedSupplement:t.unclassifiedSupplement,confirmed:memories.filter(m=>m.type==='reality')},
 parallelCharacter:{chosenDirection:b.hypotheticalDirection,statedPossibilities:t.imagined.considerations,explicitPremises:t.imagined.explicitPremises,experienceScope:'只以storyFacts中已发生的角色经历为亲历；chosenDirection本身不证明出发或抵达',storyFacts:review.trusted,confirmed:memories.filter(m=>m.type==='fiction'&&!inspectFactText(m.text,b,{frame:'story',anchorYear:m.sourceYear??coordinates(b).forkYear,memories}).length && !inspectFactText(m.text,b,{memories}).length)},
 fork:coordinates(b),chatTime:clock,preferences:memories.filter(m=>m.type==='preference'),unknown:['未明确的现实背景保持未知；平行角色可合理补全不冲突的日常经历，不擅改关键事件','现实中的独立事件不因主角改变一个选择就自动改变；明确的改写设定除外'],
 };}

// Qualify year-based present ages only; preserve historical ages and original story text.
export function qualifyCurrentAge(text,background,story){const age=chatClock(background,undefined,story).approxAge;if(age==null||!/(?:现在|今年|如今|目前)/.test(text))return text;return text.replace(new RegExp('(?<![0-9])'+age+'岁','g'),(match,offset)=>/(?:大约|大概|约|差不多|将近)$/.test(text.slice(Math.max(0,offset-4),offset))||/^左右/.test(text.slice(offset+match.length))?match:'大约'+match);}
