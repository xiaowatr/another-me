import {questionMeaning} from './question-meaning.js';
import {supplementState} from './supplementary.js';
import {questionHistory} from './question-history.js';
import {QUESTION_BY_ID} from './question-bank.js';
import {questionTime} from './question-context.js';
import {reuseNode,reuseFields,validateHistoryReuse,activeReuseEntries,activeReusedAnswers,serializeHistoryReuse} from './history-reuse-data.js';
export const reuseFieldLabels={realityOutcome:'现实中发生了什么？',hypotheticalDirection:'这次，你想改变哪件事？',birthYear:'出生年份',forkAge:'当时年龄',gender:'性别',locationText:'变化发生前的所在地',mbti:'MBTI',lifeStatus:'那时，你的生活是什么状态？',lifeSituation:'愿意再说具体一点吗？',relatedExperience:'在这件事之前，你有过哪些相关经历？',choiceReason:'当时为什么会这样？',details:'有什么希望故事遵守的？',additionalInfo:'还有什么想补充的？'};
export function historyCandidates(life){
 const b=life.background||{},node=reuseNode(b),time=questionTime(b).tense==='future'?'现实现在':'分叉点当时';
 const fields=reuseFields.filter(field=>typeof b[field]==='string'&&b[field].trim()).map(field=>({id:'field:'+field,kind:'field',field,question:questionTime(b).tense==='future'&&['locationText','forkAge','lifeStatus','choiceReason'].includes(field)?{locationText:'现实现在的所在地',forkAge:'设想发生时的年龄',lifeStatus:'你现在的生活是什么状态？',choiceReason:'为什么想尝试这个改变？'}[field]:reuseFieldLabels[field],text:b[field],selected:[],sourceTime:field==='relatedExperience'?'事件之前':field==='lifeStatus'?b.lifeStatusScope==='now'?'现实现在':'分叉点当时':field==='lifeSituation'?b.lifeSituationScope==='now'?'现实现在':'分叉点当时':time,defaultSelected:['birthYear','gender','mbti'].includes(field)}));
 const answers=questionHistory(b).rows.filter(r=>r.kind==='追问'&&!r.skipped&&r.answered&&QUESTION_BY_ID[r.id]&&(r.text.trim()||r.selected.length)).map(r=>({id:'answer:'+r.id,kind:'answer',questionId:r.id,question:r.question,text:r.text,selected:r.selected,...questionMeaning(QUESTION_BY_ID[r.id],supplementState(b).questionMeta?.[r.id]),sourceTime:r.timeScope?r.timeScope.tense==='future'?'现实现在':'分叉点当时':supplementState(b).questionMeta?.[r.id]?.tense==='future'?'现实现在':supplementState(b).questionMeta?.[r.id]?.tense==='original'?'分叉点当时':'原记录未保存作答时间；参考原节点',defaultSelected:false}));
 const old=activeReuseEntries(b);const carried=activeReusedAnswers(b).filter(e=>!answers.some(a=>a.questionId===e.questionId)).map(e=>({...e,id:'answer:'+e.questionId,defaultSelected:false}));
 return [...fields,...answers,...carried].map((e,i)=>{const origin=e.kind==='field'?old.find(a=>a.kind==='field'&&a.field===e.field):e.lifeId?e:null;return {...e,lifeId:origin?.lifeId||life.id,sourceId:origin?.sourceId||'reuse:'+String(life.id).slice(0,48)+':'+i,sourceNode:origin?.sourceNode||node,sourceTime:origin?.sourceTime||e.sourceTime,sourceContext:origin?.sourceContext||{realityOutcome:b.realityOutcome||'',hypotheticalDirection:b.hypotheticalDirection||''}};});
}
export function historyNodeLabel(life){const b=life.background||{};return `${b.forkAge?b.forkAge+'岁':'年龄未填写'} · ${(b.realityOutcome||'事件摘要未保存').replace(/\s+/g,' ').slice(0,55)}`;}
export function applyHistoryReuse(background,candidates,selectedIds){
 const entries=candidates.filter(e=>selectedIds.includes(e.id)).map(({id,defaultSelected,...e})=>({...e,confirmed:true}));
 let b={...background};for(const e of entries.filter(e=>e.kind==='field')){b[e.field]=e.text;if(e.field==='lifeStatus')b.lifeStatusScope=e.sourceTime==='现实现在'?'now':'at_fork';if(e.field==='lifeSituation')b.lifeSituationScope=e.sourceTime==='现实现在'?'now':'at_fork';}
 // Only this draft changes. Old histories, supplements and memories are never mutated.
 b={...b,coreConfirmAttempts:'',clarificationAppliedAnswer:'',followupKey:'',followupQuestion:'',followupAnswer:'',followupSkipped:'',historyReuse:serializeHistoryReuse({targetNode:reuseNode(b),targetContext:{realityOutcome:b.realityOutcome,hypotheticalDirection:b.hypotheticalDirection},entries})};
 validateHistoryReuse(b);return b;
}

export function historySources(lives){return lives.map((life,index)=>({life,index,at:Date.parse(life.sessionMeta?.filledAt||life.createdAt||'')||0})).sort((a,b)=>a.at-b.at||a.index-b.index).map(x=>x.life);}
