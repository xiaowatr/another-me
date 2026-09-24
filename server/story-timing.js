import {AsyncLocalStorage} from 'node:async_hooks';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import {CODE_VERSION} from './diagnostics.js';
import {PROMPT_VERSION} from './prompts.js';
const context=new AsyncLocalStorage();
export const PROCESS_STARTED_AT=new Date(Date.now()-process.uptime()*1000).toISOString();
export function makeStoryTrace(res,clientId,{directory='.local',emit=line=>console.info(line),env=process.env}={}){
 const started=performance.now(),requestId=randomUUID(),stamp=()=>({at:new Date().toISOString(),elapsedMs:Math.round(performance.now()-started)});
 const safeClient=/^[a-f0-9-]{36}$/.test(clientId||'')?clientId:null;
 const record={type:'story_request_diagnostic',requestId,clientTraceId:safeClient,codeVersion:CODE_VERSION,promptVersion:PROMPT_VERSION,processStartedAt:PROCESS_STARTED_AT,processUptimeMs:Math.round(process.uptime()*1000),events:[{name:'request_received',...stamp()}],calls:[]};
 const write=value=>{try{fs.mkdirSync(directory,{recursive:true});fs.appendFileSync(directory+'/story-timings.jsonl',JSON.stringify(value)+'\n');}catch{}if(env.REQUEST_DIAGNOSTICS!=='0')emit(JSON.stringify(value));};
 const trace={record,mark(name){record.events.push({name,...stamp()});},modelStart(id,model,task){record.calls.push({requestId:id,model,task,start:stamp(),end:null,usage:null});},modelEnd(r){const call=record.calls.find(c=>c.requestId===r.requestId);if(call)Object.assign(call,{end:stamp(),status:r.status,actualModel:r.actualModel,inputTokens:r.inputTokens,outputTokens:r.outputTokens,cachedTokens:r.cachedTokens,usage:r.usage||null,phaseMs:r.phaseMs,errorCategory:r.errorCategory});},run:fn=>context.run(trace,fn)};
 res.setHeader('X-Trace-Id',requestId);
 let done=false;const finish=outcome=>{if(done)return;done=true;trace.mark(outcome);record.httpStatus=res.statusCode;record.actualCallCount=record.calls.length;record.durationMs=Math.round(performance.now()-started);write(record);};
 res.once('finish',()=>finish('response_finished'));res.once('close',()=>{if(!res.writableFinished)finish('connection_closed');});
 write({...record,type:'story_request_started'});return trace;
}
export function activeStoryTrace(){return context.getStore();}
