import test from 'node:test';
import assert from 'node:assert/strict';
import {planWithGapCheck} from '../server/supplementary-planner.js';
import {migrateBackground} from '../src/background.js';
import {saveSupplement,supplementState} from '../src/supplementary.js';
const b=migrateBackground({realityOutcome:'原先想和小陈一起去外地，后来都没去。',hypotheticalDirection:'这一次一个人出发，一个人留下。',details:'我和小陈谁走谁留，目前还没说清。'});
const gap={key:'departure_assignment',missingInformation:'这次是我出发小陈留下，还是小陈出发我留下',whyMissing:'原文没有明确分别由谁行动',useInStory:'确定出发一侧和留下一侧的行动',sourceId:'hypotheticalDirection',evidence:b.hypotheticalDirection};
const optional={id:'G04',questionText:'另一条路，最吸引你的是什么？',reason:'辅助偏好',informationGain:2,missingInformation:'目的地的吸引点',useInStory:'场景细节'};
const selection=(gaps=[gap])=>({questions:[optional],covered:[],criticalUnknowns:gaps,scenarioCandidates:[],expectations:{},stop:false});
const reviewed=(base,questions=[],extra={})=>({questions,covered:[],criticalUnknowns:[],keepScenario:false,changeSubject:'unknown',evidence:base.hypotheticalDirection,stop:false,...extra});
async function run(base=b,{gaps=[gap],select=selection(gaps),review}={}){
 let calls=0,payload;
 const result=await planWithGapCheck(base,{call:async(task,m,o)=>{calls++;let result=select;if(o.questionStage==='review'){payload=JSON.parse(m[1].content);result=review(payload);}o.validateResult(result);return {result};}},{sleep:async()=>{}});
 return {result,calls,payload};
}
test('an evidenced missing gap becomes a text candidate before the existing review, which can keep it',async()=>{
 const {result,calls}=await run(b,{review:p=>{const q=p.candidates.find(q=>q.criticalGapKey===gap.key);assert.ok(q);assert.match(q.questionText,/我出发小陈留下/);assert.match(q.id,/^K/);assert.deepEqual(q.options,[]);assert.equal(p.criticalGapCoverage[0].questionId,q.id);return reviewed(b,[q]);}});
 assert.equal(calls,2);assert.equal(result.questions.length,1);assert.match(result.questions[0].questionText,/我出发小陈留下/);assert.equal(result.stop,true);
});
test('review removal never resurrects a generated candidate or fabricates an answer',async()=>{
 const {result,calls,payload}=await run(b,{review:()=>reviewed(b,[])});
 assert.equal(calls,2);assert.ok(payload.candidates.some(q=>q.criticalGapKey===gap.key));assert.deepEqual(result.questions,[]);assert.equal(result.criticalUnknowns[0].resolvedBy,undefined);
});
test('existing answer or explicit skip is not reasked through a new slot',async()=>{
 for(const skipped of [false,true]){
  const g={...gap,questionId:'K1',questionText:'这次谁出发？'},s=supplementState(b);
  const saved=saveSupplement(b,{...s,shown:['K1'],pages:[['K1']],answers:{K1:{selected:[],text:skipped?'':'我出发，小陈留下',skipped}},questionMeta:{K1:{questionText:g.questionText}},criticalUnknowns:[g]});
  const {payload}=await run(saved,{gaps:[g],review:()=>reviewed(saved,[])});
  if(payload)assert.ok(!payload.candidates.some(q=>q.criticalGapKey===gap.key));
 }
});
test('ungrounded, resolved or fixed identity gaps cannot generate candidates',async()=>{
 for(const g of [{...gap,evidence:'不存在的原文'},{...gap,resolvedBy:{sourceId:'details',evidence:b.details}},{...gap,missingInformation:'这次故事的主角是谁'}]){
  const {payload}=await run(b,{gaps:[g],review:()=>reviewed(b,[])});assert.ok(!payload.candidates.some(q=>q.criticalGapKey===gap.key));
 }
});
test('candidate wording pollution is rejected, not displayed as a quoted question',async()=>{
 for(const text of ['```谁出发```','<b>谁留下</b>',':cite[bad]']){
  const {payload}=await run(b,{gaps:[{...gap,missingInformation:text}],review:()=>reviewed(b,[])});assert.ok(!payload.candidates.some(q=>q.criticalGapKey===gap.key));
 }
});
test('review rejection does not retry or display an unreviewed question',async()=>{
 let calls=0;const result=await planWithGapCheck(b,{call:async(task,m,o)=>{calls++;if(o.questionStage==='review')throw Object.assign(new Error('offline review failure'),{category:'network',diagnostic:{retryable:false}});const result=selection();o.validateResult(result);return {result};}},{sleep:async()=>{}});
 assert.equal(calls,2);assert.equal(result.optionalAnalysisUnavailable,true);assert.deepEqual(result.questions,[]);
});
test('a new candidate avoids previously used slots and remains within the three-question cap',async()=>{
 const s=supplementState(b),saved=saveSupplement(b,{...s,shown:['K1'],pages:[['K1']],answers:{K1:{selected:[],text:'旧答案',skipped:false}},questionMeta:{K1:{questionText:'旧题'}}});
 const {result}=await run(saved,{review:p=>{const q=p.candidates.find(q=>q.criticalGapKey===gap.key);assert.equal(q.id,'K2');return reviewed(saved,[q,optional]);}});assert.ok(result.questions.length<=3);assert.equal(result.questions[0].id,'K2');
});
test('unrelated optional unknowns remain subject to reviewer removal instead of becoming mandatory',async()=>{
 const g={...gap,key:'optional_scene',missingInformation:'门口的天气细节',whyMissing:'原文未提供天气',useInStory:'可能丰富布景'};
 const {result,payload}=await run(b,{gaps:[g],review:p=>{assert.ok(p.criticalGapCoverage.some(x=>x.key===g.key));return reviewed(b,[]);}});assert.deepEqual(result.questions,[]);assert.equal(result.conflict,null);assert.equal(payload.criticalGapCoverage[0].requiredToAnswer,false);
});
test('review cannot keep a new gap by ID while omitting its actual question wording',async()=>{
 const {result}=await run(b,{review:p=>{const q={...p.candidates.find(q=>q.criticalGapKey===gap.key)};delete q.questionText;return reviewed(b,[q]);}});
 assert.deepEqual(result.questions,[]);
});
test('two independently reviewed missing gaps can share the same group within the three-question limit',async()=>{
 const other={...gap,key:'relation',missingInformation:'小陈与我是什么关系',useInStory:'决定人物称呼和关系前提'};
 const {result,calls}=await run(b,{gaps:[gap,other],review:p=>reviewed(b,p.candidates.filter(q=>q.criticalGapKey))});
 assert.equal(calls,2);assert.equal(result.questions.length,2);assert.equal(new Set(result.questions.map(q=>q.id)).size,2);
});
