import {AppError} from './core.js';
export const CHAT_MAX_CALLS=2;
const pause=(ms,signal)=>new Promise((resolve,reject)=>{
 const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(new AppError('stopped'));};
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
 signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
});
// Both protocol and pre-response connection recovery share the same turn budget.
export async function callChatWithRetry(caller,messages,options,{sleep=pause}={}){
 let shown=0,requestId=null;
 for(let attempt=1;attempt<=CHAT_MAX_CALLS;attempt++){
  if(options.signal?.aborted)throw new AppError('stopped');
  const parentRequestId=requestId;
  try{return await caller.call('chat',messages,{...options,chatAttempt:attempt,parentRequestId,plainChatReply:true,requireStructuredChat:false,onStart:id=>{requestId=id;options.onStart?.(id);},onText:text=>{shown+=text.length;options.onText(text);}});}
  catch(error){
   const reason=error.diagnostic?.reason;
   const protocol=error.category==='invalid_response'&&error.diagnostic?.stage==='parse'&&(reason==='chat_envelope'||/^chat_tool_[a-z_]+$/.test(reason||''));
   const connect=error.category==='timeout'&&error.diagnostic?.stage==='transport'&&error.diagnostic?.retryable===true&&error.diagnostic?.retryableBeforeResponse===true;
   if(attempt===CHAT_MAX_CALLS||shown||error.replyReceived||!(protocol||connect)||options.signal?.aborted)throw error;
   options.onRetry?.({attempt:attempt+1,maxAttempts:CHAT_MAX_CALLS,reason:connect?'connect_timeout':'protocol'});
   if(connect)await sleep(500,options.signal);
  }
 }
}
