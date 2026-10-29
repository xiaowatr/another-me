import test from 'node:test';import assert from 'node:assert/strict';
import {createStoryTasks} from '../server/story-tasks.js';
import {createStoryClient} from '../src/services/story-task-client.js';
test('story retry status reflects a rejected draft and clears on success or cancellation',async()=>{
 let release;const tasks=createStoryTasks({run:async(input,{poolState,onDraft})=>{poolState.generated=1;onDraft({id:'first',eligible:false});await new Promise(r=>release=r);return {kind:'story'};}}),id=crypto.randomUUID();
 const view=tasks.submit('owner',{taskId:id,instanceId:tasks.instanceId,input:{background:{}}});assert.equal(view.retrying,true);release();assert.equal((await tasks.settled('owner',id)).retrying,false);
 let finish;const cancelled=createStoryTasks({run:async(input,{poolState,onDraft})=>{poolState.generated=1;onDraft({id:'first',eligible:false});await new Promise(r=>finish=r);return {};}}),cid=crypto.randomUUID();cancelled.submit('owner',{taskId:cid,instanceId:cancelled.instanceId,input:{background:{}}});assert.equal(cancelled.cancel('owner',cid).retrying,false);finish();await cancelled.settled('owner',cid);
});
test('story polling carries actual retry state into the existing UI callback without another submission',async()=>{
 const prior=globalThis.localStorage,map=new Map();globalThis.localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};let posts=0,polls=0;const states=[];
 try{const client=createStoryClient(async(route,body)=>{if(route==='/api/status')return {instanceId:'test-instance'};if(route==='/api/story'){posts++;return {status:'running',retrying:false};}polls++;return polls===1?{status:'running',retrying:true}:{status:'succeeded',retrying:false,result:{kind:'story',requestId:'one-result'}};},{pause:async()=>{}});
  await client.get({background:{realityOutcome:'合成',hypotheticalDirection:'合成变化'}},new AbortController().signal,crypto.randomUUID(),()=>{},()=>{},value=>states.push(value));assert.equal(posts,1);assert.deepEqual(states,[false,true,false]);
 }finally{if(prior===undefined)delete globalThis.localStorage;else globalThis.localStorage=prior;}
});
