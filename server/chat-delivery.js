import {AppError} from './core.js';
import {assertSafe} from './content-safety.js';
import {rewriteDirectEchoes} from './chat-echo.js';

// Commit complete checked sentences in order while the provider is still sending.
// Unfinished text is discarded on transport failure; committed text is never replaced.
export function createChatDelivery({caller,currentMessage,history,signal,onText,onRepair=()=>{},onFailure=()=>{},parentRequestId=()=>null}){
 let pending='',queue=Promise.resolve(),failure=null,reply='';
 const budget={calls:0,maxCalls:2};
 const enqueue=text=>{
  queue=queue.then(async()=>{
   if(failure)return;signal?.throwIfAborted();assertSafe(text);
   const result=await rewriteDirectEchoes(caller,{reply:text,currentMessage,history,signal,parentRequestId:parentRequestId(),budget,onRewrite:onRepair});
   signal?.throwIfAborted();assertSafe(result.reply);onText(result.reply);reply+=result.reply;
  }).catch(error=>{if(!failure){failure=error;onFailure(error);}});
 };
 function push(text){
  if(failure)return;pending+=text;
  let match;
  while((match=/[。！？!?][”」』"]*|\n[ \t]*\n/.exec(pending))){const end=match.index+match[0].length;enqueue(pending.slice(0,end));pending=pending.slice(end);}
 }
 return {push,async finish({complete=true}={}){if(complete&&pending){enqueue(pending);pending='';}else if(!complete)pending='';await queue;if(failure)throw failure;return {reply,repairCalls:budget.calls};}};
}
