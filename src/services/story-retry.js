// Retry only a completed, explicitly rejected model result. Never retry an ambiguous connection failure.
export async function storyWithRetry(attempt,{signal,onRetry=()=>{},onFailedAttempt=()=>{}}={}){
 try{return await attempt(0);}catch(error){
  if(signal?.aborted||error.rewriteCount>=1||!(['invalid_response','background_conflict'].includes(error.category)||(error.terminal&&['upstream','timeout'].includes(error.category))))throw error;
  onFailedAttempt(error);onRetry();signal?.throwIfAborted();
  return await attempt(1);
 }
}
