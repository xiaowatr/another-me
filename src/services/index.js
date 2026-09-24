import {storyWithRetry} from './story-retry.js';
﻿async function request(path, body, signal, trace) {
  const started=performance.now();let timing=trace?{clientTraceId:trace,requestId:trace,startedAt:new Date().toISOString()}:null;
  let response;
  try { response = await fetch(path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json',...(trace?{'X-Client-Trace-Id':trace}:{}) } : {}, body: body ? JSON.stringify(body) : undefined, signal: signal?AbortSignal.any([signal,AbortSignal.timeout(100000)]):AbortSignal.timeout(100000) }); }
  catch { const error=new Error('连接中断或请求超时，输入已保留。请检查网络后手动重试。');error.timing=timing?{...timing,completeMs:Math.round(performance.now()-started)}:null;throw error; }
  if(timing)timing={...timing,requestId:response.headers.get('X-Trace-Id')||trace,responseReceivedMs:Math.round(performance.now()-started)};
  let data;
  try { data = await response.json(); } catch { const error=new Error('服务返回异常，输入已保留，请稍后手动重试。');error.timing=timing;throw error; }
  if(timing)timing.jsonParsedMs=Math.round(performance.now()-started);
  if (!response.ok) {const error=new Error(data.error || '请求失败，请手动重试。');error.category=data.category;error.timing=timing;error.requestId=data.requestId||timing?.requestId;throw error;}
  if(timing)data.clientTiming=timing;
  return data;
}
export const experience = {
  restore: (snapshot,previousSessionId,signal) => request('/api/session/restore',{snapshot,previousSessionId},signal),
  status: () => request('/api/status'),
  getStory: (input,signal,trace,onRetry) => storyWithRetry(attempt=>request('/api/story',input,signal,attempt?crypto.randomUUID():trace),{signal,onRetry,onFailedAttempt:e=>reportStoryTiming(e.timing,'failed')}),
  reply: (input) => request('/api/chat', input),
};

export async function streamReply(input,{signal,onEvent}) {
  let requestId=crypto.randomUUID();onEvent({type:'request',requestId});
  try{const response=await fetch('/api/chat/stream',{method:'POST',headers:{'Content-Type':'application/json','X-Client-Trace-Id':requestId},body:JSON.stringify(input),signal});
  if(!response.ok){const data=await response.json().catch(()=>({}));requestId=data.requestId||response.headers.get('X-Trace-Id')||requestId;throw new Error(data.error||'请求失败，输入已保留，请重试。');}
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',done=false;
  try{while(true){const value=await reader.read();if(value.done)break;buffer+=decoder.decode(value.value,{stream:true});let n;while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n);buffer=buffer.slice(n+1);if(!line.trim())continue;const event=JSON.parse(line);if(event.requestId)requestId=event.requestId;if(event.type==='error')throw new Error(event.error);if(event.type==='done')done=true;onEvent(event);}}if(!done)throw new Error('回复中断，已展示的文字保留。可以手动重试。');}finally{reader.releaseLock();}
  }catch(e){const error=new Error(e.name==='TimeoutError'?'回复超时，消息和已收到的内容已保留，请手动重试。':e instanceof TypeError?'连接中断，消息和已收到的内容已保留，请检查网络后重试。':e.message);error.requestId=requestId;error.name=e.name;throw error;}
}
export async function confirmSeen(input){
 const response=await fetch('/api/chat/seen',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw new Error('已显示内容未能同步，请停止并检查本地服务。');
}

export function reportStoryTiming(timing,outcome,extra={}){if(!timing)return;fetch('/api/timing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task:'story',...timing,...extra,outcome}),keepalive:true}).catch(()=>{});}
