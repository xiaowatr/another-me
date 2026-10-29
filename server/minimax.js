import {internalTimelineEnabled} from './internal-timeline.js';
import {assertSafe,SAFETY_RULE} from './content-safety.js';
import {transportError} from './transport-error.js';
import {plainChatContent} from './chat-content.js';
import {chatTools,chatToolStream} from './chat-tools.js';
import {questionTools,receiveQuestionResult} from './question-contract.js';
import {chatEnvelope} from './chat-envelope.js';
import {fillStoryMetadata} from './story-metadata.js';
import {storyRequestInput} from './story-request.js';
import {fillChapterTimes} from './story-time-labels.js';
import {receiveStructured} from './structured-response.js';
import {createFailureEvidence} from './failed-outputs.js';
import {PLANNER_VERSION} from './supplementary-planner.js';
import {activeStoryTrace} from './story-timing.js';
import {MEMORY_PROMPT_VERSION} from './memory-extraction.js';
import {CODE_VERSION,redactEvidence} from './diagnostics.js';
import {strictJson} from './structured-story.js';
import {storyTools,fieldRepairTools} from './story-tools.js';
import { captureUsage } from './usage.js';
﻿import { readSSE, textFilter } from './stream.js';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { AppError, classify, parseResult, responseShape } from './core.js';
import { PROMPT_VERSION } from './prompts.js';
export function createCaller(config, { fetchImpl = fetch, directory = '.local', timeoutMs = 90000, log = line=>console.info(line), env=process.env } = {}) {
  fs.mkdirSync(directory, { recursive: true });
  const capturedCases=new Set(),failureEvidence=env.RETAIN_FAILED_OUTPUTS==='1'?createFailureEvidence(path.join(directory,'failed-outputs')):{save(){}};
  const emit=record=>{if(env.REQUEST_DIAGNOSTICS!=='0')log(JSON.stringify({type:'model_diagnostic',...record}));};
  const auditPath = path.join(directory, 'requests.jsonl');
  async function call(task, messages, options = {}) {
    if(!['story','chat','memory','questions'].includes(task))throw new AppError('configuration',500);
    let failureOutput=null;
    const consumer=options,incremental=task==='chat'&&consumer.incrementalChat===true;let safeBuffer='';options={...consumer,onText:consumer.onText?(text=>{safeBuffer+=text;if(incremental)consumer.onText(text);}):undefined,validateResult:result=>{assertSafe(result);if(!incremental&&consumer.onText&&safeBuffer){consumer.onText(safeBuffer);safeBuffer='';}consumer.validateResult?.(result);}};
    messages=messages.map((m,i)=>i===0&&m.role==='system'?{...m,content:m.content+'\n'+SAFETY_RULE}:m);if(messages[0]?.role!=='system')messages=[{role:'system',content:SAFETY_RULE},...messages];
    const model=task==='memory'?(config.memoryModel||'MiniMax-M3'):config.model;const trace=activeStoryTrace();const started = Date.now();
    const record = { operationId:trace?.record.operationId||options.chatOperationId||null,parentTaskId:trace?.record.parentTaskId||null,attempt:trace?.record.attempt||(task==='chat'?options.chatAttempt:null)||null,codeVersion:CODE_VERSION,actualModel:null,failureStage:null,failureReason:null,requestedRange:options.diagnosticRange?{months:options.diagnosticRange.months,anchor:options.diagnosticRange.anchor,precision:options.diagnosticRange.precision,start:options.diagnosticRange.start,end:options.diagnosticRange.end}:null, requestId: randomUUID(), time: new Date().toISOString(), task, model, promptVersion: task==='memory'?MEMORY_PROMPT_VERSION:task==='questions'?PLANNER_VERSION:PROMPT_VERSION, durationMs: 0, success: false, errorCategory: null, inputTokens: null, outputTokens: null, totalTokens: null, sent: false, site:config.site, usageSource:null, cachedTokens:null, auditGroup:options.auditGroup || null, status:'pending',parentRequestId:options.parentRequestId||null };
    if(task==='memory')record.memoryBatchId=options.memoryBatchId||null;
    if(options.chatRewrite==='direct_echo')record.chatRewrite='direct_echo';
    let phaseStart=started;record.phaseMs={};const stage=name=>{if(record.stage)record.phaseMs[record.stage]=(record.phaseMs[record.stage]||0)+Date.now()-phaseStart;record.stage=name;phaseStart=Date.now();};
    if(options.diagnosticClock){const c=options.diagnosticClock;record.clock={asOf:/^\d{4}-\d{2}-\d{2}$/.test(c.asOf)?c.asOf:null,startYear:Number.isInteger(c.startYear)?c.startYear:null,startMonth:Number.isInteger(c.startMonth)?c.startMonth:null};}
    record.build={commit:/^[a-f0-9]{40}$/.test(process.env.RENDER_GIT_COMMIT||'')?process.env.RENDER_GIT_COMMIT:null};
    const scoped=env.RETAIN_FAILED_OUTPUTS==='1'&&task==='story'&&options.diagnosticCaseId&&options.diagnosticCaseId===env.DIAGNOSTIC_CASE_ID&&Date.parse(env.DIAGNOSTIC_CASE_EXPIRES_AT||'')>Date.now()&&!capturedCases.has(options.diagnosticCaseId);if(scoped)capturedCases.add(options.diagnosticCaseId);
    const evidence=text=>{if(!scoped||typeof text!=='string')return;const safe=redactEvidence(text,config.key),limit=24000,part=safe.slice(0,limit);for(let offset=0;offset<part.length;offset+=1800)log(JSON.stringify({type:'scoped_story_evidence',requestId:record.requestId,caseId:options.diagnosticCaseId,offset,totalLength:safe.length,truncated:safe.length>limit,output:part.slice(offset,offset+1800)}));};
    try {
      if (config.mode !== 'real') throw new AppError('configuration');
      try { fs.appendFileSync(auditPath, ''); } catch { throw new AppError('local_storage',500); }
      options.onStart?.(record.requestId);
      trace?.modelStart(record.requestId,config.model,task);record.sent = true;
      fs.appendFileSync(auditPath,JSON.stringify(record)+'\n');emit(record);
      const noThinking=task==='memory'||task==='questions'||task==='chat';
      record.thinking=noThinking?'disabled':task==='story'?(config.storyThinking||'disabled'):'unchanged';
      record.maxCompletionTokens=options.chatRewrite?800:options.repairFields?(options.repairFields.some(f=>/^chapter[1-3]\.text$/.test(f))?3000:1200):task==='memory'?(config.memoryMaxTokens||2000):task==='story'?6000:3500;
      const transportTools=task==='story'?(options.repairFields?fieldRepairTools(options.repairFields,messages):storyTools(messages)):task==='questions'&&options.questionStage?questionTools(options.questionStage,{hasScenarioCandidate:options.questionHasScenario!==false}):null;
      if(task==='questions')record.questionStage=options.questionStage||null;
      if(options.repairFields)record.repairFields=options.repairFields;
      stage('transport');
      const response = await fetchImpl(`${config.base}/chat/completions`, {
        method: 'POST', redirect: 'error',
        headers: { 'Authorization': `Bearer ${config.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, ...(noThinking?{thinking:{type:'disabled'}}:task==='story'?{thinking:{type:config.storyThinking||'disabled'}}:{}), ...(transportTools?{tools:transportTools,tool_choice:transportTools.length===1?{type:'function',function:{name:transportTools[0].function.name}}:'required'}:options.chatEnvelope&&!options.plainChatReply?{tools:chatTools,tool_choice:{type:'function',function:{name:'submit_chat'}}}:{}), stream: Boolean(options.onText), ...(options.onText ? {stream_options:{include_usage:true}} : {}), reasoning_split: true, temperature: 1, max_completion_tokens: record.maxCompletionTokens }),
        signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
      });
      record.httpStatus=response.status;
      if(options.onText && response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
        stage('stream');
        const envelope=options.chatEnvelope?chatEnvelope(text=>{const safe=textFilterForEnvelope(text);if(safe){if(record.firstBodyMs==null)record.firstBodyMs=Date.now()-started;reply+=safe;if(reply.length>6000)throw new AppError('invalid_response',502);options.onText(safe);}}):null;
        const textFilterForEnvelope=textFilter();
        const filter=textFilter(); let reply='',finish=null,done=false,contentWire='';
        const toolStream=options.chatEnvelope?chatToolStream(text=>envelope.push(text)):null;
        for await(const data of readSSE(response.body)){
          if(data==='[DONE]'){done=true;break;}
          let item;try{item=JSON.parse(data);}catch{throw new AppError('invalid_response',502);}
          captureUsage(record,item.usage);if(typeof item.model==='string'&&/^[a-zA-Z0-9_.-]{1,80}$/.test(item.model))record.actualModel=item.model;
          if(item.error || Number(item.base_resp?.status_code || 0)) throw new AppError(classify(response.status,item),502);
          const choice=item.choices?.[0]; if(choice?.finish_reason)finish=choice.finish_reason;
          if(incremental&&choice?.delta?.tool_calls)throw new AppError('invalid_response',502,{stage:'parse',reason:'chat_tool_unexpected'});
          if(choice?.delta?.tool_calls&&toolStream){try{toolStream.push(choice.delta.tool_calls);}catch(e){record.chatToolShape=toolStream.shape();throw new AppError('invalid_response',502,{stage:'parse',reason:e.message.startsWith('chat_tool_')?e.message:'chat_envelope'});}}
          if(typeof choice?.delta?.content==='string'&&choice.delta.content){
            // Content and tool arguments are independent provider channels. Never concatenate them.
            // Buffer legacy content until EOF; a later tool call is authoritative.
            if(options.chatEnvelope){contentWire+=choice.delta.content;if(contentWire.length>18000)throw new AppError('invalid_response',502,{stage:'parse',reason:'chat_content_size'});continue;}
            const text=filter(choice.delta.content);
            if(incremental&&text&&(reply+text).trim()&&!plainChatContent(reply+text))throw new AppError('invalid_response',502,{stage:'parse',reason:'chat_envelope'});
            if(text){if(record.firstBodyMs==null)record.firstBodyMs=Date.now()-started;reply+=text;if(reply.length>6000)throw new AppError('invalid_response',502);options.onText(text);}
          }
        }
        record.streamShape={doneMarker:done,finish:['stop','length','content_filter','tool_calls'].includes(finish)?finish:'unknown',bodyLength:reply.length};
        if(envelope&&['stop','tool_calls'].includes(finish)){record.chatToolShape=toolStream.shape();if(record.chatToolShape.seen){try{toolStream.finish();}catch(e){throw new AppError('invalid_response',502,{stage:'parse',reason:e.message});}if(finish!=='tool_calls')throw new AppError('invalid_response',502,{stage:'parse',reason:'chat_tool_finish'});record.chatTransport='tool_arguments';record.chatContentShape={length:contentWire.length,ignored:true};}else {if(finish==='tool_calls')throw new AppError('invalid_response',502,{stage:'parse',reason:'chat_tool_missing'});record.chatContentShape={length:contentWire.length,ignored:false};const plain=plainChatContent(contentWire);if(plain){if(options.requireStructuredChat)throw new AppError('invalid_response',502,{stage:'parse',reason:'chat_tool_missing'});const safe=textFilterForEnvelope(plain);if(!safe.trim())throw new AppError('invalid_response',502);reply=safe;if(record.firstBodyMs==null)record.firstBodyMs=Date.now()-started;options.onText(safe);const result={reply,updateType:'none',memoryOperations:[],...(options.plainChatReply?{chatProtocol:'plain_text'}:{chatProtocolError:'missing_structured_reply'})};record.chatTransport='plain_text';record.chatDegraded=!options.plainChatReply;record.chatMemoryStatus='not_requested';record.chatProtocolStatus=options.plainChatReply?'plain_text':'degraded';record.streamShape.bodyLength=reply.length;options.validateResult?.(result);record.success=true;return {result,requestId:record.requestId};}record.chatTransport='content_json';try{envelope.push(contentWire);}catch(e){record.chatEnvelopeShape=envelope.shape();record.chatEnvelopeError=/^chat_envelope_[a-z_]+$/.test(e.message)?e.message:'invalid_json';throw new AppError('invalid_response',502,{stage:'parse',reason:'chat_envelope'});}}record.chatEnvelopeShape=envelope.shape();let result;try{result=envelope.finish();}catch(e){const reason=String(e.message||'');record.chatEnvelopeError=/^chat_envelope_[a-z_]+$/.test(reason)?reason:reason.startsWith('duplicate_field:')?'duplicate_field':'invalid_json';throw new AppError('invalid_response',502,{stage:'parse',reason:'chat_envelope'});}if(!reply.trim())throw new AppError('invalid_response',502);result.reply=reply;record.streamShape.bodyLength=reply.length;options.validateResult?.(result);record.success=true;return {result,requestId:record.requestId};}
        if(finish!=='stop' || !reply.trim())throw new AppError('invalid_response',502);
        const result={reply,updateType:'none',...(incremental?{memoryOperations:[],chatProtocol:'plain_text'}:{})};if(incremental){record.chatTransport='plain_text';record.chatDelivery='incremental_checked_sentences';record.chatMemoryStatus='not_requested';record.chatProtocolStatus='plain_text';}options.validateResult?.(result);record.success=true;return {result,requestId:record.requestId};
      }
      if(options.onText && response.ok)throw new AppError('invalid_response',502);
      stage('response_body');
      let body;
      try { body = await response.json(); } catch { throw new AppError(response.ok ? 'invalid_response' : classify(response.status, null), 502); }
      failureOutput=body.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments??body.choices?.[0]?.message?.content;
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
      const structured=!!transportTools&&choice?.finish_reason==='tool_calls';
      if (choice?.finish_reason !== 'stop'&&!structured) throw new AppError(choice?.finish_reason==='length'?'output_limit':'invalid_response', 502,{stage:'finish',reason:choice?.finish_reason==='length'?'output_limit':'not_completed'});
      // 不读取 reasoning_details / reasoning_content；不把原始响应或异常打印出来。
      stage('parse_and_schema');record.parsing={};
      let content=choice.message?.content;
      if(structured){
        const allowed=transportTools.map(t=>t.function.name);
        record.toolStructure={violation:!Array.isArray(calls)?'not_array':calls.length!==1?'call_count':!allowed.includes(calls[0]?.function?.name)?'unapproved_function':typeof calls[0]?.function?.arguments!=='string'?'argument_type':null,isArray:Array.isArray(calls),count:Array.isArray(calls)?calls.length:null,items:Array.isArray(calls)?calls.slice(0,5).map(c=>({functionPresent:!!c?.function,nameAllowed:allowed.includes(c?.function?.name),argumentType:typeof c?.function?.arguments,argumentLength:typeof c?.function?.arguments==='string'?c.function.arguments.length:null})):[]};
        if(!Array.isArray(calls)||calls.length!==1||!allowed.includes(calls[0]?.function?.name)||typeof calls[0]?.function?.arguments!=='string')throw new AppError('invalid_response',502,{stage:'schema',reason:task==='questions'?'invalid_question_tool':'invalid_story_tool'});
        content=calls[0].function.arguments;try{strictJson(content);}catch(e){throw new AppError('invalid_response',502,{stage:'schema',reason:e.message.startsWith('duplicate_field:')?'duplicate_field':'invalid_tool_json'});}record[task==='questions'?'questionTransport':'storyTransport']='tool_arguments';
      }else {if(calls?.length)throw new AppError('invalid_response',502,{stage:'finish',reason:'unexpected_tool_finish'});record[task==='questions'?'questionTransport':'storyTransport']=transportTools?'content_json':null;}
      record.outputEvidence={length:typeof content==='string'?content.length:null,sha256:typeof content==='string'?createHash('sha256').update(content).digest('hex'):null};
      let internalTimeline=null,internalTimeDiagnostics=[];
      if(transportTools){
        const received=task==='questions'?receiveQuestionResult(content,transportTools,options.questionStage,record.parsing):receiveStructured(content,task,transportTools,messages,record.parsing);
        record.schemaValidation={valid:received.errors.length===0,errors:received.errors.slice(0,60),repairs:received.repairs};
        if(received.errors.length){throw new AppError('invalid_response',502,{stage:'schema',reason:'structured_schema',field:received.errors[0].path});}
        if(task==='story'&&!options.repairFields&&storyRequestInput(messages).generationStage==='body'&&received.data.kind==='story'){fillChapterTimes(received.data,storyRequestInput(messages).effectiveSetting);received.data=fillStoryMetadata(received.data,storyRequestInput(messages).effectiveSetting);record.programFilledChapterTimes=true;record.programFilledStoryMetadata=true;}
        if(task==='story'&&!options.repairFields&&received.data.kind==='story'&&internalTimelineEnabled(storyRequestInput(messages).effectiveSetting)){internalTimeline=received.internalTimeline;internalTimeDiagnostics=received.internalTimeDiagnostics||[];record.internalTimeDiagnostics=internalTimeDiagnostics;}
        content=JSON.stringify(received.data);
      }
      const normalizedParsing=transportTools?{}:record.parsing;
      if(task==='story'){normalizedParsing.fixedThreeChapters=true;normalizedParsing.bodyOnly=!options.repairFields&&storyRequestInput(messages).generationStage==='body';}
      const result = options.repairFields?JSON.parse(content):parseResult(content, task,normalizedParsing);
      if(transportTools)for(const [key,value]of Object.entries(normalizedParsing))if(key!=='parseMode')record.parsing[key]=value;
      record.parsedShape={kind:result.kind||null,sceneCount:Array.isArray(result.scenes)?result.scenes.length:null,sceneBodyLengths:result.scenes?.map(s=>typeof s.text==='string'?s.text.length:null)||null};
      if(structured&&task==='story'&&result.kind!==(calls[0].function.name==='submit_story'?'story':'clarification'))throw new AppError('invalid_response',502,{stage:'schema',reason:'tool_kind_mismatch'});
      stage('business');
      options.validateResult?.(result);
      record.success = true;stage('complete');
      return { result, requestId: record.requestId, ...(internalTimeline?{internalTimeline,internalTimeDiagnostics}:{} ) };
    } catch (error) {
      const transport=!(error instanceof AppError)?transportError(error):null;
      if(transport&&!options.signal?.aborted)record.transportError={kind:transport.kind,codes:transport.codes,retryable:transport.retryable};
      const safeError = options.signal?.aborted ? new AppError('stopped') : error instanceof AppError ? error : new AppError(transport.timedOut?'timeout':'network',502,{stage:record.stage,reason:'transport_'+transport.kind,retryable:transport.retryable});
      // Only a known connection timeout before HTTP headers can restart an unseen chat.
      if(task==='chat'&&transport?.retryable&&transport.codes.includes('UND_ERR_CONNECT_TIMEOUT')&&record.stage==='transport'&&record.httpStatus==null&&!safeBuffer&&!options.signal?.aborted){safeError.diagnostic.retryableBeforeResponse=true;record.retryableBeforeResponse=true;}
      if(safeBuffer)safeError.replyReceived=true;
      record.failureStage=safeError.diagnostic?.stage || record.stage || 'local';
      record.failureReason=safeError.diagnostic?.reason || safeError.category;
      if(task==='questions'&&safeError.diagnostic?.questionIdIssue)record.questionIdIssue=safeError.diagnostic.questionIdIssue;
      if(task==='story'&&['invalid_response','output_limit'].includes(safeError.category))try{failureEvidence.save(record,failureOutput,config.key);}catch{record.failureEvidenceUnavailable=true;}
      const field=safeError.diagnostic?.field;if(typeof field==='string' && /^(title|identity|intro|character|opening|scenes\.[0-3](?:\.(time|title|text))?)$/.test(field))record.failureField=field;
      if(scoped&&safeError.diagnostic?.evidence){const e=safeError.diagnostic.evidence;log(JSON.stringify({type:'scoped_temporal_evidence',requestId:record.requestId,caseId:options.diagnosticCaseId,field:record.failureField,reason:record.failureReason,chapterTime:redactEvidence(String(e.chapterTime||''),config.key).slice(0,120),bodyDate:e.bodyDate,scope:e.scope,rule:e.rule,clause:redactEvidence(String(e.clause||''),config.key).slice(0,240)}));}
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


