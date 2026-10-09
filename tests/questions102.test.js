import test from 'node:test';
import assert from 'node:assert/strict';
import {plannerMessages,planWithGapCheck} from '../server/supplementary-planner.js';
import {questionReviewMessages,validateQuestionReview} from '../server/question-review.js';
import {resolveQuestionWording} from '../server/question-wording.js';
import {QUESTION_BY_ID} from '../src/question-bank.js';
import {questionTitle} from '../src/question-context.js';
import {migrateBackground} from '../src/background.js';
import {saveSupplement,supplementState,supplementaryContext} from '../src/supplementary.js';
import {withoutOptionalAnalysis} from '../src/question-recovery.js';
import {AppError} from '../server/core.js';
const b=migrateBackground({birthYear:'1995',forkAge:'29',gender:'不透露',locationText:'南京',realityOutcome:'2024年没有学陶艺。',hypotheticalDirection:'如果2024年继续学陶艺，只看三个月。'});
const q=(id='G08',informationGain=2)=>({id,reason:'了解与这次选择相关的做法',informationGain,missingInformation:'具体做法',useInStory:'影响作出选择的方式'});
const initial=(questions=[])=>({questions,covered:[],conflict:null,scenarioCandidates:[],expectations:{}});
const reviewed=(questions=[])=>({...initial(questions),stop:questions.length===0,keepScenario:false,changeSubject:'self',evidence:b.hypotheticalDirection});
async function run(a,r,background=b){let count=0;const plan=await planWithGapCheck(background,{call:async(task,m,opts)=>{count++;const result=count===1?a:r;opts.validateResult(result);return {result,requestId:'mock-'+count};}},{sleep:async()=>{}});return {plan,count};}
test('ordinary bank and reviewed candidates use one wording key without changing saved bank',()=>{
 const before=JSON.stringify(QUESTION_BY_ID);
 for(const messages of [plannerMessages(b),questionReviewMessages(b,{questions:[q()],stop:false})]){const data=JSON.parse(messages[1].content);assert.ok(data.bank.every(x=>typeof x.questionText==='string'&&!Object.hasOwn(x,'question')));}
 const candidate=JSON.parse(questionReviewMessages(b,{questions:[q()],stop:false})[1].content).candidates[0];assert.ok(candidate.questionText);assert.equal(candidate.question,undefined);assert.equal(JSON.stringify(QUESTION_BY_ID),before);
});
test('legacy wording reaches persisted answer context; ambiguous or malformed dual fields use original',async()=>{
 const text='当时做决定，你希望保留自己的哪个习惯？',legacy={...q(),question:text};const saved=JSON.stringify(legacy);
 const {plan,count}=await run(initial([q()]),reviewed([legacy]));assert.equal(count,2);assert.equal(plan.questions[0].questionText,text);assert.equal(plan.planDiagnostics.stages.review.wording.alias,1);assert.equal(JSON.stringify(legacy),saved);
 let s=supplementState(b);s.shown=['G08'];s.pages=[['G08']];s.questionMeta={G08:plan.questions[0]};s.answers.G08={selected:[],text:'我喜欢写下来再决定',skipped:false};s.plan=plan;
 const restored=saveSupplement(b,s);assert.equal(supplementaryContext(restored).answers[0].question,text);assert.deepEqual(supplementState(restored).plan.planDiagnostics,plan.planDiagnostics);
 for(const meta of [{questionText:'问法甲',question:'问法乙'},{questionText:42,question:text},{questionText:text,question:'字'.repeat(181)}]){const w=resolveQuestionWording(QUESTION_BY_ID.G08,meta,b);assert.equal(w.wordingSource,'bank');assert.equal(w.questionText,questionTitle(QUESTION_BY_ID.G08,null,b));}
 assert.equal(resolveQuestionWording(QUESTION_BY_ID.G08,{questionText:text,question:' '+text+' '},b).wordingSource,'questionText');
});
test('empty model decision and filtered empty are distinct; low-value alias cannot bypass filtering',async()=>{
 const zero=await run(initial(),reviewed());assert.equal(zero.plan.planDiagnostics.outcome,'model_no_questions');assert.equal(zero.plan.optionalAnalysisUnavailable,undefined);
 const low=await run(initial([q()]),reviewed([{...q('G08',1),question:'润色不能让低价值题复活？'}]));assert.equal(low.plan.questions.length,0);assert.equal(low.plan.planDiagnostics.outcome,'filtered_empty');
 const covered=reviewed([{...q(),question:'一个已经答过的问题？'}]);covered.covered=[{id:'G08',sourceId:'hypotheticalDirection',evidence:b.hypotheticalDirection}];assert.equal((await run(initial(),covered)).plan.questions.length,0);
});
test('invalid review evidence keeps retries bounded, preserves failure stage through UI fallback and logs no user text',async()=>{
 const bad=reviewed([{...q(),question:'这次怎么选择？'}]);bad.evidence='不存在的引用';assert.throws(()=>validateQuestionReview(bad,b));
 const {plan,count}=await run(initial([q()]),bad);assert.equal(count,4);assert.equal(plan.optionalAnalysisUnavailable,true);assert.equal(plan.planDiagnostics.outcome,'analysis_unavailable');assert.equal(plan.planDiagnostics.stage,'review');assert.equal(plan.planDiagnostics.attempts.filter(x=>x.status==='failed').length,3);assert.equal(plan.questions.length,0);
 const state={...supplementState(b),plan};assert.deepEqual(withoutOptionalAnalysis(state).plan.planDiagnostics,plan.planDiagnostics);assert.ok(!JSON.stringify(plan.planDiagnostics).includes('不存在'));assert.ok(!JSON.stringify(plan.planDiagnostics).includes('陶艺'));
});
test('parse failure stays failure rather than valid no-questions and spends only existing three attempts',async()=>{
 let calls=0;const plan=await planWithGapCheck(b,{call:async()=>{calls++;throw new AppError('invalid_response',502,{stage:'parse',reason:'incomplete_structure'});}},{sleep:async()=>{}});
 assert.equal(calls,3);assert.equal(plan.planDiagnostics.outcome,'analysis_unavailable');assert.equal(plan.planDiagnostics.stage,'selection');assert.equal(plan.planDiagnostics.attempts[0].reason,'incomplete_structure');assert.deepEqual(plan.planDiagnostics.stages,{});
});
test('skipped group remains a hard stop with no review and raw answer preserved',async()=>{
 const s=supplementState(b);s.shown=['G08'];s.pages=[['G08']];s.answers.G08={selected:[],text:'不知道',skipped:true};const background=saveSupplement(b,s),{plan,count}=await run(initial([q('G16')]),reviewed([q('G16')]),background);
 assert.equal(count,1);assert.equal(plan.planDiagnostics.outcome,'group_skipped');assert.equal(supplementState(background).answers.G08.text,'不知道');
});
