import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateBackground} from '../src/background.js';
import {saveSupplement,supplementState,supplementaryContext,validateSupplement,finishSupplementPage} from '../src/supplementary.js';
import {normalizePlan,planWithGapCheck} from '../server/supplementary-planner.js';
import {withoutOptionalAnalysis} from '../src/question-recovery.js';
import {compileSetting} from '../src/effective-setting.js';
import {storyMessages} from '../server/prompts.js';
import {AppError} from '../server/core.js';
export const background=migrateBackground({birthYear:'1995',forkAge:'29',gender:'不透露',locationText:'南京',realityOutcome:'2024年没有继续学陶艺。',hypotheticalDirection:'如果2024年继续学陶艺，只看三个月。',details:'每月两次，遇到困难先自己试。'});
export const gap={key:'course_start',missingInformation:'重新捡起还是接着当时的课程',whyMissing:'继续学没有说明课程是否中断',useInStory:'决定起点是重新熟悉课程还是接着原课程练习',sourceId:'hypotheticalDirection',evidence:'继续学陶艺',questionText:'这次继续学陶艺，是重新捡起，还是接着当时的课程？'};
const initial=gaps=>({questions:[],covered:[],conflict:null,scenarioCandidates:[],expectations:{},criticalUnknowns:gaps});
const review=(b,questions=[],gaps)=>({questions,covered:[],stop:!questions.length,keepScenario:false,changeSubject:'self',evidence:b.hypotheticalDirection,...(gaps?{criticalUnknowns:gaps}:{})});
export function persistPlan(b,plan){const s=supplementState(b),ids=plan.questions.map(q=>q.id);return saveSupplement(b,{...s,criticalUnknowns:plan.criticalUnknowns,plan,shown:ids,pages:ids.length?[ids]:[],questionMeta:Object.fromEntries(plan.questions.map(q=>[q.id,q]))});}
const request=b=>{const g=JSON.parse(storyMessages(b)[1].content).effectiveSetting;return {factsAndConstraints:g.sources,parallelAssumption:{text:g.sources.find(s=>s.id==='hypotheticalDirection').text},criticalBackground:g.unknownBackground.critical.map(x=>({...x,answer:x.answerRef?{text:x.answerQuote}:null}))};};
export function chainCases(){
 const known={...background,details:background.details+'我说的继续是重新捡起，之前已经停过。'};
 const knownPlan=normalizePlan(initial([{...gap,resolvedBy:{sourceId:'details',evidence:'继续是重新捡起'}}]),known);
 const knownSaved=persistPlan(known,knownPlan),plan=normalizePlan(initial([gap]),background),saved=persistPlan(background,plan),id=plan.questions[0].id;
 const s=supplementState(saved);s.answers[id]={selected:[],text:'接着当时的课程学，没有停过。',skipped:false};
 const answered=saveSupplement(saved,s),skip=finishSupplementPage(supplementState(saved),[id]);
 const skipped=saveSupplement(saved,skip);
 return [{id:'known',background:knownSaved},{id:'answered',background:answered},{id:'skipped',background:skipped}];
}
test('chain 1: existing evidence prevents another question; facts and exact frequency reach story request',()=>{
 const b=chainCases()[0].background,s=supplementState(b),record=request(b);
 assert.equal(s.plan.questions.length,0);assert.equal(record.criticalBackground[0].status,'answered');
 assert.equal(record.criticalBackground[0].answer.text,'继续是重新捡起');
 assert.ok(record.factsAndConstraints.some(x=>x.text.includes('每月两次，遇到困难先自己试')));
 assert.equal(record.parallelAssumption.text,background.hypotheticalDirection);assert.equal(compileSetting(b).clarifications.length,0);
});
test('chain 2: temporary question and its raw answer survive save/refresh into the actual story request',()=>{
 const b=chainCases()[1].background;validateSupplement(b);const record=request(JSON.parse(JSON.stringify(b))),g=record.criticalBackground[0];
 assert.equal(g.questionId,'K1');assert.equal(g.status,'answered');assert.equal(g.answer.text,'接着当时的课程学，没有停过。');
 assert.equal(supplementaryContext(b).answers[0].question,gap.questionText);assert.equal(g.useInStory,gap.useInStory);
});
test('chain 3: skip and review failure preserve unknowns and nondependent generation instructions',async()=>{
 const b=chainCases()[2].background;validateSupplement(b);assert.equal(request(b).criticalBackground[0].status,'skipped');
 let n=0;const plan=await planWithGapCheck(background,{call:async(task,m,o)=>{n++;if(n===1){const result=initial([gap]);o.validateResult(result);return {result};}throw new AppError('invalid_response',502);}},{sleep:async()=>{}});
 assert.equal(n,4);assert.equal(plan.questions.length,0);assert.equal(plan.optionalAnalysisUnavailable,true);assert.equal(plan.criticalUnknowns[0].key,gap.key);
 const failed=persistPlan(background,plan),restored=saveSupplement(failed,withoutOptionalAnalysis(supplementState(failed)));
 assert.equal(request(restored).criticalBackground[0].status,'analysis_unavailable');assert.equal(compileSetting(restored).clarifications.length,0);
 assert.match(storyMessages(restored)[0].content,/采用不依赖它们的行动与场景/);
 const skippedWhileLoading=saveSupplement(failed,{...supplementState(failed),plan:{...plan,optionalAnalysisUnavailable:false},skippedRemaining:true});assert.equal(request(skippedWhileLoading).criticalBackground[0].status,'skipped');
 let parsedCalls=0;const partiallyBad=await planWithGapCheck(background,{call:async(t,m,o)=>{parsedCalls++;o.validateResult({...initial([gap]),questions:[{id:'INVALID'}]});throw Error('unreachable');}},{sleep:async()=>{}});assert.equal(parsedCalls,3);assert.equal(partiallyBad.criticalUnknowns[0].key,gap.key);assert.equal(partiallyBad.optionalAnalysisUnavailable,true);
});
test('review removal cannot resurrect a temporary question; its unknown still reaches generation',async()=>{
 let n=0;const plan=await planWithGapCheck(background,{call:async(t,m,o)=>{const result=++n===1?initial([gap]):review(background);o.validateResult(result);return {result};}},{sleep:async()=>{}});
 assert.equal(n,2);assert.equal(plan.questions.length,0);assert.equal(request(persistPlan(background,plan)).criticalBackground[0].status,'unasked');
});
test('review can keep one grounded temporary question; ungrounded gap and orphan slot never display',async()=>{
 const candidate=normalizePlan(initial([gap]),background).questions[0];let n=0;
 const plan=await planWithGapCheck(background,{call:async(t,m,o)=>{const result=++n===1?initial([gap]):review(background,[candidate]);o.validateResult(result);return {result};}},{sleep:async()=>{}});
 assert.equal(plan.questions[0].id,'K1');validateSupplement(persistPlan(background,plan));
 assert.equal(normalizePlan(initial([{...gap,evidence:'未提供的妻子'}]),background).questions.length,0);
 assert.equal(normalizePlan({...initial([]),questions:[candidate]},background).questions.length,0);
 const second={...gap,key:'other_start',questionId:'K2'};const q2={...candidate,id:'K2'};
 assert.equal(normalizePlan({...initial([{...gap,questionId:'K1'},second]),questions:[candidate,q2]},background,{addCriticalQuestions:false}).questions.length,1);
});
test('unclear actor asks only one clarification; an explicit confirmation resolves it; changed sources invalidate stale evidence',()=>{
 const actor={...gap,key:'actor',blocksStory:'actor_or_choice',missingInformation:'谁做出本次选择',questionText:'这次继续学陶艺的是谁？'};
 const b=persistPlan(background,normalizePlan(initial([actor]),background));assert.equal(supplementState(b).plan.questions.length,0);assert.deepEqual(compileSetting(b).clarifications,[actor.questionText]);
 let s=supplementState(b);s.confirmations=['是我自己。'];s.criticalUnknowns=[{...actor,resolvedBy:{sourceId:'confirmation:0',evidence:'是我自己。'}}];const confirmed=saveSupplement(b,s);assert.equal(compileSetting(confirmed).clarifications.length,0);
 s.confirmations=[];assert.equal(request(saveSupplement(b,s)).criticalBackground[0].status,'unasked');
 const changed={...b,hypotheticalDirection:'如果换一个爱好。'};assert.equal(request(changed).criticalBackground.length,0);
});
