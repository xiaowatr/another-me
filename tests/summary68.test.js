import test from 'node:test';
import assert from 'node:assert/strict';
import {retainConversationSummary} from '../src/conversation-summary.js';
import {memoryInput,acceptMemoryResult} from '../src/model-memory.js';
import {normalizeMemoryResult} from '../server/memory-extraction.js';
import {persistLifeChange,readLives} from '../src/life-store.js';
import {demoStory} from '../src/services/demo.js';
const make=()=>({id:'summary-test',background:{},story:demoStory,memoryRevision:0,memories:[],candidates:[],sessionMeta:{organizedUntil:0},messages:[{id:'mood',role:'user',text:'今天有点累。'},{id:'question',role:'user',text:'你那边下雨了吗？'},{id:'other',role:'user',text:'朋友在学架子鼓，我只是好奇。',status:'failed'},{id:'role',role:'assistant',text:'我每天画画。'},{id:'closing',role:'user',kind:'closing',text:'系统结束语'}]});
const storage=()=>{const rows=new Map();return {getItem:k=>rows.get(k)||null,setItem:(k,v)=>rows.set(k,v)};};
test('every available user utterance survives save and refresh even without a model result',()=>{
 const life=make(),disk=storage(),saved=persistLifeChange(disk,[life],life.id,life.id,life,retainConversationSummary);
 assert.equal(saved.okay,true);const fresh=readLives(disk).lives[0],rows=fresh.sessionMeta.conversationSummary;
 assert.deepEqual(rows.map(r=>r.sourceId),['mood','question','other']);assert.ok(rows.every(r=>r.mode==='excerpt'));
 assert.deepEqual(retainConversationSummary(fresh).sessionMeta.conversationSummary,rows);
 assert.equal(fresh.memories.length,0);
});
test('model summary can exist without fact cards; missing coverage retains the original utterance',()=>{
 const life=retainConversationSummary(make()),job={id:'batch',input:memoryInput(life),expectedRevision:0};life.sessionMeta.memoryJob=job;
 const result=normalizeMemoryResult({operations:[],conversationSummary:[{sourceId:'mood',text:'当时表示疲惫。'},{sourceId:'role',text:'用户每天画画。'},{sourceId:'question',text:''}]},job.input,job.id);
 const next=acceptMemoryResult(life,job,result),rows=next.sessionMeta.conversationSummary;
 assert.equal(rows[0].mode,'summary');assert.equal(rows[1].mode,'excerpt');assert.equal(rows[2].mode,'excerpt');assert.equal(rows.length,3);
 assert.equal(next.memories.length,0);assert.equal(next.sessionMeta.organizedUntil,0);
 assert.throws(()=>acceptMemoryResult(life,job,{...result,conversationSummary:[{sourceId:'role',text:'wrong'}]}),/memory_source/);
 assert.throws(()=>acceptMemoryResult({...life,memoryRevision:1},job,result),/memory_stale_revision/);
});
test('failed persistence publishes neither summary nor processed cursor; story ownership remains checked',()=>{
 const life=make(),bad={getItem:()=>null,setItem:()=>{throw Error('full');}};
 const saved=persistLifeChange(bad,[life],life.id,life.id,life,retainConversationSummary);
 assert.equal(saved.okay,false);assert.equal(saved.next.sessionMeta.conversationSummary,undefined);
 const job={id:'batch',input:memoryInput(life),expectedRevision:0};life.sessionMeta.memoryJob=job;
 assert.throws(()=>acceptMemoryResult(life,job,{lifeId:'another',batchId:'batch',operations:[],conversationSummary:[]}),/memory_owner/);
});
