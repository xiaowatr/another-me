import {generationInput} from '../server/generation-input.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {memoryInput} from '../src/model-memory.js';
import {memoryClientRecord} from '../server/memory-diagnostic.js';
import {createStoryTasks} from '../server/story-tasks.js';
import {createExperience} from '../server/experience.js';
import {generationSetting} from '../src/effective-setting.js';
﻿
test('reply failure must not block later saved user facts; pending and closing handled separately',()=>{const l={id:'l',sessionMeta:{organizedUntil:0},memories:[],messages:[{id:'u1',role:'user',status:'failed',text:'我最近上班很累'},{id:'u2',role:'user',status:'sent',text:'我在学琵琶'},{id:'a',role:'assistant',text:'我会钢琴'},{id:'u3',role:'user',status:'sent',text:'我会弹《阳春白雪》'},{id:'c',role:'user',kind:'closing',text:'先聊到这里吧'}]};assert.deepEqual(memoryInput(l).messages.map(m=>m.id),['u1','u2','u3']);l.messages[0].status='pending';assert.equal(memoryInput(l).blocked,true);assert.equal(memoryInput(l).messages.length,0);});
test('safe diagnostics discard all content and secrets',()=>{const r=memoryClientRecord({stage:'batch_ready',eligibleMessages:2,text:'private',key:'secret',batchId:randomUUID()},'trace');assert.equal(r.task,'memory');assert.ok(!JSON.stringify(r).includes('private'));assert.ok(!JSON.stringify(r).includes('secret'));assert.equal(memoryClientRecord({stage:'arbitrary'},'t'),null);});
test('separate clarification argument is compiled before request and validation',async()=>{let effective,sent;const app=createExperience({mode:'real',model:'mock',reviewStories:false},{call:async(task,m,options)=>{sent=JSON.parse(m[1].content);assert.deepEqual(sent.effectiveSetting,generationInput(effective));assert.equal(effective.temporal.window.months,3);assert.match(effective.original.realityOutcome,/济南/);assert.ok(!effective.original.realityOutcome.includes('20岁'));return {result:{kind:'clarification',question:'mock ends'},requestId:'mock'};}});await app.story({background:{inputVersion:'6',birthYear:'2000',forkAge:'22',realityOutcome:'2022年我20岁或22岁，我搬到青岛，又一直留在济南。',hypotheticalDirection:'假设留在济南，又想搬去青岛。',details:''},clarification:'确认：2022年22岁，现实一直留在济南读研、没有搬家；假设接受岗位并搬去青岛工作，只看随后三个月。'},{onSetting:x=>effective=x});assert.ok(sent);});
