import {reuseProvenance,activeReusedAnswers} from '../src/history-reuse-data.js';
import {questionTitle} from '../src/question-context.js';
import {lifeBackgroundEntries} from '../src/life-background.js';
import {QUESTION_BANK} from '../src/question-bank.js';
import {activityPlan} from './activity-plan.js';
import {frequencyRule} from './frequency-proof.js';
import {CHAPTER_POSITIONS} from './story-time-labels.js';
import {supplementState,supplementKey,unknownAnswer} from '../src/supplementary.js';
import {normalizeScenarioAnalysis,scenarioKey} from '../src/scenario-context.js';
import {generationSetting} from '../src/effective-setting.js';

// Organize existing evidence; do not infer facts or parse new free-text constraints.
export function generationInput(c){
 const b=c.original,p=c.personalization,state=supplementState(b),sources=[];
 const add=(id,text,scope,extra={})=>{if(typeof text==='string'&&(text.trim()||extra.selected?.length))sources.push({id,text,scope,...extra});};
 const ordinary=(p.answers||[]).filter(a=>!a.answerContext||(a.answerContext.realityOutcome===b.realityOutcome&&a.answerContext.hypotheticalDirection===b.hypotheticalDirection));
 add('realityOutcome',b.realityOutcome,'现实事件对照');
 add('hypotheticalDirection',b.hypotheticalDirection,'指定假设');
 for(const id of ['birthYear','forkAge','locationText','gender','mbti','lifeStatus','lifeSituation','relatedExperience','choiceReason','details','additionalInfo']){const entry=lifeBackgroundEntries(b).find(e=>e.field===id);add(id,b[id],id==='details'?'补充原话':'表单原话',{...(entry?{actor:entry.actor,timeScope:entry.timeScope}:{}),...reuseProvenance(b,id)});}
 for(const a of ordinary)add(a.id,a.text||'','普通回答',{selected:a.selected||[],question:a.question,timeScope:a.timeScope||a.sourceTime,actor:'real_user',...(a.lifeId?{origin:{lifeId:a.lifeId,node:a.sourceNode,context:a.sourceContext,questionId:a.questionId,question:a.question},applicability:{confirmed:true}}:{})});
 for(const [i,text]of (p.confirmations||[]).entries())add('confirmation:'+i,text,'明确确认');
 add('extra',p.extra,'补充要求');
 const latest=p.latestConfirmation||{question:'',answer:'',skipped:false};
 if(!latest.skipped)add('followupAnswer',latest.answer,'最新确认');
 const refs=id=>sources.some(s=>s.id===id)?[id]:[];
 const actualAnswers=ordinary.filter(a=>!unknownAnswer([...(a.selected||[]),a.text||''].filter(Boolean).join('；')));
 const scopedIds=new Set(actualAnswers.flatMap(a=>[a.id,...(a.questionId?[a.questionId]:[])]));
 const gaps=(p.settingRecord?.criticalBackground||[]).map(g=>{
  const answer=g.answer,answerId=answer?.questionId||answer?.sourceId;
  const active=answerId&&sources.some(s=>s.id===answerId&&[...(s.selected||[]),s.text].filter(Boolean).join('；').includes(answer.text));
  return {key:g.key,questionId:g.questionId||null,missingInformation:g.missingInformation,useInStory:g.useInStory,question:g.questionText||null,status:g.status==='answered'&&!active?'unconfirmed':g.status,sourceRef:g.sourceId,evidence:g.evidence,...(active?{answerRef:answerId,answerQuote:answer.text}:{})};
 });
 const skipped=(p.skipped||[]).filter(id=>!state.answerScopes?.[id]||(state.answerScopes[id].realityOutcome===b.realityOutcome&&state.answerScopes[id].hypotheticalDirection===b.hypotheticalDirection)).map(id=>({id,status:'skipped',question:QUESTION_BANK.find(q=>q.id===id)?questionTitle(QUESTION_BANK.find(q=>q.id===id),state.questionMeta?.[id],b):state.questionMeta?.[id]?.questionText||null,timeScope:state.answerScopes?.[id]?.timeScope||null}));
 const g=generationSetting(c),t=g.temporal;
 const start=t.start?{year:t.start.estimated?null:t.start.year,month:t.start.month,...(t.start.day?{day:t.start.day}:{}),sourceRef:t.start.field||null,estimated:Boolean(t.start.estimated)}:null;
 let window=t.window?{months:t.window.months,...(t.window.weeks?{weeks:t.window.weeks}:{}),anchor:t.window.anchor,start:t.window.start,end:t.window.end,precision:t.window.precision,sourceRefs:[...new Set((t.window.sources||[]).map(s=>s.field.replace(/^supplementary\./,'')))]}:null;
 if(window&&window.sourceRefs.some(id=>!sources.some(s=>s.id===id)))window=null;
 if(window&&(t.start?.estimated||window.precision==='unknown-month'))window={...window,start:t.start?.estimated?null:window.start,end:null,calendarBoundsKnown:false};
 const sc=state.scenario,analysis=sc&&sc.scopeKey===supplementKey(b)&&!sc.skipped&&sc.analysis?.key===scenarioKey(sc)?normalizeScenarioAnalysis(sc.analysis,sc):null;
 const behavior=(p.behaviorReferences||[]).map((r,i)=>({...r,source:{id:sc?.id,evidence:analysis?.considerations[i]?.evidence,conditionEvidence:analysis?.considerations[i]?.conditionEvidence}})).filter(r=>r.source.evidence);
 const expressionRefs=sources.filter(s=>s.text.trim()&&(['realityOutcome','hypotheticalDirection','details','additionalInfo','choiceReason','extra','followupAnswer'].includes(s.id)||s.id.startsWith('confirmation:')||scopedIds.has(s.id))).map(s=>s.id);
 const questionIds=[...new Set([...state.shown,...(state.plan?.generationUnknowns||[]).map(q=>q.id),...(state.plan?.covered||[]).map(q=>q.id),...gaps.map(q=>q.questionId).filter(Boolean),...QUESTION_BANK.map(q=>q.id)])];
 const questionStates=questionIds.map(id=>{const a=state.answers?.[id],shown=state.shown.includes(id),reviewedOut=(state.plan?.generationUnknowns||[]).some(q=>q.id===id)||(state.plan?.covered||[]).some(q=>q.id===id);return {id,status:skipped.some(q=>q.id===id)?'skipped':scopedIds.has(id)?'answered':a&&unknownAnswer([...(a.selected||[]),a.text||''].filter(Boolean).join('；'))?'unconfirmed':shown?'unanswered':reviewedOut?'unconfirmed':'unasked',displayStatus:shown?'shown':reviewedOut?'reviewed_out':'not_shown',...(scopedIds.has(id)?{answerRef:actualAnswers.find(a=>a.questionId===id)?.id||id}:{})};});
 const frequencyStatements=sources.filter(s=>s.timeScope!=='before_this_event').flatMap(s=>{const rule=frequencyRule(s.text);return rule?[{sourceRef:s.id,quote:rule.quote,unit:rule.unit,count:rule.count}]:[];});
 const input={title:'本次设定与约束',version:5,sources,
  reality:{eventReferenceRefs:refs('realityOutcome'),providedBackgroundRefs:['birthYear','forkAge','locationText','gender','lifeStatus','lifeSituation','relatedExperience','choiceReason','details','additionalInfo'].flatMap(refs),lifeBackground:lifeBackgroundEntries(b).map(({text,...entry})=>entry)},
  parallel:{roleGender:c.roleGender,changeRefs:refs('hypotheticalDirection'),operation:c.operation,eventFacts:c.facts,retained:c.retained,priorityRefs:[...refs('followupAnswer'),...sources.filter(s=>s.id.startsWith('confirmation:')).map(s=>s.id)]},
  constraints:{observation:{start,window,rawRange:c.timeRange,chapterPositions:CHAPTER_POSITIONS,sourceRefs:refs('hypotheticalDirection')},frequencyAndOtherLimitRefs:['hypotheticalDirection','details',...ordinary.map(a=>a.id),'extra',...sources.filter(s=>s.id.startsWith('confirmation:')).map(s=>s.id),'followupAnswer'].flatMap(refs),frequencyStatements,totalCount:null},
  unknownBackground:{backgroundEvidence:{dimensions:['职业与就业','家庭构成','学习前史','既往关系与共同经历','个人习惯'],sourceRefs:sources.filter(s=>!['birthYear','forkAge','locationText','gender','mbti','hypotheticalDirection'].includes(s.id)).map(s=>s.id),assumptionRefs:refs('hypotheticalDirection'),answerRefs:actualAnswers.map(a=>a.id)},questionStates,critical:gaps,skipped,reviewedOutQuestions:(state.plan?.generationUnknowns||[]).filter(q=>q&&typeof q.id==='string'&&typeof q.question==='string'&&typeof q.missingInformation==='string'&&typeof q.useInStory==='string').slice(0,8).map(q=>({id:q.id,question:q.question.slice(0,300),missingInformation:q.missingInformation.slice(0,300),useInStory:q.useInStory.slice(0,300),status:scopedIds.has(q.id)?'answered':skipped.some(x=>x.id===q.id)?'skipped':'unconfirmed',...(scopedIds.has(q.id)?{answerRef:q.id}:{})})),latestConfirmation:{question:latest.question,skipped:latest.skipped,answerRefs:latest.skipped?[]:refs('followupAnswer')},choiceReasonKnown:refs('choiceReason').length>0},
  behaviorAndLanguage:{ordinaryAnswers:actualAnswers.filter(a=>scopedIds.has(a.id)).map(a=>({sourceRef:a.id,question:a.question,purpose:a.purpose,answerKind:a.answerKind||'user_answer'})),scenarioBehavior:behavior,scenarioTimeScope:sc?.timeScope||null,expressionSourceRefs:expressionRefs,mbti:g.style.mbti},
  fixedDisplay:fixedStoryIdentity(c)};
 input.constraints.activityPlan=activityPlan(input);return input;
}
export function fixedStoryIdentity(c){
 const location=c.coordinates.locationAtFork;
 return {identity:['另一个自己',...(location?['当时所在地或环境：'+location]:[])].join(' · '),basis:location?['产品本人主角定义','locationText']:['产品本人主角定义']};
}
export function fillStoryIdentity(story,c){return {...story,identity:fixedStoryIdentity(c).identity};}
