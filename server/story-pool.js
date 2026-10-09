import {fillStoryIdentity} from './generation-input.js';
import {schemaRetryFeedback,hardRetryFeedback,withRetryFeedback} from './generation-retry.js';
import {fieldRepairPlan,fieldRepairMessages,applyFieldRepair} from './story-field-repair.js';
import {randomUUID} from 'node:crypto';
import {AppError} from './core.js';
import {hardStoryIssues} from './story-hard-checks.js';
import {STORY_MAX_MODEL_CALLS} from '../src/story-budget.js';
const fatal=e=>['configuration','balance','local_storage','content','stopped'].includes(e.category);
// Generation and optional field repair share the same four-call budget and task slot.
export async function chooseStoryPool({caller,messages,background,effectiveSetting,signal,onDraft=()=>{},state={generated:0,drafts:[]}}){
 const keep=d=>{state.drafts.push(d);onDraft(d);};
 while(state.generated<STORY_MAX_MODEL_CALLS){
  signal?.throwIfAborted();state.generated++;
  let requestId=null,response,issues,originalIdentity;
  const repair=state.pendingRepair||null;state.pendingRepair=null;
  const attemptMessages=repair?fieldRepairMessages(messages,repair.story,repair.plan):withRetryFeedback(messages,state.retryFeedback||null);
  try{
   response=await caller.call('story',attemptMessages,{signal,onStart:id=>requestId=id,...(repair?{repairFields:repair.plan.fields,parentRequestId:repair.sourceId}:{}),diagnosticRange:effectiveSetting.temporal?.window,diagnosticClock:effectiveSetting.temporal,validateResult:r=>{if(r.kind==='clarification'&&(repair||!JSON.parse(messages.at(-1).content).canClarify))throw new AppError('invalid_response',502,{stage:'business',reason:'repeated_clarification'});}});
   if(repair){const merged=applyFieldRepair(repair.story,response.result,repair.plan,messages,background,effectiveSetting);response.result=merged.result;issues=merged.issues;originalIdentity=repair.originalIdentity;}
  }catch(e){if(signal?.aborted||fatal(e))throw e;state.retryFeedback=repair?null:schemaRetryFeedback(e,messages);keep({id:e.requestId||requestId||randomUUID(),sequence:state.generated-1,attemptKind:repair?'field_repair':'generation',...(repair?{repairSourceId:repair.sourceId,repairedFields:repair.plan.fields}:{}),eligible:false,failure:{category:e.category||'network',diagnostic:e.diagnostic||null},payload:null});continue;}
  if(response.result.kind==='clarification')return response;
  if(!repair){originalIdentity=response.result.identity;response.result=fillStoryIdentity(response.result,effectiveSetting);issues=hardStoryIssues(response.result,background,effectiveSetting);}
  state.retryFeedback=hardRetryFeedback(issues,effectiveSetting);
  const draft={id:response.requestId||requestId||randomUUID(),sequence:state.generated-1,attemptKind:repair?'field_repair':'generation',...(repair?{repairSourceId:repair.sourceId,repairedFields:repair.plan.fields}:{}),eligible:issues.length===0,hardIssues:issues,programFilledFields:{identity:{original:originalIdentity,value:response.result.identity,basis:'产品本人主角定义与已给locationText'}},payload:{background,effectiveSetting,story:response.result}};
  keep(draft);
  if(draft.eligible){onDraft({...draft,selected:true,delivery:{status:repair?'program_accepted_after_field_repair':'program_accepted'}});return {result:response.result,requestId:draft.id};}
  // At most one local repair for a given draft. A failed repair can use a remaining full attempt.
  if(!repair&&state.generated<STORY_MAX_MODEL_CALLS){const plan=fieldRepairPlan(response.result,issues,effectiveSetting);if(plan)state.pendingRepair={sourceId:draft.id,originalIdentity,story:structuredClone(response.result),plan};}
 }
 throw new AppError('setting_not_met',422,{stage:'story',reason:'no_program_eligible_candidate'});
}
