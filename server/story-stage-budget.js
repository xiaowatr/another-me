import {STORY_MAX_MODEL_CALLS,STORY_MAX_TOTAL_CALLS} from '../src/story-budget.js';
import {AppError} from './core.js';
export function consumeStoryCall(operation,task){
 if(task!=='story')throw new AppError('configuration',500);
 const counts=operation.stageCalls||{story:0};
 if((counts.story||0)>=STORY_MAX_MODEL_CALLS||(operation.calls||0)>=STORY_MAX_TOTAL_CALLS)throw new AppError('retry_exhausted',409,{stage:task,reason:'stage_budget_exhausted'});
 operation.stageCalls=counts;counts.story=(counts.story||0)+1;operation.calls=(operation.calls||0)+1;
}
