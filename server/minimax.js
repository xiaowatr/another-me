import {storyTools} from './story-tools.js';
import { captureUsage } from './usage.js';
﻿import { readSSE, textFilter } from './stream.js';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppError, classify, parseResult, responseShape } from './core.js';
import { PROMPT_VERSION } from './prompts.js';
export function createCaller(config, { fetchImpl = fetch, directory = '.local', timeoutMs = 90000 } = {}) {
  fs.mkdirSync(directory, { recursive: true });
  const auditPath = path.join(directory, 'requests.jsonl');
  async function call(task, messages, options = {}) {
    const started = Date.now();
    const record = { requestId: randomUUID(), time: new Date().toISOString(), task, model: config.model, promptVersion: PROMPT_VERSION, durationMs: 0, success: false, errorCategory: null, inputTokens: null, outputTokens: null, totalTokens: null, sent: false, site:config.site, usageSource:null, cachedTokens:null, auditGroup:options.auditGroup || null, status:'pending' };
    try {
      if (config.mode !== 'real') throw new AppError('configuration');
      try { fs.appendFileSync(auditPath, ''); } catch { throw new AppError('local_storage',500); }
      options.onStart?.(record.requestId);
      record.sent = true;
      fs.appendFileSync(auditPath,JSON.stringify(record)+'\n');
      record.maxCompletionTokens=task==='story'?6000:3500;
      record.stage='transport';
      const response = await fetchImpl(`${config.base}/chat/completions`, {
        method: 'POST', redirect: 'error',
        headers: { 'Authorization': `Bearer ${config.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.model, messages, ...(task==='story'?{tools:storyTools(messages)}:{}), stream: Boolean(options.onText), ...(options.onText ? {stream_options:{include_usage:true}} : {}), reasoning_split: true, temperature: 1, max_completion_tokens: record.maxCompletionTokens }),
        signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
      });
      record.httpStatus=response.status;
      if(options.onText && response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
        record.stage='stream';
        const filter=textFilter(); let reply='',finish=null,done=false;
        for await(const data of readSSE(response.body)){
          if(data==='[DONE]'){done=true;break;}
          let item;try{item=JSON.parse(data);}catch{throw new AppError('invalid_response',502);}
          captureUsage(record,item.usage);
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
      record.stage='response_body';
      let body;
      try { body = await response.json(); } catch { throw new AppError(response.ok ? 'invalid_response' : classify(response.status, null), 502); }
      captureUsage(record,body.usage);
      record.responseShape = responseShape(body);
      record.stage='provider';
      record.providerCode=Number.isFinite(Number(body.base_resp?.status_code))?Number(body.base_resp.status_code):null;
      record.reasoningSeparate=typeof body.choices?.[0]?.message?.reasoning_content==='string'||Array.isArray(body.choices?.[0]?.message?.reasoning_details);
      if (!response.ok || body.error || (body.base_resp?.status_code && Number(body.base_resp.status_code) !== 0)) throw new AppError(classify(response.status, body), 502);
      if (body.input_sensitive || body.output_sensitive) throw new AppError('content', 422);
      record.stage='finish';
      const choice=body.choices?.[0], calls=choice?.message?.tool_calls;
      const structured=task==='story'&&choice?.finish_reason==='tool_calls';
      if (choice?.finish_reason !== 'stop'&&!structured) throw new AppError('invalid_response', 502,{stage:'finish',reason:body.choices?.[0]?.finish_reason==='length'?'output_limit':'not_completed'});
      // 不读取 reasoning_details / reasoning_content；不把原始响应或异常打印出来。
      record.stage='parse_and_schema';record.parsing={};
      let content=choice.message?.content;
      if(structured){
        const allowed=storyTools(messages).map(t=>t.function.name);
        if(!Array.isArray(calls)||calls.length!==1||!allowed.includes(calls[0]?.function?.name)||typeof calls[0]?.function?.arguments!=='string')throw new AppError('invalid_response',502,{stage:'schema',reason:'invalid_story_tool'});
        content=calls[0].function.arguments;record.storyTransport='tool_arguments';
      }else {if(calls?.length)throw new AppError('invalid_response',502,{stage:'finish',reason:'unexpected_tool_finish'});record.storyTransport=task==='story'?'content_json':null;}
      const result = parseResult(content, task,record.parsing);
      if(structured&&result.kind!==(calls[0].function.name==='submit_story'?'story':'clarification'))throw new AppError('invalid_response',502,{stage:'schema',reason:'tool_kind_mismatch'});
      record.stage='business';
      options.validateResult?.(result);
      record.success = true;record.stage='complete';
      return { result, requestId: record.requestId };
    } catch (error) {
      const safeError = options.signal?.aborted ? new AppError('stopped') : error instanceof AppError ? error : new AppError(error.name === 'TimeoutError' || error.name === 'AbortError' ? 'timeout' : 'network', 502);
      record.failureStage=safeError.diagnostic?.stage || record.stage || 'local';
      record.failureReason=safeError.diagnostic?.reason || safeError.category;
      const field=safeError.diagnostic?.field;if(typeof field==='string' && /^(title|identity|intro|character|opening|scenes\.[0-2](?:\.(time|title|text))?)$/.test(field))record.failureField=field;
      record.errorCategory = safeError.category; safeError.requestId = record.requestId; throw safeError;
    } finally {
      record.status=record.success?'success':record.errorCategory==='stopped'?'interrupted':'failed';
      record.durationMs = Date.now() - started;
      try { fs.appendFileSync(auditPath, JSON.stringify(record) + '\n'); }
      catch { throw new AppError('local_storage', 500); }
    }
  }
  return { call };
}


