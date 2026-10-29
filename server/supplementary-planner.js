import {prepareCriticalReviewCandidates,criticalReviewCoverage} from './critical-review-candidates.js';
import {routeCriticalChoiceQuestions} from './question-routing.js';
import {unsupportedQuestionReason} from '../src/question-premises.js';
import {questionInput} from './question-input.js';
import {QUESTION_COMMON_RULES,QUESTION_SELECTION_TASK} from './question-prompts.js';
import {assertQuestionIds} from './question-contract.js';
import {activeReusedAnswers} from '../src/history-reuse-data.js';
import {lifeBackgroundEntries} from '../src/life-background.js';
import {KEY_QUESTION_BY_ID,mergeCriticalGaps,criticalGapStatus} from '../src/critical-background.js';
import {modelQuestionBank,resolveQuestionWording} from './question-wording.js';
import {optionalQuestionFallback} from '../src/question-recovery.js';
import {QUESTION_SELECTION_RULE,QUESTION_STOP_RULE,questionSelectionState,rankQuestions,validateQuestionAssessments} from './question-policy.js';
import {questionTime,questionTitle} from '../src/question-context.js';
import {questionReviewMessages,validateQuestionReview} from './question-review.js';
import {SCENARIO_BANK,SCENARIO_BY_ID} from '../src/scenario-bank.js';
import {BEHAVIOR,normalizeScenarioAnalysis,scenarioKey} from '../src/scenario-context.js';
import {createHash} from 'node:crypto';
import {RETIRED_QUESTION_IDS,QUESTION_BANK,QUESTION_BY_ID as ORDINARY_BY_ID} from '../src/question-bank.js';
const QUESTION_BY_ID={...ORDINARY_BY_ID,...KEY_QUESTION_BY_ID,...SCENARIO_BY_ID};
import {supplementState,supplementSources,answerText,unknownAnswer,validateSupplement,supplementKey,supplementaryContext} from '../src/supplementary.js';
import {timeAnchors} from '../src/input-anchors.js';
import {reviewedQuestionOptions} from '../src/question-options.js';
import {AppError} from './core.js';
export const PLANNER_VERSION='questions-v27';
export function plannerMessages(background){const state=supplementState(background),payload=questionInput(background);
 Object.assign(payload,{bank:modelQuestionBank(),scenarioBank:state.scenario?[]:SCENARIO_BANK,scenario:state.scenario?{id:state.scenario.id,question:SCENARIO_BY_ID[state.scenario.id]?.question,answer:state.scenario.answer,skipped:state.scenario.skipped}:null,recentScenarios:state.recentScenarios||[]});
 if(state.scenario?.answer?.trim()&&!state.scenario.skipped)payload.behaviorVocabulary=BEHAVIOR;
 return [{role:'system',content:QUESTION_COMMON_RULES+'\n'+QUESTION_SELECTION_TASK},{role:'user',content:JSON.stringify(payload)}];}
export function normalizePlan(raw,b,{addCriticalQuestions=true,reviewedCriticalIds=[]}={}){
 validateSupplement(b);assertQuestionIds(raw,'selection');if(!raw||!Array.isArray(raw.questions)||raw.questions.length>6||!Array.isArray(raw.covered))throw new AppError('invalid_response',502);
 const s=supplementState(b),policy=questionSelectionState(b),sources=new Map(supplementSources(b).map(x=>[x.id,x.text]));const anchored=(id,text)=>typeof text==='string'&&text.trim()&&text.length<=500&&sources.get(id)?.includes(text);
 const covered=raw.covered.filter(x=>x&&QUESTION_BY_ID[x.id]&&anchored(x.sourceId,x.evidence)).map(({id,sourceId,evidence})=>({id,sourceId,evidence}));
 const blocked=new Set([...s.shown,...activeReusedAnswers(b).map(a=>a.questionId),...covered.map(x=>x.id)]);if(timeAnchors(b).window?.sources?.length)blocked.add('G14');
 const groups=new Set([...blocked].map(id=>QUESTION_BY_ID[id]?.group));const questions=[];for(const id of RETIRED_QUESTION_IDS)blocked.add(id);const detailCount=s.shown.filter(id=>QUESTION_BY_ID[id]?.personalDetail).length;
 const routed=routeCriticalChoiceQuestions(raw,mergeCriticalGaps(s.criticalUnknowns?.length?s.criticalUnknowns:s.plan?.criticalUnknowns,raw.criticalUnknowns,supplementSources(b)),b);
 const criticalUnknowns=routed.criticalUnknowns;raw={...raw,questions:routed.questions};
 const unresolved=criticalUnknowns.filter(g=>criticalGapStatus(g,s,answerText,unknownAnswer).status!=='answered');
 if(addCriticalQuestions&&!s.scenario&&!policy.currentGroupSkipped&&policy.remaining>0){const gap=unresolved.find(g=>!g.resolvedBy&&!covered.some(x=>x.id===g.questionId)&&g.questionText&&criticalGapStatus(g,s,answerText,unknownAnswer).status!=='skipped'&&!s.shown.includes(g.questionId));if(gap){let id=gap.questionId;if(!id)id=Object.keys(KEY_QUESTION_BY_ID).find(k=>!s.shown.includes(k)&&!criticalUnknowns.some(x=>x.questionId===k));if(id&&QUESTION_BY_ID[id]&&!RETIRED_QUESTION_IDS.includes(id)){gap.questionId=id;questions.push({id,reason:gap.whyMissing,questionText:gap.questionText,informationGain:3,missingInformation:gap.missingInformation,useInStory:gap.useInStory});groups.add(QUESTION_BY_ID[id].group);}}}
 for(const q of rankQuestions(raw.questions).sort((a,b)=>Number(Boolean(QUESTION_BY_ID[a.id]?.personalDetail))-Number(Boolean(QUESTION_BY_ID[b.id]?.personalDetail)))){if(!q||!QUESTION_BY_ID[q.id])throw new AppError('invalid_response',502);if(KEY_QUESTION_BY_ID[q.id]&&((questions.some(x=>KEY_QUESTION_BY_ID[x.id])&&!reviewedCriticalIds.includes(q.id))||!criticalUnknowns.some(g=>g.questionId===q.id&&g.questionText)))continue;if(QUESTION_BY_ID[q.id].personalDetail&&(detailCount>=2||questions.some(x=>QUESTION_BY_ID[x.id]?.personalDetail)))continue;if(SCENARIO_BY_ID[q.id]||['G12','G14'].includes(q.id)||blocked.has(q.id)||groups.has(QUESTION_BY_ID[q.id].group))continue;if(typeof q.reason!=='string'||!q.reason.trim()||q.reason.length>300)throw new AppError('invalid_response',502);if(questions.length>=Math.min(3,policy.remaining)||policy.currentGroupSkipped)break;if(q.excludedOptions!=null&&(!Array.isArray(q.excludedOptions)||q.excludedOptions.length>(QUESTION_BY_ID[q.id].options||[]).length||new Set(q.excludedOptions.map(x=>x?.option)).size!==q.excludedOptions.length||q.excludedOptions.some(x=>!x||!QUESTION_BY_ID[q.id].options?.includes(x.option)||!anchored(x.sourceId,x.evidence))))throw new AppError('invalid_response',502,{reason:'question_option_evidence'});if(QUESTION_BY_ID[q.id].kind!=='text'&&QUESTION_BY_ID[q.id].options?.length&&!reviewedQuestionOptions(QUESTION_BY_ID[q.id],q).options.length)continue;questions.push({id:q.id,...(q.excludedOptions?.length?{excludedOptions:q.excludedOptions}:{}),answerKind:QUESTION_BY_ID[q.id].answerKind,reason:q.reason,...(q.informationGain!=null?{informationGain:q.informationGain,missingInformation:q.missingInformation.slice(0,300),useInStory:q.useInStory.slice(0,300)}:{}),tense:questionTime(b).tense,questionText:criticalUnknowns.find(g=>g.questionId===q.id&&g.kind==='address_preference')?.questionText||resolveQuestionWording(QUESTION_BY_ID[q.id],q,b).questionText});groups.add(QUESTION_BY_ID[q.id].group);}
 questions.sort((a,b)=>Number(Boolean(QUESTION_BY_ID[a.id]?.personalDetail))-Number(Boolean(QUESTION_BY_ID[b.id]?.personalDetail)));
 let conflict=null;if(raw.conflict){const c=raw.conflict;if(typeof c.question!=='string'||!c.question.trim()||c.question.length>400||!Array.isArray(c.evidence)||c.evidence.length!==2||c.evidence.some(x=>!anchored(x?.sourceId,x?.text))||c.evidence[0].text===c.evidence[1].text)throw new AppError('invalid_response',502);conflict={question:c.question,evidence:c.evidence.map(({sourceId,text})=>({sourceId,text}))};}
 const e=raw.expectations||{},expectations={};for(const key of ['mustKeep','respondTo'])expectations[key]=(Array.isArray(e[key])?e[key]:[]).filter(x=>anchored(x?.sourceId,x?.text)).slice(0,12).map(({sourceId,text})=>({sourceId,text}));for(const key of ['free','unknown'])expectations[key]=(Array.isArray(e[key])?e[key]:[]).filter(x=>typeof x==='string'&&x.length<=200).slice(0,8);
 let scenarioAnalysis=normalizeScenarioAnalysis(raw.scenarioAnalysis,s.scenario),picked=null;
 if(!conflict&&!policy.currentGroupSkipped&&!s.scenario&&questions.length<3&&s.shown.length+questions.length<8){
  const recent=s.recentScenarios||[],recentIds=new Set(recent.map(x=>x.id)),lastGroup=recent.at(-1)?.group;
  const usedGroups=new Set([...groups,...covered.map(x=>QUESTION_BY_ID[x.id]?.group)]);
  const candidates=(Array.isArray(raw.scenarioCandidates)?raw.scenarioCandidates:[]).filter(c=>SCENARIO_BY_ID[c?.id]&&[c.relevance,c.information,c.ease].every(n=>Number.isInteger(n)&&n>=1&&n<=2)&&typeof c.reason==='string'&&!recentIds.has(c.id)&&!s.shown.includes(c.id)&&!usedGroups.has(SCENARIO_BY_ID[c.id].group)&&SCENARIO_BY_ID[c.id].group!==lastGroup).sort((a,b)=>b.relevance-a.relevance||b.information-a.information||b.ease-a.ease);
  const top=candidates.filter(c=>c.relevance===candidates[0]?.relevance).slice(0,3);if(top.length){const seed=parseInt(createHash('sha256').update(supplementKey(b)+JSON.stringify(recent)).digest('hex').slice(0,8),16);picked=top[seed%top.length];questions.push({id:picked.id,reason:picked.reason.slice(0,300),tense:'hypothetical'});}
 }
 if(conflict&&unsupportedQuestionReason(conflict.question))conflict=null;
 // Last display gate also applies to model rewrites of ordinary and temporary questions.
 for(let i=questions.length-1;i>=0;i--)if(unsupportedQuestionReason(questions[i].questionText))questions.splice(i,1);
 if(s.scenario){expectations.free=[];expectations.unknown=[];}
 return {generationUnknowns:s.plan?.generationUnknowns||[],criticalUnknowns,questions:conflict||s.scenario?[]:questions,covered,conflict,expectations,stop:!conflict&&(Boolean(raw.stop)||Boolean(s.scenario)||Boolean(picked)||questions.length===0||s.shown.length+questions.length>=8),scenarioAnalysis};
}
export function createPlannerTasks(run){const cache=new Map();return (owner,b)=>{const s=supplementState(b),input={background:{...b,supplementary:undefined},shown:s.shown,answers:s.answers,generationUnknowns:s.plan?.generationUnknowns||[],criticalUnknowns:s.criticalUnknowns?.length?s.criticalUnknowns:s.plan?.criticalUnknowns||[],answerContexts:s.answerScopes||{},confirmations:s.confirmations,confirmationContexts:s.confirmationContexts||[],extra:s.extra,scenario:s.scenario?{id:s.scenario.id,answer:s.scenario.answer,skipped:s.scenario.skipped,scopeKey:s.scenario.scopeKey}:null,recentScenarios:s.recentScenarios||[]};const key=owner+':'+createHash('sha256').update(JSON.stringify(input)).digest('hex');if(cache.has(key))return cache.get(key);if(cache.size>=500)cache.delete(cache.keys().next().value);const promise=Promise.resolve().then(()=>run(b)).catch(e=>{if(e.retryableBeforeModel&&e.category==='busy'&&cache.get(key)===promise)cache.delete(key);throw e;});cache.set(key,promise);return promise;};}

export async function planWithGapCheck(background,caller,{sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 const attempts=[],stages={};let stage='selection',reviewHasScenario=true,initialState=supplementState(background),carriedGaps=initialState.criticalUnknowns?.length?initialState.criticalUnknowns:initialState.plan?.criticalUnknowns||[];
 const run=async(messages,validate)=>{for(let attempt=1;attempt<=3;attempt++){try{const response=await caller.call('questions',messages,{questionStage:stage,questionHasScenario:stage==='review'?reviewHasScenario:true,validateResult:validate});validate(response.result);attempts.push({stage,attempt,status:'success',requestId:response.requestId||null});return response;}catch(e){
  attempts.push({stage,attempt,status:'failed',requestId:e.requestId||null,category:e.category||'analysis_unavailable',reason:/^[a-z0-9_]{1,80}$/.test(e.diagnostic?.reason||'')?e.diagnostic.reason:null,...(e.diagnostic?.questionIdIssue?{questionIdIssue:e.diagnostic.questionIdIssue}:{})});
  if(e.diagnostic?.retryable===false||attempt===3||!['invalid_response','network','timeout','upstream','rate_limit'].includes(e.category)||e.name==='AbortError')throw e;
  if(e.category==='invalid_response')messages=[...messages,{role:'user',content:JSON.stringify({repair:'上一份输出未通过结果契约校验。请按原始资料重新返回完整JSON，不改变用户事实、不补写引用。',reason:e.diagnostic?.reason||'invalid_response',...(e.diagnostic?.reason==='question_review_evidence_not_in_source'?{evidenceRule:'顶层evidence只能直接复制下面假设原文的连续片段，不改写，不从其他字段引用。保留原主体判断并重新审查问题。',hypotheticalDirection:background.hypotheticalDirection}:{})})}];
  await sleep(attempt*1000);
 }}};
 const trackGaps=r=>{carriedGaps=mergeCriticalGaps(carriedGaps,r?.criticalUnknowns,supplementSources(background));};
 const request=messages=>run(messages,r=>{trackGaps(r);return normalizePlan(validateQuestionAssessments(r),background);});
 try{
 let response=await request(plannerMessages(background));let plan=normalizePlan(response.result,background);const s=supplementState(background);carriedGaps=plan.criticalUnknowns;
 stages.selection={proposed:response.result.questions.length,scenarioProposed:response.result.scenarioCandidates?.length||0,kept:plan.questions.length};
 const policy=questionSelectionState(background);
 if(plan.conflict||(!s.scenario&&policy.remaining>0&&!policy.currentGroupSkipped)){
  plan=prepareCriticalReviewCandidates(plan,background);carriedGaps=plan.criticalUnknowns;
  const originalOrdinary=plan.questions.filter(q=>ORDINARY_BY_ID[q.id]);
  const originalScenario=plan.questions.find(q=>SCENARIO_BY_ID[q.id]);stage='review';reviewHasScenario=Boolean(originalScenario);
  const review=await run(questionReviewMessages(background,plan),r=>{trackGaps(r);return validateQuestionReview(r,background,plan.criticalUnknowns);});
  const r=validateQuestionReview(review.result,background,plan.criticalUnknowns);carriedGaps=mergeCriticalGaps(carriedGaps,r.criticalUnknowns,supplementSources(background));
  // Review is mandatory for display; failure never promotes unreviewed questions.
  const adjusted=normalizePlan({...r,criticalUnknowns:mergeCriticalGaps(plan.criticalUnknowns,r.criticalUnknowns,supplementSources(background)),covered:[...plan.covered,...r.covered],scenarioCandidates:[],scenarioAnalysis:null,expectations:plan.expectations,stop:plan.stop},background,{addCriticalQuestions:false,reviewedCriticalIds:r.questions.filter(q=>KEY_QUESTION_BY_ID[q.id]&&q.wordingSource!=='bank'&&r.criticalUnknowns.some(g=>g.questionId===q.id&&g.questionText)).map(q=>q.id)});
  const removed=originalOrdinary.filter(q=>!adjusted.questions.some(x=>x.id===q.id)).map(q=>({id:q.id,question:questionTitle(ORDINARY_BY_ID[q.id],q,background),missingInformation:q.missingInformation||ORDINARY_BY_ID[q.id].purpose,useInStory:q.useInStory||ORDINARY_BY_ID[q.id].purpose}));
  plan={...plan,generationUnknowns:[...new Map([...(s.plan?.generationUnknowns||[]),...removed].map(q=>[q.id,q])).values()].slice(0,8),criticalUnknowns:adjusted.criticalUnknowns,conflict:adjusted.conflict,questions:adjusted.questions,covered:adjusted.covered,logicReviewed:true,changeSubject:r.changeSubject};
  if(!plan.conflict&&originalScenario&&r.keepScenario&&plan.questions.length<3&&s.shown.length+plan.questions.length<8)plan.questions.push(originalScenario);
  stages.review={generatedCriticalCandidates:plan.generatedCriticalCandidates||[],coverage:criticalReviewCoverage(plan,background),proposed:r.questions.length,scenarioProposed:originalScenario?1:0,kept:plan.questions.length,wording:{canonical:r.questions.filter(q=>q.wordingSource==='questionText').length,alias:r.questions.filter(q=>q.wordingSource==='question').length,fallback:r.questions.filter(q=>q.wordingSource==='bank').length}};
  plan.stop=!plan.conflict&&(Boolean(r.stop)||plan.questions.length===0||plan.questions.some(q=>SCENARIO_BY_ID[q.id])||s.shown.length+plan.questions.length>=8);response=review;
 }
 const last=stages.review||stages.selection;
 const outcome=plan.conflict?'needs_confirmation':plan.questions.length?'questions_ready':policy.remaining===0?'limit_reached':policy.currentGroupSkipped?'group_skipped':s.scenario?'scenario_finished':last.proposed+last.scenarioProposed>0?'filtered_empty':'model_no_questions';
 return {...plan,...(!plan.conflict?{stop:true,optionalGroupPolicy:'single_group'}:{}),requestId:response.requestId,planDiagnostics:{outcome,stage,attempts,stages}};
 }catch(e){if(['input','identity','forbidden','busy','capacity','aborted'].includes(e.category)||e.name==='AbortError')throw e;return {...optionalQuestionFallback({...supplementState(background),criticalUnknowns:carriedGaps}),requestId:e.requestId,recoveryReason:e.category||'analysis_unavailable',planDiagnostics:{outcome:'analysis_unavailable',stage,attempts,stages}};}
}
