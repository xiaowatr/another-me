import {STORY_MAX_MODEL_CALLS,STORY_MAX_REVIEW_CALLS,STORY_MAX_TOTAL_CALLS} from '../src/story-budget.js';
import {AppError} from './core.js';
export function consumeStoryCall(operation,task,reviewStage){
 const stage=task==='story'?'story':task==='review'&&['scenario','setting'].includes(reviewStage)?reviewStage:null;
 if(!stage)throw new AppError('configuration',500);
 const counts=operation.stageCalls||{story:operation.calls||0,scenario:0,setting:0};
 const limit=stage==='story'?STORY_MAX_MODEL_CALLS:STORY_MAX_REVIEW_CALLS;
 if(counts[stage]>=limit||(operation.calls||0)>=STORY_MAX_TOTAL_CALLS)throw new AppError('retry_exhausted',409,{stage,reason:'stage_budget_exhausted'});
 operation.stageCalls=counts;counts[stage]++;operation.calls=(operation.calls||0)+1;
}
