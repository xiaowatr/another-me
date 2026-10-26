import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {normalizePlan,planWithGapCheck} from '../server/supplementary-planner.js';
import {mergeCriticalGaps,validCriticalGap} from '../src/critical-background.js';
import {supplementState,saveSupplement,recordSupplementConfirmation,validateSupplement} from '../src/supplementary.js';
import {compileSetting} from '../src/effective-setting.js';
import {generationInput} from '../server/generation-input.js';
import {createExperience} from '../server/experience.js';
import {makeStoryTrace,activeStoryTrace} from '../server/story-timing.js';
import {errorMessages} from '../server/core.js';
const b={birthYear:'1993',forkAge:'31',gender:'女',locationText:'桐城',realityOutcome:'2024年3月我留在原公司。',hypotheticalDirection:'2024年3月我接受云城的新工作并搬过去。',details:'写入职后第一个月，与朋友阿禾见一面，不指定岗位。'};
const pref={key:'ahe_address',kind:'address_preference',person:'阿禾',sourceId:'details',evidence:'与朋友阿禾见一面',missingInformation:'阿禾的称呼偏好',whyMissing:'原话未给代词',useInStory:'见面时使用合适称呼'};
const raw=g=>({questions:[],covered:[],criticalUnknowns:[g],stop:false});
function persist(base,plan,answer){const q=plan.questions[0],s=supplementState(base);return saveSupplement(base,{...s,plan,criticalUnknowns:plan.criticalUnknowns,...(q?{shown:[q.id],questionMeta:{[q.id]:q},answers:answer?{[q.id]:answer}:{}}:{})});}
test('preference is an anchored optional K question; arbitrary new people and hard-gate metadata are rejected',()=>{
 const p=normalizePlan(raw(pref),b);assert.equal(p.conflict,null);assert.equal(p.questions[0].id,'K1');assert.match(p.questions[0].questionText,/希望把阿禾称呼为“他”还是“她”/);
 assert.equal(validCriticalGap({...pref,blocksStory:'actor_or_choice'}),false);
 assert.equal(mergeCriticalGaps([],[{...pref,person:'陌生的名字'}],[{id:'details',text:b.details}]).length,0);
});
test('both selection and review preserve the canonical optional question without a new model stage',async()=>{
 let calls=0;const caller={call:async(task,m,o)=>{calls++;const result=o.questionStage==='review'?{...raw(pref),questions:[{id:'K1',reason:pref.whyMissing,informationGain:2,missingInformation:pref.missingInformation,useInStory:pref.useInStory}],keepScenario:false,changeSubject:'self',evidence:b.hypotheticalDirection}:raw(pref);o.validateResult(result);return {result,requestId:'mock-'+calls};}};
 const p=await planWithGapCheck(b,caller,{sleep:async()=>{}});assert.equal(calls,2);assert.equal(p.logicReviewed,true);assert.match(p.questions[0].questionText,/希望把阿禾称呼/);assert.equal(p.conflict,null);
});
test('answer provenance reaches generation as address preference; skip and unknown do not block or become gender facts',()=>{
 const p=normalizePlan(raw(pref),b);
 for(const text of ['她','他','请沿用阿禾']){
  const saved=persist(b,p,{selected:[],text,skipped:false});validateSupplement(saved);const c=compileSetting(saved),g=generationInput(c);
  assert.deepEqual(c.clarifications,[]);assert.equal(g.parallel.addressPreferences[0].person,'阿禾');assert.equal(g.parallel.addressPreferences[0].answerQuote,text);assert.equal(g.parallel.addressPreferences[0].answerRef,'K1');assert.equal(g.parallel.roleGender,'女');assert.equal(normalizePlan(raw(pref),saved).questions.length,0);
 }
 for(const a of [{selected:[],text:'',skipped:true},{selected:[],text:'不确定',skipped:false}]){
  const saved=persist(b,p,a),c=compileSetting(saved);assert.deepEqual(c.clarifications,[]);assert.deepEqual(generationInput(c).parallel.addressPreferences,[]);assert.equal(normalizePlan(raw(pref),saved).questions.length,0);
 }
});
test('preference respects the existing question limit and preserves unrelated answers',()=>{
 const base=saveSupplement(b,{...supplementState(b),skippedRemaining:true,answers:{G04:{selected:[],text:'先整理再询问',skipped:false}},shown:['G04']});
 const p=normalizePlan(raw(pref),base);assert.equal(p.questions.length,0);assert.equal(supplementState(base).answers.G04.text,'先整理再询问');
});
const actor={key:'actor_choice',sourceId:'hypotheticalDirection',evidence:b.hypotheticalDirection,missingInformation:'主角和选择',whyMissing:'合成回归缺口',useInStory:'明确主角',blocksStory:'actor_or_choice'};
const actorInput=()=>persist(b,normalizePlan(raw(actor),b));
test('genuine change-operation ambiguity still fails before model with safe trace and matching request ID',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'am160-')),lines=[];let calls=0;
 const res={statusCode:422,setHeader(){}};const trace=makeStoryTrace(res,'11111111-1111-4111-8111-111111111111',{directory:dir,detached:true,emit:x=>lines.push(JSON.parse(x))});
 try{
  const app=createExperience({mode:'real',model:'mock'},{call:()=>{calls++;throw Error('must not call');}});
  const actualAmbiguity={...b,realityOutcome:'那件事没发生。',hypotheticalDirection:'改为我参加，我也参加。'};
  await trace.run(async()=>{const first=await app.story({background:actualAmbiguity});assert.equal(first.requestId,trace.record.requestId);await assert.rejects(app.story({background:actualAmbiguity,clarificationSkipped:true}),e=>e.status===422&&e.diagnostic.reason==='unresolved_setting'&&e.diagnostic.issues[0].code==='conflicting_change_operation');});
  trace.complete();const last=lines.at(-1);assert.equal(calls,0);assert.equal(last.actualCallCount,0);assert.equal(last.httpStatus,422);assert.equal(last.inputValidation.issues[0].code,'conflicting_change_operation');assert.ok(last.events.some(e=>e.name==='input_clarification_required'));assert.ok(!JSON.stringify(last).includes(b.hypotheticalDirection));assert.doesNotMatch(errorMessages.input_conflict,/位置/);
 }finally{fs.unlinkSync(path.join(dir,'story-timings.jsonl'));fs.rmdirSync(dir);}
});
test('one linked actor confirmation reaches actual story entry and returns a story after one mocked model call',async()=>{
 let saved=actorInput();saved=saveSupplement(saved,recordSupplementConfirmation(supplementState(saved),'主角是我，这次我去云城工作。'));let calls=0;
 const story={kind:'story',title:'新日常',identity:'另一个自己',intro:'我开始熟悉新办公室。',character:'我先把问题整理好。',opening:'我收好笔记。',scenes:[{time:'2024年3月',title:'第一天',text:'我推开办公室的门。'},{time:'2024年3月',title:'问路',text:'我记下通勤出口。'},{time:'2024年3月',title:'月底',text:'我和新同事核对工作。'}]};
 const app=createExperience({mode:'real',model:'mock'},{call:async(task,m,o)=>{assert.equal(task,'story');calls++;o.validateResult?.(story);return {result:structuredClone(story),requestId:'mock-story'};}});
 const r=await app.story({background:saved,clarificationSkipped:true});assert.ok(r.sessionId);assert.equal(r.story.kind,'story');assert.equal(calls,1);assert.deepEqual(r.effectiveSetting.clarificationIssues,[]);
});
test('actual operation ambiguity remains blocked and has distinct non-geographic reason codes',()=>{
 const c=compileSetting({...b,realityOutcome:'那件事没发生。',hypotheticalDirection:'改为我参加，我也参加。'});assert.deepEqual(c.clarificationIssues.map(x=>x.code),['conflicting_change_operation','replacement_target_missing']);
});


test('a saved question cannot transfer its answer to a different person under the same gap key',()=>{
 const p=normalizePlan(raw(pref),b),base={...b,details:b.details+'我也认识阿青。'};
 const gaps=mergeCriticalGaps(p.criticalUnknowns,[{...pref,person:'阿青',evidence:'我也认识阿青。'}],[{id:'details',text:base.details}]);
 assert.equal(gaps[0].person,'阿禾');assert.match(gaps[0].questionText,/阿禾/);
});
