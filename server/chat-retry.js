import {AppError} from './core.js';
export const CHAT_MAX_CALLS=2;
// Never replace an answer already sent to the browser, or retry a transport /
// business failure. Both attempts belong to the same turn and concurrency slot.
export async function callChatWithRetry(caller,messages,options){
 let shown=0,requestId=null;
 for(let attempt=1;attempt<=CHAT_MAX_CALLS;attempt++){
  if(options.signal?.aborted)throw new AppError('stopped');
  const parentRequestId=requestId;
  try{return await caller.call('chat',messages,{...options,chatAttempt:attempt,parentRequestId,requireStructuredChat:attempt===1,onStart:id=>{requestId=id;options.onStart?.(id);},onText:text=>{shown+=text.length;options.onText(text);}});}
  catch(error){
   const reason=error.diagnostic?.reason;
   const protocol=error.category==='invalid_response'&&error.diagnostic?.stage==='parse'&&(reason==='chat_envelope'||/^chat_tool_[a-z_]+$/.test(reason||''));
   if(attempt===CHAT_MAX_CALLS||shown||!protocol||options.signal?.aborted)throw error;
  }
 }
}
