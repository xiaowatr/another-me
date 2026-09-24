import {criticalFacts} from './fact-frame.js';
import {timelineInput} from './story-input.js';
﻿import {activeBackground} from './background.js';
import {coordinates} from './context.js';
// Explicit grammatical markers only. Unknown prose is retained, never silently interpreted as a known operation.
export function compileSetting(input){
 const b=activeBackground(input),timeline=timelineInput(b),direction=b.hypotheticalDirection||'',real=b.realityOutcome||'';
 const source=(field,text)=>({field,text});
 const replacement=direction.match(/(?:改为|换成)我([^，。；]+)/),addition=/(?:我也|我同样|同时)/.test(direction);
 const prior=real.match(/^(?:现实中)?(.{1,12}?)(?:那次|当时)([^，。；]+)/);
 let operation=replacement?'replace':addition?'add':/仅改变|只改变|只改/.test(direction)?'change':/^(?:保留|维持)/.test(direction)?'preserve':'unknown';
 const issues=[];if(replacement&&addition)issues.push('这次是替换原来的结果，还是两个人都经历这件事？');
 if(replacement&&!prior)issues.push('这次要替换谁原来的结果？请在现实经过中写清人物和那次发生的事。');
 const facts=[];
 if(replacement&&prior){facts.push({subject:'我',predicate:replacement[1],polarity:true,source:source('hypotheticalDirection',replacement[0])});if(prior[1]!=='我')facts.push({subject:prior[1],predicate:replacement[1],polarity:false,source:source('realityOutcome',prior[0])});}
 if(addition){const own=direction.match(/我(?:也|同样)([^，。；]+)/);if(own)facts.push({subject:'我',predicate:own[1],polarity:true,source:source('hypotheticalDirection',own[0])});if(prior)facts.push({subject:prior[1],predicate:prior[2],polarity:true,source:source('realityOutcome',prior[0])});}
 const retained=[];for(const [field,text] of [['details',b.details],['hypotheticalDirection',direction],['followupAnswer',b.followupSkipped?'':b.followupAnswer]])for(const clause of (text||'').split(/[。；]/).filter(Boolean)){if(/不改变|保留|仍然|仍|不设定|不要/.test(clause))retained.push({text:clause,source:source(field,clause)});}
 // Explicit independently dated endings are retained without importing the alternative choice.
 const critical=criticalFacts(b);if(!critical.overrideExplicit)for(const event of critical.events){const field=['realityOutcome','details','choiceReason','followupAnswer'].find(k=>(b[k]||'').includes(event.text))||'realityOutcome';retained.push({text:event.text,source:source(field,event.text)});}
 const known=[];for(const clause of (b.details||'').split(/[。；]/).filter(Boolean))if(/^(我们|我|双方).*(原本|原来|当时|已经)/.test(clause))known.push({text:clause,source:source('details',clause)});
 const range=direction.match(/(?:只看|只写|仅写|仅看)([^。；]+)/)?.[1]||null;
 return {version:1,operation,change:{text:direction,source:source('hypotheticalDirection',direction)},facts,retained,known,timeRange:range,coordinates:coordinates(b),style:{mbti:b.mbti&&b.mbti!=='unknown'?b.mbti:null,gender:b.gender&&b.gender!=='不透露'?b.gender:null},supplement:timeline.unclassifiedSupplement.join('。'),considerations:timeline.imagined.considerations,reportedSpeech:timeline.atFork.reportedSpeech,explicitPremises:timeline.imagined.explicitPremises,answer:b.followupSkipped?'':b.followupAnswer||'',choiceReason:b.choiceReason||'',unknown:['未填写的现实身份与经历','未能用明确句式解析的语义仍需模型理解'],clarifications:issues,original:{...b}};
}
export function generationSetting(c){
 const clean=x=>x.map(({source,...item})=>item);
 return {version:c.version,operation:c.operation,change:c.change.text,facts:clean(c.facts),retained:clean(c.retained),known:clean(c.known),timeRange:c.timeRange,coordinates:c.coordinates,chatTime:{year:new Date().getFullYear(),approximateAge:c.coordinates.birthYear==null?null:new Date().getFullYear()-c.coordinates.birthYear},style:c.style,supplement:c.supplement,considerations:c.considerations,reportedSpeech:c.reportedSpeech,explicitPremises:c.explicitPremises,answer:c.answer,choiceReason:c.choiceReason,unknown:c.unknown};
}
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// Bounded event-owner check, not a full semantic verifier. Negation is attached to each predicate occurrence.
export function settingIssues(story,c){
 const issues=[];const fields=[...['title','synopsis','intro','character','opening'].map(field=>({field,text:story[field]||''})),...(story.scenes||[]).map((s,i)=>({field:'scenes.'+i,text:s.text}))];
 for(const fact of c.facts.filter(f=>!f.polarity)){
  const predicate=fact.predicate.split(/为|成为/)[0].replace(/了/g,'');if(!predicate||predicate.length>12)continue;
  const pattern=Array.from(predicate).map(escape).join('[^，。；！？]{0,2}');
  for(const {field,text} of fields){
   // A literal original outcome followed by an explicit contrast belongs to the real-world frame.
   const transition=text.search(/这一次|这次/),originalFirst=c.original.realityOutcome.split(/[，。；]/)[0];
   const effectiveText=transition>0&&originalFirst&&text.slice(0,transition).includes(originalFirst)?text.slice(transition):text;
   for(const clause of effectiveText.split(/[，。；！？\n]/)){
   const subject=clause.indexOf(fact.subject);if(subject<0||/现实中|原本|本来/.test(clause))continue;
   for(const m of clause.slice(subject+fact.subject.length).matchAll(new RegExp(pattern,'g'))){const before=clause.slice(subject+fact.subject.length,subject+fact.subject.length+m.index);if(!/(?:没|未|不)(?:有|再|曾|能)?$/.test(before))issues.push({field,reason:'effective_event_owner_conflict',subject:fact.subject});}
  }}
 }
 return issues;
}
