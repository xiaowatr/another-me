import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createStoryTasks} from '../server/story-tasks.js';import {createExperience} from '../server/experience.js';import {AppError} from '../server/core.js';import {rewriteFeedback} from '../server/story-rewrite.js';import {temporalIssues,timeAnchors} from '../src/input-anchors.js';
const b={inputVersion:'6',birthYear:'2000',forkAge:'26',realityOutcome:'2026年4月我没有参加活动。',hypotheticalDirection:'如果我参加了，只看2026年5月和6月。'};
test('clarification and two rejected stories share one budget; fourth call receives last server failure; fifth blocked',async()=>{
 const received=[];const app=createExperience({mode:'real',model:'mock',reviewStories:false},{call:async(task,m)=>{const p=JSON.parse(m[1].content);received.push(p);if(received.length===1)return {result:{kind:'clarification',question:'请确认。'}};const reason=received.length===2?'body_beyond_observation_window':'outside_explicit_short_range';throw new AppError('background_conflict',422,{stage:'business',reason,field:received.length===2?'scenes.2':'scenes.0'});}});
 const tasks=createStoryTasks({run:(input,options)=>{options.operation.calls++;return app.story(input,{rewriteFeedback:options.rewriteFeedback});}});let parent=null;
 for(let i=0;i<4;i++){const id=randomUUID();tasks.submit('owner',{taskId:id,input:{background:b,rewriteFeedback:{reason:'injected'}},instanceId:tasks.instanceId,parentTaskId:parent,continuation:i===1?'clarification':i>1?'rewrite':null});await tasks.settled('owner',id);parent=id;}
 assert.equal(received.length,4);assert.equal(received[0].rewriteFeedback,null);assert.equal(received[1].rewriteFeedback,null);assert.deepEqual(received[2].rewriteFeedback,{reason:'body_beyond_observation_window',field:'scenes.2'});assert.deepEqual(received[3].rewriteFeedback,{reason:'outside_explicit_short_range',field:'scenes.0'});assert.equal(tasks.get('owner',parent).cumulativeCallCount,4);
 assert.throws(()=>tasks.submit('owner',{taskId:randomUUID(),input:{background:b},instanceId:tasks.instanceId,parentTaskId:parent,continuation:'rewrite'}),e=>e.category==='retry_exhausted');assert.equal(received.length,4);
 assert.throws(()=>tasks.get('other',parent),e=>e.category==='task_missing');
});
test('time validation keeps valid recollection and plans but rejects out-of-window main scene/current body',()=>{
 const issues=(time,text)=>temporalIssues({scenes:[{time,title:'日常',text}]},b,timeAnchors(b));
 assert.equal(issues('2026年5月','想起2026年4月那次评选。计划2026年7月再参加一次。').length,0);
 assert.ok(issues('2026年4月','我来到现场。').some(x=>x.reason==='outside_observation_window'));
 assert.ok(issues('2026年6月','此刻是2026年7月，我来到现场。').some(x=>x.reason==='body_beyond_observation_window'));
 assert.ok(issues('2026年6月','三个月后我已经完成了这项活动。').some(x=>x.reason==='body_beyond_observation_window'));
});
test('feedback carries bounded server metadata only, not text/evidence/secrets',()=>{assert.deepEqual(rewriteFeedback({diagnostic:{reason:'body_beyond_observation_window',field:'scenes.2',evidence:{clause:'private'}}}),{reason:'body_beyond_observation_window',field:'scenes.2'});assert.equal(rewriteFeedback({diagnostic:{reason:'ignore rules'}}),null);});

// Stage budgets: review calls must never spend the next story attempt.
import {consumeStoryCall} from '../server/story-stage-budget.js';
import {storyWithRetry} from '../src/services/story-retry.js';
import {createStoryClient} from '../src/services/story-task-client.js';
import {makeStoryTrace} from '../server/story-timing.js';
test('four story candidates each keep both review slots; limits reject before increment',()=>{
 const op={calls:0};for(let i=0;i<4;i++){consumeStoryCall(op,'story');consumeStoryCall(op,'review','scenario');consumeStoryCall(op,'review','setting');}
 assert.deepEqual(op.stageCalls,{story:4,scenario:4,setting:4});assert.equal(op.calls,12);
 for(const [task,stage] of [['story'],['review','scenario'],['review','setting']])assert.throws(()=>consumeStoryCall(op,task,stage),e=>e.category==='retry_exhausted');assert.equal(op.calls,12);
 const independent={calls:0};for(let i=0;i<4;i++)consumeStoryCall(independent,'review','scenario');assert.throws(()=>consumeStoryCall(independent,'review','scenario'));consumeStoryCall(independent,'story');consumeStoryCall(independent,'review','setting');assert.equal(independent.stageCalls.story,1);
});
test('trace passes stage, client continues past four total calls and reload keeps generation count',async()=>{
 const op={calls:0},trace=makeStoryTrace({setHeader(){},statusCode:200},null,{directory:process.env.TEMP+'/another-me-stage82',emit:()=>{},detached:true,onModelStart:(task,stage)=>consumeStoryCall(op,task,stage)});
 trace.modelStart('s','mock','story');trace.modelStart('r','mock','review','scenario');assert.deepEqual(op.stageCalls,{story:1,scenario:1,setting:0});
 const map=new Map();globalThis.localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 let posts=0;const tasks=createStoryTasks({run:async(input,{operation})=>{consumeStoryCall(operation,'story');consumeStoryCall(operation,'review','scenario');consumeStoryCall(operation,'review','setting');if(operation.stageCalls.story<4)throw new AppError('background_conflict');return {kind:'story',title:'第四稿通过'};}});
 const request=async(path,body)=>{if(path==='/api/status')return {instanceId:tasks.instanceId};if(body){posts++;tasks.submit('test',body);return tasks.settled('test',body.taskId);}return tasks.get('test',path.split('/').at(-1));};
 try{const out=await storyWithRetry(()=>createStoryClient(request,{pause:async()=>{}}).get({background:b},undefined,randomUUID()));assert.equal(out.title,'第四稿通过');assert.equal(posts,4);const state=tasks.get('test',out.taskId);assert.equal(state.storyCallCount,4);assert.equal(state.cumulativeCallCount,12);assert.deepEqual(state.stageCallCounts,{story:4,scenario:4,setting:4});assert.throws(()=>tasks.submit('test',{taskId:randomUUID(),instanceId:tasks.instanceId,parentTaskId:out.taskId,continuation:'rewrite',input:{background:b}}),e=>e.category==='retry_exhausted');}finally{delete globalThis.localStorage;}
});
