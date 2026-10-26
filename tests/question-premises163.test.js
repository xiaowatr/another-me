import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateBackground} from '../src/background.js';
import {normalizePlan,planWithGapCheck,plannerMessages} from '../server/supplementary-planner.js';
import {saveSupplement,supplementState,supplementSources,supplementaryContext,validateSupplement} from '../src/supplementary.js';
import {compileSetting} from '../src/effective-setting.js';
import {unsupportedQuestionReason} from '../src/question-premises.js';
import {questionInput} from '../server/question-input.js';
import {AppError} from '../server/core.js';
const b=migrateBackground({birthYear:'1990',forkAge:'34',gender:'女',locationText:'城甲',realityOutcome:'2024年4月我没有开始学画。',hypotheticalDirection:'我在2024年4月开始学画。',details:'每月两次，写三个月。'});
const raw=(extra={})=>({questions:[],covered:[],criticalUnknowns:[],conflict:null,scenarioCandidates:[],...extra});
const actor={key:'actor',missingInformation:'主角是谁',whyMissing:'确认身份',useInStory:'确定谁上课',sourceId:'details',evidence:b.details,blocksStory:'actor_or_choice'};
const gap={key:'practice',missingInformation:'练习安排',whyMissing:'决定课后行动',useInStory:'安排练习',sourceId:'details',evidence:b.details,questionText:'课后你想怎么安排练习？'};
const review=(extra={})=>raw({keepScenario:false,changeSubject:'self',evidence:b.hypotheticalDirection,...extra});
const conflict={question:'每月上几次以哪一处为准？',evidence:[{sourceId:'details',text:b.details},{sourceId:'hypotheticalDirection',text:b.hypotheticalDirection}]};
test('D12 regression: fixed protagonist never becomes a blocking or optional question',()=>{
 for(const g of [actor,{...actor,questionText:'这次学画的是谁？'},{...actor,blocksStory:undefined,questionText:'这次主角是谁？'}]){
  const p=normalizePlan(raw({criticalUnknowns:[g]}),b);assert.equal(p.conflict,null);assert.deepEqual(p.questions,[]);assert.deepEqual(p.criticalUnknowns,[]);
 }
});
test('D19 regression: recipient identity and imagined prior contact are rejected across gap, conflict and rewrite paths',()=>{
 for(const q of ['这封当晚写的信，你打算写给谁？你们平时是怎么相处的？','你和另一个自己平时是怎么交流的？这封信你希望用什么语气写？']){
  const p=normalizePlan(raw({criticalUnknowns:[{...gap,questionText:q}]}),b);assert.deepEqual(p.questions,[]);
  assert.equal(normalizePlan(raw({conflict:{...conflict,question:q}}),b).conflict,null);
  const x=normalizePlan(raw({criticalUnknowns:[{...gap,questionId:'K1'}],questions:[{id:'K1',questionText:q,reason:'候选',informationGain:3,missingInformation:'缺口',useInStory:'用处'}]}),b,{addCriticalQuestions:false});assert.deepEqual(x.questions,[]);
 }
});
test('ordinary real friendships, letter tone and imagined future actions remain eligible',()=>{
 for(const q of ['平常和朋友是怎么交流的？','这封信你希望用什么语气写？','这段关系里，你希望另一个自己守住哪条线？'])assert.equal(unsupportedQuestionReason(q),null);
 assert.equal(normalizePlan(raw({criticalUnknowns:[gap]}),b).questions.length,1);
});
test('all initial fields, previous answers and confirmations are available in both existing stages',async()=>{
 const state={...supplementState(b),shown:['G22'],answers:{G22:{selected:[],text:'先观察再请教。',skipped:false}},questionMeta:{G22:{questionText:'讲一件小事。'}},confirmations:['每月安排不变。'],confirmationContexts:[]};
 const saved=saveSupplement(b,state);let calls=0;
 await planWithGapCheck(saved,{call:async(t,m,o)=>{
  calls++;const input=JSON.parse(m[1].content);assert.equal(input.storyParticipants.protagonist,'real_user');assert.equal(input.storyParticipants.recipient,'real_user');
  for(const s of supplementSources(saved))assert.ok(input.sources.some(x=>x.id===s.id&&x.text===s.text));
  const result=o.questionStage==='review'?review():raw();o.validateResult(result);return {result};
 }});assert.equal(calls,2);
 assert.ok(JSON.parse(plannerMessages(saved)[1].content).sources.some(s=>s.id==='confirmation:0'));
});
test('a proposed confirmation must be reviewed against all sources before display',async()=>{
 let calls=0;const p=await planWithGapCheck(b,{call:async(t,m,o)=>{
  calls++;const result=o.questionStage==='review'?review():raw({conflict});
  if(o.questionStage==='review')assert.deepEqual(JSON.parse(m[1].content).previousDecision.proposedConfirmation,conflict);
  o.validateResult(result);return {result};
 }});assert.equal(calls,2);assert.equal(p.logicReviewed,true);assert.equal(p.conflict,null);
});
test('a reviewed genuine two-source contradiction can still require confirmation',async()=>{
 const input={...b,details:'这三个月每月两次课。同期每月三次课。'};
 const c={question:'同一时期每月上几次以哪处为准？',evidence:[{sourceId:'details',text:'每月两次课'},{sourceId:'details',text:'同期每月三次课'}]};
 let calls=0;const p=await planWithGapCheck(input,{call:async(t,m,o)=>{
  calls++;const result=o.questionStage==='review'?review({conflict:c}):raw({conflict:c});o.validateResult(result);return {result};
 }});assert.equal(calls,2);assert.deepEqual(p.conflict,c);
});
test('review can cover an optional gap from earlier input without resurrecting it',async()=>{
 let calls=0;const p=await planWithGapCheck(b,{call:async(t,m,o)=>{
  calls++;const result=o.questionStage==='review'?review({covered:[{id:'K1',sourceId:'details',evidence:b.details}]}):raw({criticalUnknowns:[gap]});
  if(o.questionStage==='review')assert.equal(JSON.parse(m[1].content).candidates[0].id,'K1');o.validateResult(result);return {result};
 }});assert.equal(calls,2);assert.deepEqual(p.questions,[]);assert.equal(p.covered[0].sourceId,'details');
});
test('v162 pending confirmation retires on read without deleting raw fields, answers, IDs or confirmations',()=>{
 const state={...supplementState(b),shown:['G22'],answers:{G22:{selected:[],text:'旧回答保留',skipped:false}},questionMeta:{G22:{questionText:'讲一件小事。'}},criticalUnknowns:[actor],confirmations:['旧确认保留'],plan:{questions:[],requestId:'old-id',conflict:{kind:'critical_background',question:'请说明这次故事以谁为主角，以及要改变谁的哪件事。',evidence:[{sourceId:'details',text:b.details}]}}};
 const saved=saveSupplement(b,state),before=saved.supplementary,s=supplementState(saved);validateSupplement(saved);
 assert.equal(s.plan.conflict,null);assert.equal(s.plan.requestId,'old-id');assert.equal(s.answers.G22.text,'旧回答保留');assert.deepEqual(s.confirmations,['旧确认保留']);assert.equal(saved.supplementary,before);
 assert.deepEqual(compileSetting(saved).clarifications,[]);assert.deepEqual(supplementaryContext(saved).settingRecord.criticalBackground,[]);
 assert.ok(questionInput(saved).sources.some(s=>s.text==='旧确认保留'));
});
test('two-round old confirmation count and unknown answers cannot revive the retired actor gate',()=>{
 const saved=saveSupplement(b,{...supplementState(b),criticalUnknowns:[actor],confirmations:['不确定','说不清'],plan:{questions:[],conflict:{kind:'critical_background',question:'请说明这次故事以谁为主角，以及要改变谁的哪件事。',evidence:[{sourceId:'details',text:b.details}]}}});
 assert.equal(normalizePlan(raw({criticalUnknowns:[actor]}),saved).conflict,null);assert.deepEqual(compileSetting(saved).clarifications,[]);
});
test('failed confirmation review uses bounded existing retries without publishing the unreviewed question',async()=>{
 let calls=0;const p=await planWithGapCheck(b,{call:async(t,m,o)=>{
  calls++;if(o.questionStage==='review')throw new AppError('invalid_response',502);
  const result=raw({conflict});o.validateResult(result);return {result};
 }},{sleep:async()=>{}});assert.equal(calls,4);assert.equal(p.optionalAnalysisUnavailable,true);assert.equal(p.conflict,null);assert.deepEqual(p.questions,[]);
});
test('fixed protagonist does not suppress deterministic conflicting-change checks',()=>{
 const input={...b,hypotheticalDirection:'改为我上课，我也上课。'};assert.ok(compileSetting(input).clarificationIssues.some(x=>x.code==='conflicting_change_operation'));
});
