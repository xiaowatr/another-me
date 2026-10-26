import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlan,planWithGapCheck} from '../server/supplementary-planner.js';
import * as supplement from '../src/supplementary.js';
import {compileSetting} from '../src/effective-setting.js';
import {withoutOptionalAnalysis} from '../src/question-recovery.js';

const question='请说明这次故事以谁为主角，以及要改变谁的哪件事。';
const answer='主角是我，这次写我接受新工作并搬去另一座城市后的生活。';
const background={realityOutcome:'2024年我留在桐城原公司。',hypotheticalDirection:'我接受云城的新工作并搬过去。',details:'写入职后的第一个月，不指定具体岗位。',birthYear:'1993',forkAge:'31',gender:'女',locationText:'桐城'};
const gap={key:'actor_choice',missingInformation:'主角与改变对象',whyMissing:'合成缺口用于回归确认关联',useInStory:'确认故事主体',sourceId:'hypotheticalDirection',evidence:background.hypotheticalDirection,blocksStory:'actor_or_choice'};
const raw=g=>({questions:[],covered:[],criticalUnknowns:[g],stop:true});
function persist(b,plan){return supplement.saveSupplement(b,{...supplement.supplementState(b),criticalUnknowns:plan.criticalUnknowns,plan});}
function legacy(overrides={}){
 const gaps=overrides.criticalUnknowns||[gap];
 return supplement.saveSupplement(background,{...supplement.supplementState(background),criticalUnknowns:gaps,plan:{questions:[],covered:[],criticalUnknowns:gaps,requestId:'11111111-1111-4111-8111-111111111111',conflict:{kind:'critical_background',question,evidence:[{sourceId:gap.sourceId,text:gap.evidence}]}},confirmations:[answer,answer],confirmationContexts:[{sourceIndex:0,question,gapKeys:[]},{sourceIndex:1,question,gapKeys:[]}],...overrides});
}

test('v163 retires the actor question even before a confirmation, while preserving any supplied answer',()=>{
 let b=persist(background,normalizePlan(raw(gap),background));
 assert.equal(supplement.supplementState(b).plan.conflict,null);
 b=supplement.saveSupplement(b,supplement.recordSupplementConfirmation(supplement.supplementState(b),answer));
 assert.equal(normalizePlan(raw(gap),b).conflict,null);
 assert.deepEqual(compileSetting(b).clarifications,[]);
 assert.deepEqual(supplement.supplementaryContext(b).settingRecord.criticalBackground,[]);
 assert.ok(supplement.supplementSources(b).some(x=>x.id==='confirmation:0'&&x.text===answer));
});

test('saved legacy confirmations remain evidence while the obsolete blocking question retires',()=>{
 const b=legacy({answers:{G04:{selected:[],text:'保留这条旧回答',skipped:false}},shown:['G04']});
 const restored=supplement.supplementState(JSON.parse(JSON.stringify(b)));
 assert.equal(restored.confirmations.length,2);
 assert.deepEqual(restored.confirmationContexts.map(x=>x.gapKeys),[['actor_choice'],['actor_choice']]);
 assert.equal(restored.answers.G04.text,'保留这条旧回答');
 assert.equal(supplement.canRecheckConfirmedConflict(restored),false);assert.equal(restored.plan.conflict,null);
 assert.equal(normalizePlan(raw(gap),supplement.saveSupplement(b,restored)).conflict,null);
 assert.equal(b.hypotheticalDirection,background.hypotheticalDirection);
});

test('legacy recovery requires the critical-background kind, not a genuine two-source conflict',()=>{
 const b=legacy(),s=JSON.parse(b.supplementary).contexts[0].state;
 delete s.plan.conflict.kind;
 const restored=supplement.supplementState(supplement.saveSupplement(background,s));
 assert.deepEqual(restored.confirmationContexts[0].gapKeys,[]);
 assert.equal(supplement.canRecheckConfirmedConflict(restored),false);
});

test('legacy recovery refuses ambiguous multiple gaps and mismatching evidence',()=>{
 for(const overrides of [
  {criticalUnknowns:[gap,{...gap,key:'another_actor'}]},
  {plan:{questions:[],conflict:{kind:'critical_background',question,evidence:[{sourceId:gap.sourceId,text:'不匹配的证据'}]}}}
 ]){
  const restored=supplement.supplementState(legacy(overrides));
  assert.deepEqual(restored.confirmationContexts[0].gapKeys,[]);
  assert.equal(supplement.canRecheckConfirmedConflict(restored),false);
 }
});

test('unknown legacy confirmations remain unknown but no longer block the fixed protagonist',()=>{
 const b=legacy({confirmations:['不确定','说不清']});
 const restored=supplement.supplementState(b);
 assert.equal(supplement.canRecheckConfirmedConflict(restored),false);
 assert.equal(normalizePlan(raw(gap),b).conflict,null);
 assert.deepEqual(restored.confirmations,['不确定','说不清']);
 const unlinked=persist(background,normalizePlan(raw({...gap,resolvedBy:{sourceId:'hypotheticalDirection',evidence:gap.evidence}}),background));
 assert.deepEqual(supplement.supplementaryContext(unlinked).settingRecord.criticalBackground,[]);
});

test('an unrelated question or previously linked different gap cannot be adopted as this confirmation',()=>{
 for(const context of [{sourceIndex:0,question:'另一个问题',gapKeys:[]},{sourceIndex:0,question,gapKeys:['different_gap']}]){
  const restored=supplement.supplementState(legacy({confirmations:[answer],confirmationContexts:[context]}));
  assert.deepEqual(restored.confirmationContexts[0].gapKeys,context.gapKeys);
  assert.equal(supplement.canRecheckConfirmedConflict(restored),false);
 }
});

test('changing source input invalidates saved confirmation scope',()=>{
 const b={...legacy(),hypotheticalDirection:'这次改成留在原来的城市。'};
 const state=supplement.supplementState(b);
 assert.deepEqual(state.confirmations,[]);assert.equal(supplement.canRecheckConfirmedConflict(state),false);
});

test('explicit model conflict remains blocking even after the actor gap is answered',()=>{
 let b=persist(background,normalizePlan(raw(gap),background));
 b=supplement.saveSupplement(b,supplement.recordSupplementConfirmation(supplement.supplementState(b),answer));
 const conflict={question:'这两处相反的安排以哪一处为准？',evidence:[{sourceId:'realityOutcome',text:background.realityOutcome},{sourceId:'hypotheticalDirection',text:background.hypotheticalDirection}]};
 assert.deepEqual(normalizePlan({...raw(gap),conflict},b).conflict,conflict);
});

test('changing wording under a retired actor key cannot revive a protagonist confirmation',()=>{
 const b=legacy();
 const next=normalizePlan(raw({...gap,questionText:'这次要改变的是谁的选择？'}),b);
 assert.equal(next.conflict,null);assert.deepEqual(next.questions,[]);
 assert.deepEqual(supplement.supplementState(b).confirmations,[answer,answer]);
});

test('question-analysis fallback preserves the request ID together with the blocking state',()=>{
 const state=supplement.supplementState(legacy());
 const fallback=withoutOptionalAnalysis(state);
 assert.equal(fallback.plan.requestId,state.plan.requestId);
 assert.deepEqual(fallback.plan.conflict,state.plan.conflict);
 assert.equal(fallback.confirmations.length,2);
});

test('an omitted questionText on the next response does not discard the previous explicit wording',()=>{
 let b=persist(background,normalizePlan(raw({...gap,questionText:'这次主角是谁？'}),background));
 b=supplement.saveSupplement(b,supplement.recordSupplementConfirmation(supplement.supplementState(b),answer));
 assert.equal(normalizePlan(raw(gap),b).conflict,null);
});

test('both input layouts use two existing stages without asking who the protagonist is',async()=>{
 for(const direction of [background.hypotheticalDirection,background.realityOutcome+'另一条路是：'+background.hypotheticalDirection+'写入职后第一个月。']){
  const b={...background,hypotheticalDirection:direction},g={...gap,evidence:direction};let calls=0;
  const caller={call:async(task,messages,options)=>{
   calls++;const result=options.questionStage==='review'?{...raw(g),keepScenario:false,changeSubject:'self',evidence:direction}:raw(g);
   options.validateResult(result);return {result,requestId:'synthetic-request-'+calls};
  }};
  const first=await planWithGapCheck(b,caller);assert.equal(first.conflict,null);assert.equal(calls,2);assert.equal(first.logicReviewed,true);
  assert.deepEqual(first.questions,[]);assert.deepEqual(compileSetting(persist(b,first)).clarifications,[]);
 }
});
