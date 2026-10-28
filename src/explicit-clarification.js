import {KEY_QUESTION_BY_ID,criticalGapStatus,mergeCriticalGaps} from './critical-background.js';
import {supplementState,supplementSources,answerText,unknownAnswer,supplementKey} from './supplementary.js';
import {unsupportedQuestionReason} from './question-premises.js';
import {activeReusedAnswers} from './history-reuse-data.js';

// A small literal-input path, not semantic inference from arbitrary model gaps.
// User instructions in constraint fields may ask us to clarify a quoted topic first.
export function explicitClarificationRequests(background){
 const requests=[];
 for(const sourceId of ['details','additionalInfo']){
  const source=String(background[sourceId]||'');
  for(const sentence of source.split(/[。！？!?\n]/)){
   if(/[“”「」『』"<>`]/.test(sentence))continue;
   const suffix=/(?:^|[，,：:])\s*(?:你|请你|请|麻烦你)?先(?:问问|问清楚|问清|问|确认)(?:我)?(?:一下|清楚)?\s*(?:，|,)?\s*再(?:写|生成)(?:故事)?/.exec(sentence);
   const prefix=/^\s*(?:你|请你|请|麻烦你)?先(?:问问|问清楚|问清|问|确认)(?:我)?\s*([\s\S]{1,130}?)\s*再(?:写|生成)(?:故事)?/.exec(sentence);
   const topic=(suffix?sentence.slice(0,suffix.index):prefix?prefix[1]:'').trim().replace(/[，,：:、\s]+$/,'');
   if(/(?:不必|不用|无需|不要|别|不需要|不想|不).{0,8}$/.test(suffix?sentence.slice(0,suffix.index):''))continue;
   if(!topic||topic.length>130||/^(?:如果|假如|例如|比如|假设|以前|当时)/.test(topic)||!/(?:什么关系|谁(?:走|留|出发|离开|留下)|(?:走|留|出发|离开|留下)的(?:是)?谁)/.test(topic)||unsupportedQuestionReason(topic))continue;
   const key='user_request_'+supplementKey({details:sourceId+'\0'+topic});
   if(requests.some(r=>r.key===key||r.evidence===topic))continue;
   const questionText='请先补充你提到的“'+topic+'”这处设定。';
   requests.push({key,sourceId,evidence:topic,questionText,missingInformation:topic,whyMissing:'用户明确要求先问这处设定再写。',useInStory:'只按用户补充确定这处设定；未答或跳过仍保持未知。'});
   if(requests.length===8)return requests;
  }
 }
 return requests;
}

export function explicitClarificationPlan(background){
 const requested=explicitClarificationRequests(background);if(!requested.length)return null;
 const state=supplementState(background),sources=supplementSources(background);
 const gaps=mergeCriticalGaps(state.criticalUnknowns?.length?state.criticalUnknowns:state.plan?.criticalUnknowns,[],sources);
 const used=new Set([...state.shown,...Object.keys(state.answers||{}),...activeReusedAnswers(background).map(a=>a.questionId),...gaps.map(g=>g.questionId)]);
 const questions=[];let unfinished=false,skipped=false,more=false;
 for(const request of requested){
  let gap=gaps.find(g=>g.key===request.key);
  if(gap){
   const meta=state.questionMeta?.[gap.questionId];
   if(!KEY_QUESTION_BY_ID[gap.questionId]||meta?.explicitRequestKey!==request.key||meta?.displayedQuestionText!==request.questionText){unfinished=true;continue;}
  }
  if(gap){
   const status=criticalGapStatus(gap,state,answerText,unknownAnswer).status;
   if(status==='answered')continue;
   if(status==='skipped'){skipped=true;continue;}
  }
  if(state.skippedRemaining){skipped=true;if(!gap&&gaps.length<8)gaps.push(request);continue;}
  unfinished=true;
  if(!gap&&gaps.length>=8)continue;
  const alreadyShown=gap&&state.shown.includes(gap.questionId);
  if(questions.length>=3){if(alreadyShown||state.shown.length+questions.filter(q=>!state.shown.includes(q.id)).length<8)more=true;continue;}
  if(!alreadyShown&&state.shown.length+questions.filter(q=>!state.shown.includes(q.id)).length>=8)continue;
  const id=gap?.questionId||Object.keys(KEY_QUESTION_BY_ID).find(k=>!used.has(k));if(!id)continue;
  used.add(id);
  const next={...request,questionId:id};
  if(gap)Object.assign(gap,next);else gaps.push(next);
  questions.push({id,questionText:request.questionText,displayedQuestionText:request.questionText,explicitRequestKey:request.key,reason:'先回应你明确要求确认的设定。',informationGain:3,missingInformation:request.missingInformation,useInStory:request.useInStory});
 }
 // After a real answer, ordinary model planning can use it. An explicit skip is not an answer.
 if(!unfinished&&!skipped)return null;
 return {questions,covered:[],criticalUnknowns:gaps,conflict:state.plan?.conflict||null,expectations:{mustKeep:[],respondTo:[],free:[],unknown:[]},stop:!more,scenarioAnalysis:null,questionOrigin:'literal_user_request',planDiagnostics:{outcome:questions.length?'user_requested_questions':skipped?'user_requests_skipped':'limit_reached',stage:'literal_input',attempts:[],stages:{literal_input:{kept:questions.length}}}};
}
