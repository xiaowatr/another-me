import {QUESTION_BY_ID} from '../src/question-bank.js';
import {KEY_QUESTION_BY_ID} from '../src/critical-background.js';
import {supplementState} from '../src/supplementary.js';
import {activeReusedAnswers} from '../src/history-reuse-data.js';
import {unsupportedQuestionReason} from '../src/question-premises.js';
import {questionTitle} from '../src/question-context.js';
import {resolveQuestionWording} from './question-wording.js';

// Keep fixed choice semantics. A grounded custom gap belongs to a free text slot,
// not to rewritten options. Call only after source/retired-gap validation.
export function routeCriticalChoiceQuestions(raw,gaps,background,{reviewed=false}={}){
 const state=supplementState(background),questions=raw.questions.map(q=>({...q})),criticalUnknowns=gaps.map(g=>({...g}));
 const historical=new Set([...state.shown,...Object.keys(state.answers||{}),...activeReusedAnswers(background).map(a=>a.questionId)]);
 const covered=new Set((raw.covered||[]).map(q=>q.id));
 const used=new Set([...historical,...covered,...questions.map(q=>q.id),...criticalUnknowns.map(g=>g.questionId)]);
 const linked=criticalUnknowns.map(g=>({gap:g,source:(raw.criticalUnknowns||[]).find(x=>x.key===g.key)||g}));
 for(const {gap,source} of linked){
  const oldId=source.questionId||gap.questionId,bank=QUESTION_BY_ID[oldId];
  if(!['single','multi'].includes(bank?.kind)||historical.has(oldId)||covered.has(oldId)||gap.resolvedBy)continue;
  if(linked.filter(x=>(x.source.questionId||x.gap.questionId)===oldId).length!==1)continue;
  const wording=resolveQuestionWording(KEY_QUESTION_BY_ID.K1,{questionText:gap.questionText},background);
  if(wording.wordingSource==='bank'||unsupportedQuestionReason(wording.questionText)||wording.questionText===questionTitle(bank,null,background))continue;
  const matches=questions.filter(q=>q.id===oldId);if(matches.length>1)continue;
  const candidate=matches[0];
  if(candidate?.excludedOptions!=null&&(!Array.isArray(candidate.excludedOptions)||candidate.excludedOptions.length>0))continue;
  const candidateWording=candidate&&resolveQuestionWording(KEY_QUESTION_BY_ID.K1,candidate,background);
  // Review may remove or replace a question; do not resurrect the selection's wording.
  if(reviewed&&(!candidate||candidateWording.wordingSource==='bank'||candidateWording.questionText!==wording.questionText))continue;
  if(candidate&&(candidate.questionText!=null||candidate.question!=null)&&(candidateWording.wordingSource==='bank'||candidateWording.questionText!==wording.questionText))continue;
  const linkedSlot=KEY_QUESTION_BY_ID[gap.questionId]?gap.questionId:null;
  const id=linkedSlot||Object.keys(KEY_QUESTION_BY_ID).find(k=>!used.has(k));
  if(!id||historical.has(id)||covered.has(id)||questions.some(q=>q.id===id)||criticalUnknowns.some(g=>g!==gap&&g.questionId===id))continue;
  used.add(id);gap.questionId=id;
  if(candidate){candidate.id=id;candidate.questionText=wording.questionText;delete candidate.question;delete candidate.options;delete candidate.excludedOptions;}
 }
 return {questions,criticalUnknowns};
}
