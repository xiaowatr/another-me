import {routeCriticalChoiceQuestions} from './question-routing.js';
import {questionInput} from './question-input.js';
import {QUESTION_COMMON_RULES,QUESTION_REVIEW_TASK} from './question-prompts.js';
import {assertQuestionIds,questionIdError} from './question-contract.js';
import {lifeBackgroundEntries} from '../src/life-background.js';
import {QUESTION_SELECTION_RULE,QUESTION_STOP_RULE,questionSelectionState,validateQuestionAssessments} from './question-policy.js';
import {KEY_QUESTION_BY_ID,mergeCriticalGaps} from '../src/critical-background.js';
import {RETIRED_QUESTION_IDS,QUESTION_BY_ID as BANK_BY_ID} from '../src/question-bank.js';
import {SCENARIO_BY_ID} from '../src/scenario-bank.js';
import {questionTime,questionTitle} from '../src/question-context.js';
import {supplementSources,supplementState,supplementaryContext} from '../src/supplementary.js';

import {AppError} from './core.js';
import {modelQuestionBank,resolveQuestionWording} from './question-wording.js';
const QUESTION_BY_ID={...BANK_BY_ID,...KEY_QUESTION_BY_ID};
export function questionReviewMessages(background,plan){return [{role:'system',content:QUESTION_COMMON_RULES+'\n'+QUESTION_REVIEW_TASK},{role:'user',content:JSON.stringify({...questionInput(background,plan.criticalUnknowns),previousDecision:{stop:plan.stop,unknown:plan.expectations?.unknown||[],proposedConfirmation:plan.conflict||null},candidates:plan.questions.map(q=>({...q,...(QUESTION_BY_ID[q.id]?{questionText:questionTitle(QUESTION_BY_ID[q.id],q,background),options:QUESTION_BY_ID[q.id].options}:{questionText:SCENARIO_BY_ID[q.id]?.question})})),bank:modelQuestionBank()})}];}
export function validateQuestionReview(raw,background,priorGaps=[]){
 assertQuestionIds(raw,'review');validateQuestionAssessments(raw);const fail=reason=>{throw new AppError('invalid_response',502,{reason:'question_review_'+reason});};
 if(raw.stop!=null&&typeof raw.stop!=='boolean')fail('stop_flag');if(raw.questions.length>6)fail('question_count');if(!Array.isArray(raw.covered))fail('covered_type');
 if(typeof raw.keepScenario!=='boolean')fail('scenario_flag');if(!['self','other','mixed','unknown'].includes(raw.changeSubject))fail('subject');
 if(typeof raw.evidence!=='string'||!raw.evidence.trim())fail('evidence_missing');const evidence=sourceQuote(background.hypotheticalDirection||'',raw.evidence);if(evidence===null)fail('evidence_not_in_source');raw={...raw,evidence};
 const state=supplementState(background);const gaps=mergeCriticalGaps(mergeCriticalGaps(state.criticalUnknowns?.length?state.criticalUnknowns:state.plan?.criticalUnknowns,priorGaps,supplementSources(background)),raw.criticalUnknowns,supplementSources(background));
 const routed=routeCriticalChoiceQuestions(raw,gaps,background,{reviewed:true});raw={...raw,...routed};
 const questions=raw.questions.filter(q=>!RETIRED_QUESTION_IDS.includes(q?.id)).map(q=>{
  if(!QUESTION_BY_ID[q?.id])throw questionIdError(q?.id,'questions.id','review');if(typeof q.reason!=='string')fail('reason_type');
  // Wording is optional presentation. A bad rewrite must not invalidate an otherwise reviewed question.
  const {question,options,...rest}=q;
  const excluded=q.excludedOptions;
  if(excluded!=null){
   if(!Array.isArray(excluded)||excluded.length>(QUESTION_BY_ID[q.id].options||[]).length)fail('option_exclusions');
   const sources=new Map(supplementSources(background).map(s=>[s.id,[...(s.selected||[]),s.text||''].filter(Boolean).join('；')]));
   if(new Set(excluded.map(x=>x?.option)).size!==excluded.length||excluded.some(x=>!x||!QUESTION_BY_ID[q.id].options?.includes(x.option)||typeof x.evidence!=='string'||!x.evidence.trim()||x.evidence.length>500||!sources.get(x.sourceId)?.includes(x.evidence)))fail('option_evidence');
  }
  return {...rest,...resolveQuestionWording(QUESTION_BY_ID[q.id],q,background)};
 });return {...raw,questions};
}

// Only whitespace and one enclosing quote pair may differ; never fuzzy-match meaning.
function sourceQuote(source,evidence){
 if(source.includes(evidence))return evidence;
 let quote=evidence.trim();for(const [left,right] of [['“','”'],['「','」'],['『','』'],['"','"']]){if(quote.startsWith(left)&&quote.endsWith(right)){quote=quote.slice(left.length,-right.length);break;}}
 const needle=quote.replace(/\s/g,'');if(!needle)return null;
 let text='',positions=[];for(let i=0;i<source.length;i++){if(!/\s/.test(source[i])){text+=source[i];positions.push(i);}}
 const at=text.indexOf(needle);return at<0?null:source.slice(positions[at],positions[at+needle.length-1]+1);
}