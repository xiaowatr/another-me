import test from 'node:test';import assert from 'node:assert/strict';
import {normalizePlan,planWithGapCheck} from '../server/supplementary-planner.js';
import {validateQuestionReview} from '../server/question-review.js';
import {resolveQuestionWording} from '../server/question-wording.js';
import {QUESTION_BY_ID} from '../src/question-bank.js';
import {migrateBackground} from '../src/background.js';
import {supplementState,saveSupplement,supplementaryContext,validateSupplement} from '../src/supplementary.js';
const b=migrateBackground({birthYear:'1978',forkAge:'48',gender:'男',locationText:'岚城',realityOutcome:'2026年4月，本来想和小林一起去外地，后来我们都没走成。',hypotheticalDirection:'要是那次一个人留下，一个人真的出发了呢……想看看那种告别。',details:'小林和我什么关系、到底谁走谁留，你先问问我再写吧。'});
const wording='小林和你是什么关系？那次出发，最后是你留下还是他留下？';
const gap={key:'lin_relation',questionId:'R02',questionText:wording,sourceId:'details',evidence:b.details,missingInformation:'关系和谁走谁留',whyMissing:'明确要求先问',useInStory:'决定关系和谁走谁留'};
const question=(text=wording)=>({id:'R02',questionText:text,reason:'明确原文未确定的行动归属',informationGain:3,missingInformation:gap.missingInformation,useInStory:gap.useInStory});
const raw=(gaps=[gap],questions=[question()])=>({questions,covered:[],criticalUnknowns:gaps,scenarioCandidates:[],expectations:{},stop:false});
const review=(gaps=[gap],questions=[question()])=>({...raw(gaps,questions),keepScenario:false,changeSubject:'self',evidence:b.hypotheticalDirection});
function persist(plan,base=b){const s=supplementState(base),ids=plan.questions.map(q=>q.id);return saveSupplement(base,{...s,plan,criticalUnknowns:plan.criticalUnknowns,shown:ids,pages:ids.length?[ids]:[],questionMeta:Object.fromEntries(plan.questions.map(q=>[q.id,q]))});}
test('grounded custom choice gap becomes one text question without changing raw response or bank',()=>{
 const r=raw(),before=JSON.stringify(r),bank=JSON.stringify(QUESTION_BY_ID.R02);const p=normalizePlan(r,b);
 assert.deepEqual(p.questions.map(q=>q.id),['K1']);assert.equal(p.questions[0].questionText,wording);assert.equal(p.criticalUnknowns[0].questionId,'K1');assert.equal(JSON.stringify(r),before);assert.equal(JSON.stringify(QUESTION_BY_ID.R02),bank);
});
test('selection without candidate wording still routes grounded gap, but review must explicitly retain exact wording',()=>{
 assert.equal(normalizePlan(raw([gap],[{...question(),questionText:undefined}]),b).questions[0].id,'K1');
 assert.equal(validateQuestionReview(review([gap],[{...question(),questionText:undefined}]),b).questions[0].id,'R02');
 assert.equal(validateQuestionReview(review(),b).questions[0].id,'K1');
});
test('two-stage planner keeps reviewed specific question even when model repeats original choice ID',async()=>{
 let n=0;const p=await planWithGapCheck(b,{call:async(t,m,o)=>{
  n++;if(n===2){const sent=JSON.parse(m[1].content);assert.equal(sent.candidates[0].id,'K1');assert.equal(sent.candidates[0].questionText,wording);assert.deepEqual(sent.candidates[0].options,[]);}
  const result=n===1?raw():review();o.validateResult(result);return {result};
 }},{sleep:async()=>{}});assert.equal(n,2);assert.equal(p.questions[0].id,'K1');assert.equal(p.questions[0].questionText,wording);
});
test('review can remove specific question; routing cannot resurrect it',async()=>{
 let n=0;const p=await planWithGapCheck(b,{call:async(t,m,o)=>{const result=++n===1?raw():review([gap],[]);o.validateResult(result);return {result};}},{sleep:async()=>{}});
 assert.equal(p.questions.length,0);assert.equal(supplementaryContext(persist(p)).settingRecord.criticalBackground[0].status,'unasked');
});
test('review rewriting to ordinary bank wording is not silently promoted back to custom wording',()=>{
 const prior=normalizePlan(raw(),b);const r=validateQuestionReview(review([gap],[question(QUESTION_BY_ID.R02.question)]),b,prior.criticalUnknowns);
 assert.equal(r.questions[0].id,'R02');assert.equal(r.questions[0].questionText,QUESTION_BY_ID.R02.question);
});
test('ungrounded gap and arbitrary choice rewrite do not unlock text slots',()=>{
 for(const r of [raw([{...gap,evidence:'从未提交的关系'}]),raw([])]){
  const p=normalizePlan(r,b);assert.ok(p.questions.every(q=>!q.id.startsWith('K')));assert.equal(p.questions[0].questionText,QUESTION_BY_ID.R02.question);
 }
 assert.equal(resolveQuestionWording(QUESTION_BY_ID.R02,question(),b).wordingFallback,'choice_options');
});
test('retired protagonist and polluted wording cannot use routing to pass display gates',()=>{
 for(const text of ['这次故事的主角是谁？','```小林是谁```','<b>谁留下</b>']){
  const p=normalizePlan(raw([{...gap,questionText:text}],[question(text)]),b);assert.ok(p.questions.every(q=>!q.id.startsWith('K')));
 }
});
test('historical choice answer is not reinterpreted as an answer to the new text question',()=>{
 const s={...supplementState(b),shown:['R02'],pages:[['R02']],answers:{R02:{selected:[],text:'原来回答',skipped:false}}},saved=saveSupplement(b,s),before=JSON.stringify(supplementState(saved).answers);
 const p=normalizePlan(raw(),saved);assert.ok(p.questions.every(q=>!q.id.startsWith('K')));assert.equal(JSON.stringify(supplementState(saved).answers),before);
});
test('temporary slots do not collide and review preserves the selection slot by gap key',async()=>{
 const other={...gap,key:'other_gap',questionId:'K1',questionText:'当时有什么需要保留的安排？'};let n=0;
 const p=await planWithGapCheck(b,{call:async(t,m,o)=>{const result=++n===1?raw([gap,other]):review([gap,other]);o.validateResult(result);return {result};}},{sleep:async()=>{}});
 assert.equal(n,2);assert.equal(p.questions[0].id,'K2');assert.equal(p.criticalUnknowns.find(g=>g.key===gap.key).questionId,'K2');assert.equal(p.questions[0].questionText,wording);
});
test('all used slots and the eight-question cap cannot be bypassed',()=>{
 const s={...supplementState(b),shown:Array.from({length:8},(_,i)=>'K'+(i+1)),pages:[],criticalUnknowns:[],questionMeta:Object.fromEntries(Array.from({length:8},(_,i)=>['K'+(i+1),{questionText:'之前问过的问题'}]))};
 assert.equal(normalizePlan(raw(),saveSupplement(b,s)).questions.length,0);
});
test('one choice ID shared by ambiguous gaps is not assigned a fabricated common text answer',()=>{
 const p=normalizePlan(raw([gap,{...gap,key:'second_gap',questionText:'需要保留什么安排？'}]),b);assert.ok(p.questions.every(q=>!q.id.startsWith('K')));
});
test('covered choice and unchanged bank wording are not re-asked through a new ID',()=>{
 const r=raw();r.covered=[{id:'R02',sourceId:'details',evidence:b.details}];assert.ok(normalizePlan(r,b).questions.every(q=>!q.id.startsWith('K')));
 const p=normalizePlan(raw([{...gap,questionText:QUESTION_BY_ID.R02.question}],[question(QUESTION_BY_ID.R02.question)]),b);assert.equal(p.questions[0].id,'R02');
});
test('invalid excluded options and conflicting wording aliases retain original validation',()=>{
 assert.throws(()=>validateQuestionReview(review([gap],[{...question(),excludedOptions:[{option:'不存在',sourceId:'details',evidence:b.details}]}]),b));assert.throws(()=>validateQuestionReview(review([gap],[{...question(),excludedOptions:{bad:true}}]),b));
 assert.equal(validateQuestionReview(review([gap],[{...question(),question:'另一个冲突题面？'}]),b).questions[0].id,'R02');
});
test('text answer survives refresh with exact question, remains unknown before actual answer',()=>{
 const p=normalizePlan(raw(),b),saved=persist(p),s=supplementState(saved);
 assert.equal(supplementaryContext(saved).settingRecord.criticalBackground[0].status,'unanswered');
 s.answers.K1={selected:[],text:'小林是同事。我留下，小林出发。',skipped:false};const answered=JSON.parse(JSON.stringify(saveSupplement(saved,s)));validateSupplement(answered);
 const c=supplementaryContext(answered);assert.equal(c.answers[0].question,wording);assert.equal(c.answers[0].text,s.answers.K1.text);assert.equal(c.settingRecord.criticalBackground[0].status,'answered');assert.equal(c.settingRecord.criticalBackground[0].answer.questionId,'K1');
});
