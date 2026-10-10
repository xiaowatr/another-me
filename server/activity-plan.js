import {frequencyRule} from './frequency-proof.js';
// A bounded creative arrangement, not a record of attendance or a semantic fact extractor.
export function activityPlan(input){
 const o=input.constraints?.observation,w=o?.window,sources=input.sources||[],hyp=sources.find(s=>s.id==='hypotheticalDirection');
 if(!hyp||!Number.isInteger(w?.months)||w.months<1||w.months>12||w.weeks||w.anchor!=='fork')return null;
 if(/(?:大约|约|左右|最多|至少|缺席|不完整|不一定|半|不到|不足|不满)/.test(o.rawRange||hyp.text))return null;
 const verbs=[...hyp.text.matchAll(/(参加|去|(?:继续)?学)([^，。！？；\s]{1,20})/g)];
 if(verbs.length!==1)return null;const [,verb,target]=verbs[0];
 if(/[和及或、]|(?:另外|同时|之前|以后|之后)/.test(target)||/^(?:过|了|不)/.test(target))return null;
 const activity=verb+target,learning=verb.endsWith('学'),clauses=sources.filter(s=>['hypotheticalDirection','details','extra','followupAnswer'].includes(s.id)||s.id.startsWith('confirmation:')).flatMap(s=>s.text.split(/[。；，,\n]/).map(text=>({sourceRef:s.id,text:text.trim()})));
 const rates=clauses.filter(x=>frequencyRule(x.text));if(rates.length!==1)return null;const basis=rates[0],rule=frequencyRule(basis.text);
 if(!frequencyRule(sources.find(s=>s.id===basis.sourceRef)?.text))return null;
 if(rule.unit!=='月'||rule.count<1||rule.count>12||rule.count*w.months>24)return null;
 // Only a whole bare rate or a literal reference to the single specified activity binds.
 const residue=basis.text.replace(rule.quote,'').trim(),literal=residue.replace(activity,'').replace(target,'').trim();
 if(!['','课','课程'].includes(literal)||(!learning&&/课/.test(literal))||/(?:以前|过去|原来|不|取消|改成|如果|假如|打算|计划)/.test(residue))return null;
 if(learning&&/参加/.test(rule.quote)||!learning&&/上课|练习/.test(rule.quote))return null;
 const count=rule.count*w.months,occurrences=Array.from({length:count},(_,i)=>({ordinal:i+1,relativeMonth:Math.floor(i/rule.count)+1}));
 const first=[1],last=count===1?[]:[count],middle=occurrences.map(x=>x.ordinal).filter(i=>!first.includes(i)&&!last.includes(i));
 return {kind:'creative_arrangement',activity,sourceRefs:[hyp.id,basis.sourceRef,...(w.sourceRefs||[])].filter((x,i,a)=>a.indexOf(x)===i),frequencyQuote:rule.quote,months:w.months,perMonth:rule.count,totalCount:count,occurrences,chapterAssignments:[{chapter:'chapter1',activityOrdinals:first,focus:'开始一次活动'},{chapter:'chapter2',activityOrdinals:middle,focus:middle.length?'期间的活动与日常':count===1?'同一次活动之后的日常，不新增一次活动':'两次活动之间的日常，不新增一次活动'},{chapter:'chapter3',activityOrdinals:last,focus:count===1?'同一次活动之后的收尾，不新增一次活动':'最后一次活动及之后的收尾，不新增下一次活动'}]};
}
