import {storyOutputIssues} from './story-output-checks.js';
import {scenarioReviewMessages,validateScenarioReview} from './scenario-review.js';
import {openingAddresseeConflict} from '../src/participant-identity.js';
import {createPlannerTasks,planWithGapCheck,normalizePlan,PLANNER_VERSION} from './supplementary-planner.js';
import {memoryMessages,normalizeMemoryResult} from './memory-extraction.js';
import {storyClock} from '../src/story-clock.js';
import {publicQuestion} from '../src/public-question.js';
import {currentOwner,createSlots} from './request-owner.js';
import {activeStoryTrace,PROCESS_STARTED_AT} from './story-timing.js';
import {rolePresentation,presentNewStory} from '../src/role-presentation.js';
import {CODE_VERSION,diagnosticRange,takeDiagnosticCase} from './diagnostics.js';
import {hardConflicts,applyClarification,temporalIssues} from '../src/input-anchors.js';
import {reviewMessages,validateReview} from './setting-review.js';
import {compileSetting,settingIssues} from '../src/effective-setting.js';
import {recallTarget,inputConflicts} from '../src/consistency.js';
import {readableText,readableResult} from './readable-text.js';
import {reviewStory,inspectFactText} from '../src/fact-frame.js';
import {qualifyCurrentAge,historyRisk} from '../src/session-context.js';
import {migrateBackground} from '../src/background.js';
﻿import { checkStoryGrounding, checkChatGrounding } from './grounding.js';
import { selectEra } from './era.js';
import { coordinates } from '../src/context.js';
import { randomUUID } from 'node:crypto';
import { AppError, validateBackground, parseResult } from './core.js';
import { storyMessages, chatMessages, streamingChatMessages, PROMPT_VERSION } from './prompts.js';
import { demoStory, demoProvider } from '../src/services/demo.js';
export function createExperience(config, caller, recordLocal = () => {}) {
  const questionTasks=createPlannerTasks(b=>exclusive('questions',async()=>{if(config.mode==='demo')return normalizePlan({questions:[],covered:[],expectations:{}},b);return planWithGapCheck(b,caller);}));
  const sessions = new Map();
  const slots=createSlots(config.maxConcurrent||3);
  async function exclusive(task, fn) {
    const started = Date.now(); let upstreamRecorded = false; let success = false; let category = null; let release = null;
    try {
      release=slots.acquire(currentOwner(),task);
      const result = await fn(); upstreamRecorded = Boolean(result.requestId); success = true; return result;
    } catch (e) { if(!release&&e.category==='busy')e.retryableBeforeModel=true;upstreamRecorded = Boolean(e.requestId); category = e.category || 'upstream'; throw e; }
    finally {
      release?.();
      if (!upstreamRecorded) recordLocal({requestId: randomUUID(),time:new Date().toISOString(),task,model:config.model,promptVersion:task==='questions'?PLANNER_VERSION:PROMPT_VERSION,durationMs:Date.now()-started,success,errorCategory:category,inputTokens:null,outputTokens:null,totalTokens:null,sent:false,mode:config.mode});
    }
  }
  function session(id) { const s = sessions.get(id); if (!s || s.owner!==currentOwner() || Date.now() - s.updated > 2 * 60 * 60 * 1000) { if(s?.owner===currentOwner())sessions.delete(id); throw new AppError('session', 410); } return s; }
  return {
    questions:input=>questionTasks(currentOwner(),validateBackground(migrateBackground(input.background))),
    availability:()=>slots.availability(currentOwner()),
    checkAvailable:owner=>slots.check(owner),
    memory:(data,batchId)=>exclusive('memory',async()=>{const response=await caller.call('memory',memoryMessages(data),{memoryBatchId:batchId,validateResult:r=>normalizeMemoryResult(r,data,batchId)});return {...normalizeMemoryResult(response.result,data,batchId),requestId:response.requestId};}),
    restore(input){
      // Restoring one browser never blocks an unrelated browser.
      slots.checkOwner(currentOwner());
      const data=input.snapshot;
      if(!data || !Array.isArray(data.history) || data.history.length>12 || !Array.isArray(data.memories) || data.memories.length>30)throw new AppError('input');
      const background=validateBackground(migrateBackground(data.background)),story=parseResult(JSON.stringify(data.story),'story');
      if(story.kind!=='story')throw new AppError('input');
      const history=data.history.map(m=>{if(!['user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>6000)throw new AppError('input');return {role:m.role,content:m.content};});
      const memories=data.memories.filter(m=>m.sourceRole!=='assistant'||m.type==='fiction').map(m=>{if(!['reality','preference','fiction'].includes(m.type)||typeof m.text!=='string'||!m.text.trim()||m.text.length>1000)throw new AppError('input');return {id:String(m.id).slice(0,80),type:m.type,text:m.text,sourceYear:Number.isInteger(m.sourceYear)?m.sourceYear:null};});
      const id=randomUUID();if(input.previousSessionId&&sessions.get(input.previousSessionId)?.owner===currentOwner())sessions.delete(input.previousSessionId);
      if(sessions.size>=20)sessions.delete(sessions.keys().next().value);
      const restoredCorrections=Array.isArray(data.corrections)?data.corrections.filter(c=>['reality','fiction','identity','chat_time','event_order'].includes(c.type)&&typeof c.text==='string'&&c.text.length<=2000).slice(-20):[];
      const roleRecords=Array.isArray(data.roleRecords)?data.roleRecords.filter(r=>['statement','plan','uncertain'].includes(r.kind)&&typeof r.text==='string'&&r.text.length<=600&&!historyRisk(r.text,background,memories)).slice(-300).map(r=>({sourceId:String(r.sourceId||'').slice(0,120),kind:r.kind,text:r.text})):[];
      sessions.set(id,{owner:currentOwner(),background,story,history,memories,roleRecords,corrections:restoredCorrections,updated:Date.now()});
      return {sessionId:id,mode:config.mode};
    },
    seen(input) {
      const s=session(input.sessionId),p=s.pending;
      if(!p || p.id!==input.turnId || typeof input.text!=='string' || !p.text.startsWith(input.text) || input.text.length<p.seen.length)throw new AppError('input');
      p.seen=input.text;
      // Replace this turn's history from its original snapshot, never append unseen text.
      s.history=[...p.history,{role:'user',content:p.message},...(p.seen.trim()?[{role:'assistant',content:p.seen}]:[])].slice(-12);s.updated=Date.now();
      if(input.stop)p.controller.abort();
      return {ok:true};
    },
    chatStream: (input,emit,signal) => exclusive('chat',async()=>{
      const s=session(input.sessionId),message=input.message?.trim(),intent=input.intent || 'chat';
      if(!message || message.length>2000 || !['chat','reality','fiction'].includes(intent))throw new AppError('input');
      if(s.corrections.length>=20)throw new AppError('memory_full');
      const controller=new AbortController();
      const p={id:randomUUID(),text:'',seen:'',message,history:[...s.history],controller};s.pending=p;
      // Unconfirmed chat corrections remain in recent conversation; only UI-confirmed memories are pinned.
      emit({type:'start',turnId:p.id,corrections:s.corrections});
      let buffered='';
      const forward=text=>{text=qualifyCurrentAge(rolePresentation(readableText(text),s.background),s.background,s.story);const risks=inspectFactText(text,s.background,{memories:s.memories,anchorYear:storyClock(s.background,s.story).year});if(risks.length)throw new AppError('background_conflict',422,{stage:'business',reason:risks[0]});checkChatGrounding(text,s.background,s.memories || [],JSON.stringify({story:s.story,roleRecords:s.roleRecords,fiction:s.memories.filter(m=>m.type==='fiction')}),recallTarget(message));p.text+=text;emit({type:'text',text});};
      const onText=text=>{buffered+=text;let match;while((match=/[。！？!?\n]/.exec(buffered))){const end=match.index+1;const sentence=buffered.slice(0,end);buffered=buffered.slice(end);forward(sentence);}};
      const response=config.mode==='demo'?{result:{reply:await demoProvider.reply({turn:s.history.length/2})}}:await caller.call('chat',streamingChatMessages(s,message,intent),{onText,validateResult:()=>{if(buffered){forward(buffered);buffered='';}},onStart:requestId=>emit({type:'request',requestId}),signal:AbortSignal.any([signal,controller.signal])});
      if(config.mode==='demo')onText(response.result.reply);
      if(buffered)forward(buffered);
      emit({type:'done',requestId:response.requestId});
      return {requestId:response.requestId};
    }),
    status() { return {maxConcurrent:slots.limit,activeModelTasks:slots.active,storyThinking:config.storyThinking||'disabled',storyMaxCompletionTokens:6000, version:CODE_VERSION,commit:/^[a-f0-9]{40}$/.test(process.env.RENDER_GIT_COMMIT||'')?process.env.RENDER_GIT_COMMIT:null,promptVersion:PROMPT_VERSION,questionPlannerVersion:PLANNER_VERSION,semanticReviewEnabled:Boolean(config.reviewStories),processStartedAt:PROCESS_STARTED_AT, mode: config.mode, site: config.site, model: config.model,  }; },
    story: (input,{signal,onSetting,rewriteFeedback}={}) => exclusive('story', async () => {
      const diagnosticCaseId=takeDiagnosticCase(input.background||{});
      let background = validateBackground(migrateBackground(applyClarification(input.background)),{newSubmission:true});
      if(diagnosticCaseId)background={...background,details:background.details.replace('[诊断:'+diagnosticCaseId+']','').trim()};
      if (typeof (input.clarification ?? '') !== 'string' || (input.clarification || '').length > 2000) throw new AppError('input');
      if(input.clarification)background=validateBackground(migrateBackground(applyClarification({...background,followupKey:hardConflicts(background).length?'hard-conflict':background.followupKey||'model',followupAnswer:input.clarification,followupSkipped:''})),{newSubmission:true});
      const hard=hardConflicts(background);if(hard.length)return {kind:'clarification',hard:true,question:hard.map(h=>h.question+'（'+h.sources.join(' / ')+'）').join('；')+' 可修改原输入，或回答“现实：…”“假设：…”',mode:config.mode};
      const conflicts=inputConflicts(background);if(conflicts.length){return {kind:'clarification',hard:true,question:'想确认一下：'+conflicts.join('；')+'？',mode:config.mode};}
      const effective=compileSetting(background);effective.originalInput={...input.background};if(effective.clarifications.length){if(input.clarificationSkipped)throw new AppError('input_conflict',422);return {kind:'clarification',question:effective.clarifications.join('；'),mode:config.mode};}
      onSetting?.(effective);
      activeStoryTrace()?.mark('input_compiled');
      const response = config.mode === 'demo' ? { result: { ...demoStory, kind: 'story', character: demoStory.intro, opening: '【固定演示开场】刚刚关了书店，你想聊些什么？' } } : await caller.call('story', storyMessages(background, input.clarification || '', !input.clarificationSkipped,effective,rewriteFeedback),{signal,diagnosticCaseId,diagnosticRange:diagnosticRange(effective.temporal),diagnosticClock:{asOf:effective.temporal.asOf,startYear:effective.temporal.start?.year??null,startMonth:effective.temporal.start?.month??null},validateResult:result=>{if(result.kind==='clarification' && (background.followupKey || input.clarificationSkipped || input.clarification))throw new AppError('invalid_response',502,{stage:'business',reason:'repeated_clarification'});if(result.kind==='story'){const outputIssue=storyOutputIssues(result,background)[0];if(outputIssue)throw new AppError('background_conflict',422,{stage:'business',...outputIssue});if(openingAddresseeConflict(result.opening,background))throw new AppError('background_conflict',422,{stage:'business',reason:'opening_addressee_conflict',field:'opening'});const conflicts=settingIssues(result,effective);if(conflicts.length)throw new AppError('background_conflict',422,{stage:'business',reason:conflicts[0].reason,field:conflicts[0].field});checkStoryGrounding(result,background,effective.temporal);const review=reviewStory(result,background,[],{strictTime:true});if(review.issues.length)throw new AppError('background_conflict',422,{stage:'business',reason:review.issues[0].reasons[0],field:review.issues[0].field});}}});
      if(config.mode==='real'&&response.result.kind==='story'){const check=scenarioReviewMessages(background,response.result);if(check)await caller.call('review',check,{reviewStage:'scenario',signal,parentRequestId:response.requestId,validateResult:r=>validateScenarioReview(r,response.result)});}
      if(config.mode==='real'&&config.reviewStories&&response.result.kind==='story'){await caller.call('review',reviewMessages(effective,response.result),{reviewStage:'setting',signal,parentRequestId:response.requestId,validateResult:r=>validateReview(r,effective,response.result)});}
      activeStoryTrace()?.mark('model_parse_validation_completed');
      response.result=readableResult(response.result);if(response.result.kind==='story')response.result=presentNewStory(response.result,background);
      if(response.result.kind==='story')response.result.openingVersion=2;
      if (response.result.kind === 'clarification') return { ...response.result, question:publicQuestion(response.result.question), mode: config.mode, requestId: response.requestId };
      const id = randomUUID();
      // 成功重生成才替换旧会话，失败仍保留原故事。设置独立角色和空历史。
      if (input.previousSessionId&&sessions.get(input.previousSessionId)?.owner===currentOwner()) sessions.delete(input.previousSessionId);
      for (const [key, value] of sessions) if (Date.now() - value.updated > 7200000) sessions.delete(key);
      if (sessions.size >= 20) sessions.delete(sessions.keys().next().value);
      const confirmed = {...background};
      sessions.set(id, { owner:currentOwner(),background: confirmed, story: response.result, corrections: [], memories: [], history: [], updated: Date.now() });
      activeStoryTrace()?.mark('session_ready');
      return { background:confirmed,effectiveSetting:effective, eraContext:selectEra(background,coordinates(background)), story: response.result, sessionId: id, mode: config.mode, requestId: response.requestId };
    }),
    chat: (input) => exclusive('chat', async () => {
      const s = session(input.sessionId);
      const message = input.message;
      const intent = input.intent || 'chat';
      if (typeof message !== 'string' || !message.trim() || message.length > 2000 || !['chat','reality','fiction'].includes(intent)) throw new AppError('input');
      if (s.corrections.length >= 20) throw new AppError('memory_full');
      const pending = intent === 'chat' ? [] : [{ type: intent, text: message.trim() }];
      const response = config.mode === 'demo' ? { result: { reply: await demoProvider.reply({ turn: s.history.length / 2 }), updateType: intent === 'chat' ? 'none' : intent } } : await caller.call('chat', chatMessages({ ...s, corrections: [...s.corrections, ...pending] }, message.trim(), intent));
      response.result.reply=qualifyCurrentAge(rolePresentation(readableText(response.result.reply),s.background),s.background,s.story);
      const risks=inspectFactText(response.result.reply,s.background,{memories:s.memories,anchorYear:storyClock(s.background,s.story).year});
      if(risks.length)throw new AppError('background_conflict',422,{stage:'business',reason:risks[0]});
      const type = intent === 'chat' ? 'none' : intent;
      if (type !== 'none') s.corrections.push({ type, text: message.trim() });
      s.history.push({ role: 'user', content: message.trim() }, { role: 'assistant', content: response.result.reply });
      s.history = s.history.slice(-12); s.updated = Date.now();
      return { reply: response.result.reply, corrections: s.corrections, mode: config.mode, requestId: response.requestId };
    }),
  };
}


