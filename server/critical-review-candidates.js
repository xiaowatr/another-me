import {KEY_QUESTION_BY_ID,criticalGapStatus} from '../src/critical-background.js';
import {supplementState,supplementSources,answerText,unknownAnswer} from '../src/supplementary.js';
import {activeReusedAnswers} from '../src/history-reuse-data.js';
import {unsupportedQuestionReason} from '../src/question-premises.js';
import {questionSelectionState} from './question-policy.js';
import {resolveQuestionWording} from './question-wording.js';

// A proposed question is input to the existing independent review, never permission
// to display it. Unknown background is optional and can be rejected as unnecessary.
export function prepareCriticalReviewCandidates(plan,background){
 const state=supplementState(background),policy=questionSelectionState(background);
 if(plan.conflict||state.scenario||policy.currentGroupSkipped||policy.remaining===0||state.skippedRemaining)return plan;
 const sources=new Map(supplementSources(background).map(s=>[s.id,s.text]));
 const used=new Set([...state.shown,...Object.keys(state.answers||{}),...activeReusedAnswers(background).map(a=>a.questionId),...(plan.covered||[]).map(q=>q.id),...plan.questions.map(q=>q.id),...(plan.criticalUnknowns||[]).map(g=>g.questionId)]);
 const gaps=(plan.criticalUnknowns||[]).map(g=>({...g})),candidates=[];
 for(const gap of gaps){
  if(gap.questionText||gap.questionId||gap.resolvedBy||!sources.get(gap.sourceId)?.includes(gap.evidence))continue;
  if(['answered','skipped'].includes(criticalGapStatus(gap,state,answerText,unknownAnswer).status))continue;
  const text='请补充这处设定：'+gap.missingInformation.replace(/[。？?]+$/,'')+'。不确定也可以跳过。';
  const wording=resolveQuestionWording(KEY_QUESTION_BY_ID.K1,{questionText:text},background);
  if(wording.wordingSource!=='questionText'||unsupportedQuestionReason(text))continue;
  const id=Object.keys(KEY_QUESTION_BY_ID).find(id=>!used.has(id));
  if(!id||candidates.length>=Math.min(3,policy.remaining))break;
  used.add(id);gap.questionId=id;gap.questionText=text;gap.reviewCandidateOrigin='missing_gap_wording';
  candidates.push({id,questionText:text,criticalGapKey:gap.key,candidateOrigin:'missing_gap_wording',reason:gap.whyMissing,informationGain:3,missingInformation:gap.missingInformation,useInStory:gap.useInStory});
 }
 if(!candidates.length)return plan;
 return {...plan,criticalUnknowns:gaps,questions:[...candidates,...plan.questions].slice(0,6),generatedCriticalCandidates:candidates.map(q=>({key:q.criticalGapKey,questionId:q.id}))};
}

export function criticalReviewCoverage(plan,background){
 const state=supplementState(background);
 return (plan.criticalUnknowns||[]).map(g=>{
  const status=criticalGapStatus(g,state,answerText,unknownAnswer).status;
  return {key:g.key,sourceId:g.sourceId,evidence:g.evidence,missingInformation:g.missingInformation,questionId:g.questionId||null,questionText:g.questionText||null,requiredToAnswer:false,status,linkedCandidatePresent:Boolean(g.questionId&&plan.questions.some(q=>q.id===g.questionId))};
 });
}
