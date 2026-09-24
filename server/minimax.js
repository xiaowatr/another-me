import {activeStoryTrace} from './story-timing.js';
import {CODE_VERSION,redactEvidence} from './diagnostics.js';
import {strictJson} from './structured-story.js';
import {storyTools} from './story-tools.js';
import { captureUsage } from './usage.js';
﻿import { readSSE, textFilter } from './stream.js';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { AppError, classify, parseResult, responseShape } from './core.js';
import { PROMPT_VERSION } from './prompts.js';
export function createCaller(config, { fetchImpl = fetch, directory = '.local', timeoutMs = 90000, log = line=>console.info(line), env=process.env } = {}) {
  fs.mkdirSync(directory, { recursive: true });
  const capturedCases=new Set();
  const emit=record=>{if(env.REQUEST_DIAGNOSTICS!=='0')log(JSON.stringify({type:'model_diagnostic',...record}));};
  const auditPath = path.join(directory, 'requests.jsonl');
  async function call(task, messages, options = {}) {
    const trace=activeStoryTrace();const started = Date.now();
    const record = { codeVersion:CODE_VERSION,actualModel:null,failureStage:null,failureReason:null,requestedRange:options.diagnosticRange||null, requestId: randomUUID(), time: new Date().toISOString(), task, model: config.model, promptVersion: PROMPT_VERSION, durationMs: 0, success: false, errorCategory: null, inputTokens: null, outputTokens: null, totalTokens: null, sent: false, site:config.site, usageSource:null, cachedTokens:null, auditGroup:options.auditGroup || null, status:'pending',parentRequestId:options.parentRequestId||null };
    let phaseStart=started;record.phaseMs={};const stage=name=>{if(record.stage)record.phaseMs[record.stage]=(record.phaseMs[record.stage]||0)+Date.now()-phaseStart;record.stage=name;phaseStart=Date.now();};
    if(options.diagnosticClock){const c=options.diagnosticClock;record.clock={asOf:/^\d{4}-\d{2}-\d{2}$/.test(c.asOf)?c.asOf:null,startYear:Number.isInteger(c.startYear)?c.startYear:null,startMonth:Number.isInteger(c.startMonth)?c.startMonth:null};}
    record.build={commit:/^[a-f0-9]{40}$/.test(process.env.RENDER_GIT_COMMIT||'')?process.env.RENDER_GIT_COMMIT:null};
    const scoped=task==='story'&&options.diagnosticCaseId&&options.diagnosticCaseId===env.DIAGNOSTIC_CASE_ID&&Date.parse(env.DIAGNOSTIC_CASE_EXPIRES_AT||'')>Date.now()&&!capturedCases.has(options.diagnosticCaseId);if(scoped)capturedCases.add(options.diagnosticCaseId);
    const evidence=text=>{if(!scoped||typeof text!=='string')return;const safe=redactEvidence(text,config.key),limit=24000,part=safe.slice(0,limit);for(let offset=0;offset<part.length;offset+=1800)log(JSON.stringify({type:'scoped_story_evidence',requestId:record.requestId,caseId:options.diagnosticCaseId,offset,totalLength:safe.length,truncated:safe.length>limit,output:part.slice(offset,offset+1800)}));};
    try {
      if (config.mode !== 'real') throw new AppError('configuration');
      try { fs.appendFileSync(auditPath, ''); } catch { throw new AppError('local_storage',500); }
      options.onStart?.(record.requestId);
      record.sent = true;trace?.modelStart(record.requestId,config.model,task);
      fs.appendFileSync(auditPath,JSON.stringify(record)+'\n');emit(record);
      record.maxCompletionTokens=task==='story'?6000:3500;
      stage('transport');
      const response = await fetchImpl(`${config.base}/chat/completions`, {
        method: 'POST', redirect: 'error',
        headers: { 'Authorization': `Bearer ${config.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.model, messages, ...(task==='story'?{tools:storyTools(messages)}:{}), stream: Boolean(options.onText), ...(options.onText ? {stream_options:{include_usage:true}} : {}), reasoning_split: true, temperature: 1, max_completion_tokens: record.maxCompletionTokens }),
        signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
      });
      record.httpStatus=response.status;
      if(options.onText && response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
        stage('stream');
        const filter=textFilter(); let reply='',finish=null,done=false;
        for await(const data of readSSE(response.body)){
          if(data==='[DONE]'){done=true;break;}
          let item;try{item=JSON.parse(data);}catch{throw new AppError('invalid_response',502);}
          captureUsage(record,item.usage);if(typeof item.model==='string'&&/^[a-zA-Z0-9_.-]{1,80}$/.test(item.model))record.actualModel=item.model;
          if(item.error || Number(item.base_resp?.status_code || 0)) throw new AppError(classify(response.status,item),502);
          const choice=item.choices?.[0]; if(choice?.finish_reason)finish=choice.finish_reason;
          if(typeof choice?.delta?.content==='string'){
            const text=filter(choice.delta.content);
            if(text){if(record.firstBodyMs==null)record.firstBodyMs=Date.now()-started;reply+=text;if(reply.length>6000)throw new AppError('invalid_response',502);options.onText(text);}
          }
        }
        record.streamShape={doneMarker:done,finish:['stop','length','content_filter','tool_calls'].includes(finish)?finish:'unknown',bodyLength:reply.length};
        if(finish!=='stop' || !reply.trim())throw new AppError('invalid_response',502);
        const result={reply,updateType:'none'};options.validateResult?.(result);record.success=true;return {result,requestId:record.requestId};
      }
      if(options.onText && response.ok)throw new AppError('invalid_response',502);
      stage('response_body');
      let body;
      try { body = await response.json(); } catch { throw new AppError(response.ok ? 'invalid_response' : classify(response.status, null), 502); }
      captureUsage(record,body.usage);if(typeof body.model==='string'&&/^[a-zA-Z0-9_.-]{1,80}$/.test(body.model))record.actualModel=body.model;
      evidence(body.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments??body.choices?.[0]?.message?.content);
      record.responseShape = responseShape(body);
      stage('provider');
      record.providerCode=Number.isFinite(Number(body.base_resp?.status_code))?Number(body.base_resp.status_code):null;
      record.reasoningSeparate=typeof body.choices?.[0]?.message?.reasoning_content==='string'||Array.isArray(body.choices?.[0]?.message?.reasoning_details);
      if (!response.ok || body.error || (body.base_resp?.status_code && Number(body.base_resp.status_code) !== 0)) throw new AppError(classify(response.status, body), 502);
      if (body.input_sensitive || body.output_sensitive) throw new AppError('content', 422);
      stage('finish');
      const choice=body.choices?.[0], calls=choice?.message?.tool_calls;
      const structured=task==='story'&&choice?.finish_reason==='tool_calls';
      if (choice?.finish_reason !== 'stop'&&!structured) throw new AppError('invalid_response', 502,{stage:'finish',reason:body.choices?.[0]?.finish_reason==='length'?'output_limit':'not_completed'});
      // 不读取 reasoning_details / reasoning_content；不把原始响应或异常打印出来。
      stage('parse_and_schema');record.parsing={};
      let content=choice.message?.content;
      if(structured){
        const allowed=storyTools(messages).map(t=>t.function.name);
        if(!Array.isArray(calls)||calls.length!==1||!allowed.includes(calls[0]?.function?.name)||typeof calls[0]?.function?.arguments!=='string')throw new AppError('invalid_response',502,{stage:'schema',reason:'invalid_story_tool'});
        content=calls[0].function.arguments;try{strictJson(content);}catch(e){throw new AppError('invalid_response',502,{stage:'schema',reason:e.message.startsWith('duplicate_field:')?'duplicate_field':'invalid_tool_json'});}record.storyTransport='tool_arguments';
      }else {if(calls?.length)throw new AppError('invalid_response',502,{stage:'finish',reason:'unexpected_tool_finish'});record.storyTransport=task==='story'?'content_json':null;}
      record.outputEvidence={length:typeof content==='string'?content.length:null,sha256:typeof content==='string'?createHash('sha256').update(content).digest('hex'):null};
      const result = parseResult(content, task,record.parsing);
      record.parsedShape={kind:result.kind||null,sceneCount:Array.isArray(result.scenes)?result.scenes.length:null,sceneBodyLengths:result.scenes?.map(s=>typeof s.text==='string'?s.text.length:null)||null};
      if(structured&&result.kind!==(calls[0].function.name==='submit_story'?'story':'clarification'))throw new AppError('invalid_response',502,{stage:'schema',reason:'tool_kind_mismatch'});
      stage('business');
      options.validateResult?.(result);
      record.success = true;stage('complete');
      return { result, requestId: record.requestId };
    } catch (error) {
      const safeError = options.signal?.aborted ? new AppError('stopped') : error instanceof AppError ? error : new AppError(error.name === 'TimeoutError' || error.name === 'AbortError' ? 'timeout' : 'network', 502);
      record.failureStage=safeError.diagnostic?.stage || record.stage || 'local';
      record.failureReason=safeError.diagnostic?.reason || safeError.category;
      const field=safeError.diagnostic?.field;if(typeof field==='string' && /^(title|identity|intro|character|opening|scenes\.[0-2](?:\.(time|title|text))?)$/.test(field))record.failureField=field;
      record.errorCategory = safeError.category; safeError.requestId = record.requestId; throw safeError;
    } finally {
      if(record.stage)record.phaseMs[record.stage]=(record.phaseMs[record.stage]||0)+Date.now()-phaseStart;
      record.status=record.success?'success':record.errorCategory==='stopped'?'interrupted':'failed';
      record.durationMs = Date.now() - started;trace?.modelEnd(record);
      emit(record);
      try { fs.appendFileSync(auditPath, JSON.stringify(record) + '\n'); }
      catch { throw new AppError('local_storage', 500); }
    }
  }
  return { call };
}


