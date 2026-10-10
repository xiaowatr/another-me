import {questionTime} from './question-context.js';
// Saved origin and current applicability are separate. No semantic or fuzzy inference here.
export const reuseFields=['birthYear','gender','mbti','forkAge','locationText','lifeStatus','lifeSituation','relatedExperience','choiceReason','details','additionalInfo','realityOutcome','hypotheticalDirection'];
export function reuseNode(b){const t=questionTime(b);return {birthYear:b.birthYear||'',forkAge:b.forkAge||'',year:t.year,tense:t.tense};}
export function readHistoryReuse(b){try{const x=JSON.parse(b.historyReuse||'{}');return Array.isArray(x.entries)?{...x,entries:x.entries.map(e=>({...e,sourceContext:e.sourceContext||x.origins?.[e.contextRef]}))}:{entries:[]};}catch{return {entries:[]};}}
export function serializeHistoryReuse(data){const origins={},entries=data.entries.map(({sourceContext,...e})=>{let ref=Object.keys(origins).find(k=>JSON.stringify(origins[k])===JSON.stringify(sourceContext));if(!ref){ref='origin'+Object.keys(origins).length;origins[ref]=sourceContext;}return {...e,contextRef:ref};});return JSON.stringify({...data,entries,origins});}
export function reuseApplicable(b){const x=readHistoryReuse(b);return JSON.stringify(x.targetNode)===JSON.stringify(reuseNode(b))&&x.targetContext?.realityOutcome===b.realityOutcome&&x.targetContext?.hypotheticalDirection===b.hypotheticalDirection;}
export function activeReuseEntries(b){const x=readHistoryReuse(b),sameNode=JSON.stringify(x.targetNode)===JSON.stringify(reuseNode(b));return x.entries.filter(e=>e.confirmed===true&&(e.kind==='answer'?reuseApplicable(b):b[e.field]===e.text&&(['birthYear','gender','mbti'].includes(e.field)||sameNode)));}
export function protectReuseOnEdit(before,after){
 if(JSON.stringify(reuseNode(before))===JSON.stringify(reuseNode(after)))return after;
 const next={...after};for(const e of readHistoryReuse(before).entries)if(e.kind==='field'&&!['birthYear','gender','mbti','forkAge','realityOutcome','hypotheticalDirection'].includes(e.field)&&next[e.field]===e.text){next[e.field]='';if(e.field==='lifeStatus')next.lifeStatusScope='';if(e.field==='lifeSituation')next.lifeSituationScope='';}
 return next;
}
export function activeReusedAnswers(b){return activeReuseEntries(b).filter(e=>e.kind==='answer').map(e=>({...e,id:e.sourceId,answerContext:null,question:e.question,purpose:e.purpose,meaning:'用户核对后确认适用于本次；原节点与原时间另存，不自动改为当前亲历'}));}
export function reuseProvenance(b,field){const e=activeReuseEntries(b).find(e=>e.kind==='field'&&e.field===field);return e?{origin:{lifeId:e.lifeId,node:e.sourceNode,context:e.sourceContext,timeScope:e.sourceTime,question:e.question,answer:e.text},applicability:{confirmed:true,node:reuseNode(b),meaning:'用户确认适用于本次；原时间不改写'}}:{};}
export function validateHistoryReuse(b){
 if(!b.historyReuse)return;
 if(typeof b.historyReuse!=='string'||b.historyReuse.length>40000)throw Error('reuse_input');
 JSON.parse(b.historyReuse);const x=readHistoryReuse(b),str=(v,n)=>typeof v==='string'&&v.length<=n;
 if(!x||!Array.isArray(x.entries)||x.entries.length>21||!x.targetNode||!x.targetContext||!str(x.targetNode.birthYear,4)||!str(x.targetNode.forkAge,3)||!str(x.targetContext.realityOutcome,1500)||!str(x.targetContext.hypotheticalDirection,1500))throw Error('reuse_input');
 const ids=new Set();
 for(const e of x.entries){if(!e||!['field','answer'].includes(e.kind)||e.confirmed!==true||!str(e.lifeId,100)||!str(e.sourceId,80)||!e.sourceId.startsWith('reuse:')||ids.has(e.sourceId)||!str(e.question,400)||!str(e.text,e.kind==='field'?1500:500)||!str(e.sourceTime,100)||!e.sourceNode||!str(e.sourceNode.birthYear,4)||!str(e.sourceNode.forkAge,3)||!e.sourceContext||!str(e.sourceContext.realityOutcome,1500)||!str(e.sourceContext.hypotheticalDirection,1500))throw Error('reuse_input');ids.add(e.sourceId);if(e.kind==='field'&&!reuseFields.includes(e.field))throw Error('reuse_input');if(e.kind==='answer'&&(!/^[A-Z]\d{2}$/.test(e.questionId)||!str(e.purpose,500)||!Array.isArray(e.selected)||e.selected.length>4||e.selected.some(t=>!str(t,100))||!e.text.trim()&&!e.selected.length))throw Error('reuse_input');}
}
