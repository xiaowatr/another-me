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
