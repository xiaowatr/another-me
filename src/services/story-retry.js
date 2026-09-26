import {storyCallCount,STORY_MAX_REWRITES,STORY_MAX_MODEL_CALLS,retryableStoryFailure} from '../story-budget.js';
// Reconnect to an ambiguous request instead of starting a second paid request.
export async function storyWithRetry(attempt,{signal,onRetry=()=>{},onFailedAttempt=()=>{}}={}){
 for(let i=0;i<=STORY_MAX_REWRITES;i++){
  try{return await attempt(i);}catch(error){
   if(signal?.aborted||i===STORY_MAX_REWRITES||error.rewriteCount>=STORY_MAX_REWRITES||storyCallCount(error)>=STORY_MAX_MODEL_CALLS||!retryableStoryFailure(error))throw error;
   onFailedAttempt(error);onRetry(i+1);signal?.throwIfAborted();
  }
 }
}
