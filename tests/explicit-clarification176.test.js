import test from 'node:test';import assert from 'node:assert/strict';
import {explicitClarificationPlan,explicitClarificationRequests} from '../src/explicit-clarification.js';
import {migrateBackground} from '../src/background.js';
import {supplementState,saveSupplement,supplementaryContext,validateSupplement,finishSupplementPage} from '../src/supplementary.js';
import {createExperience} from '../server/experience.js';
import {questionTitle} from '../src/question-context.js';
import {KEY_QUESTION_BY_ID} from '../src/critical-background.js';
const b=migrateBackground({birthYear:'1978',forkAge:'48',gender:'男',locationText:'岚城',realityOutcome:'2026年4月，本来想和小林一起去外地，后来我们都没走成。',hypotheticalDirection:'要是那次一个人留下，一个人真的出发了呢……想看看那种告别。',details:'我这段说得可能有点乱。小林和我什么关系、到底谁走谁留，你先问问我再写吧。'});
function persist(plan,base=b){const s=supplementState(base),ids=plan.questions.map(q=>q.id);return saveSupplement(base,{...s,plan,criticalUnknowns:plan.criticalUnknowns,shown:[...new Set([...s.shown,...ids])],pages:ids.length?[...s.pages,ids]:s.pages,questionMeta:{...s.questionMeta,...Object.fromEntries(plan.questions.map(q=>[q.id,q]))}});}
test('D16 literal request yields source-quoted text question covering both relationship and leave-stay',()=>{
 const plan=explicitClarificationPlan(b),q=plan.questions[0];assert.equal(q.id,'K1');assert.match(q.questionText,/小林和我什么关系、到底谁走谁留/);assert.equal(q.displayedQuestionText,q.questionText);assert.equal(plan.questionOrigin,'literal_user_request');assert.equal(plan.logicReviewed,undefined);assert.deepEqual(plan.planDiagnostics.attempts,[]);assert.ok(b.details.includes(plan.criticalUnknowns[0].evidence));assert.ok(!q.questionText.includes('你留下还是他留下'));validateSupplement(persist(plan));
});
test('real experience entry does not call model for an explicit source question',async()=>{
 let calls=0;const app=createExperience({mode:'real',model:'MOCK'},{call:async()=>{calls++;throw Error('must not call');}});const plan=await app.questions({background:b});assert.equal(calls,0);assert.equal(plan.questions.length,1);assert.match(plan.questions[0].questionText,/谁走谁留/);
});
test('prefix form is supported without generating a missing topic',()=>{
 for(const details of ['请先问清谁走谁留再写。','先问关系和谁走谁留再写。'])assert.equal(explicitClarificationRequests({...b,details}).length,1);
 assert.equal(explicitClarificationRequests({...b,details:'请先问我再写。'}).length,0);
});
test('D03 focus wording and ordinary unknowns do not become required questions',()=>{
 for(const details of ['就写第一次排练吧。','小林的关系、谁走谁留还没说明。','想看看告别的感觉。'])assert.equal(explicitClarificationPlan({...b,details}),null);
});
test('negative, quoted, hypothetical and past narration are not direct instructions',()=>{
 for(const details of ['不用先问谁走谁留再写。','不要先问谁走谁留再写。','谁走谁留，别先问我再写。','老师先问谁走谁留再写记录。','如果想写谁走谁留，你先问我再写。','“谁走谁留，你先问我再写吧”是当时他说的话。'])assert.equal(explicitClarificationPlan({...b,details}),null,details);
});
test('narrative reality or hypothetical text is not interpreted as a UI instruction',()=>{
 assert.equal(explicitClarificationPlan({...b,details:'',realityOutcome:b.details}),null);assert.equal(explicitClarificationPlan({...b,details:'',hypotheticalDirection:b.details}),null);
});
test('does not ask fixed protagonist and does not accept format pollution',()=>{
 for(const details of ['主角是谁，你先问我再写。','谁走谁留<script>，你先问我再写。','谁走谁留```，你先问我再写。'])assert.equal(explicitClarificationPlan({...b,details}),null);
});
test('literal display preserves user time words without question-template rewriting',()=>{
 const plan=explicitClarificationPlan({...b,details:'现在谁走谁留，你先问我再写。'}),q=plan.questions[0];assert.match(questionTitle(KEY_QUESTION_BY_ID[q.id],q,b),/现在谁走谁留/);
});
test('raw answer survives refresh with source quote and suppresses repeated direct question',()=>{
 const plan=explicitClarificationPlan(b),saved=persist(plan),s=supplementState(saved);s.answers.K1={selected:[],text:'小林是同事。我留下，小林出发。',skipped:false};const answered=JSON.parse(JSON.stringify(saveSupplement(saved,s)));validateSupplement(answered);assert.equal(explicitClarificationPlan(answered),null);const c=supplementaryContext(answered);assert.equal(c.answers[0].question,plan.questions[0].questionText);assert.equal(c.answers[0].text,s.answers.K1.text);assert.equal(c.settingRecord.criticalBackground[0].status,'answered');
});
test('empty answer stays unanswered and refresh resumes the same literal slot',()=>{
 const saved=persist(explicitClarificationPlan(b));const resumed=explicitClarificationPlan(JSON.parse(JSON.stringify(saved)));assert.equal(resumed.questions[0].id,'K1');assert.equal(supplementaryContext(saved).settingRecord.criticalBackground[0].status,'unanswered');
});
test('explicit unknown or skip is not treated as an answer or asked again',()=>{
 const saved=persist(explicitClarificationPlan(b));for(const a of [{selected:[],text:'不确定',skipped:false},{selected:[],text:'',skipped:true}]){const s=supplementState(saved);s.answers.K1=a;const x=saveSupplement(saved,s),p=explicitClarificationPlan(x);assert.equal(p.questions.length,0);assert.equal(supplementaryContext(x).settingRecord.criticalBackground[0].status,'skipped');}
});
test('global explicit skip preserves requested unknown instead of silently restarting planning',()=>{
 const x=saveSupplement(b,{...supplementState(b),skippedRemaining:true});const p=explicitClarificationPlan(x);assert.equal(p.questions.length,0);assert.equal(p.planDiagnostics.outcome,'user_requests_skipped');
});
test('old generic K1 answer is preserved and never relabelled as the requested answer',()=>{
 const s={...supplementState(b),shown:['K1'],pages:[['K1']],questionMeta:{K1:{questionText:'你们平时怎么相处？',displayedQuestionText:'你们平时怎么相处？'}},answers:{K1:{selected:[],text:'偶尔聊天',skipped:false}},plan:{questions:[{id:'K1',questionText:'你们平时怎么相处？'}],stop:true}},old=saveSupplement(b,s);const p=explicitClarificationPlan(old);assert.equal(p.questions[0].id,'K2');const updated=persist(p,old);validateSupplement(updated);assert.equal(supplementState(updated).answers.K1.text,'偶尔聊天');assert.equal(supplementaryContext(updated).settingRecord.criticalBackground[0].status,'unanswered');
});
test('cap of eight is retained while an already shown unanswered literal question can resume',()=>{
 const s=supplementState(persist(explicitClarificationPlan(b)));s.shown=Array.from({length:8},(_,i)=>'K'+(i+1));s.questionMeta={...s.questionMeta,...Object.fromEntries(s.shown.slice(1).map(id=>[id,{questionText:'旧问题',displayedQuestionText:'旧问题'}]))};s.pages=[['K1'],['K2','K3','K4'],['K5','K6','K7'],['K8']];const full=saveSupplement(b,s);assert.equal(explicitClarificationPlan(full).questions[0].id,'K1');
 const noLink={...s,criticalUnknowns:[],plan:null};assert.equal(explicitClarificationPlan(saveSupplement(b,noLink)).questions.length,0);
});
test('changed core input does not apply the old answer under a new request scope',()=>{
 const saved=persist(explicitClarificationPlan(b)),s=supplementState(saved);s.answers.K1={selected:[],text:'小林走',skipped:false};const answered=saveSupplement(saved,s);assert.equal(explicitClarificationPlan({...answered,hypotheticalDirection:'改成两人一起出发。'}).questions[0].id,'K1');
});
test('ordinary planner remains active when no literal request exists',async()=>{
 let calls=0;const app=createExperience({mode:'real',model:'MOCK'},{call:async(t,m,o)=>{const result=++calls===1?{questions:[],covered:[],expectations:{}}:{questions:[],covered:[],keepScenario:false,changeSubject:'self',evidence:b.hypotheticalDirection};o.validateResult(result);return {result};}});await app.questions({background:{...b,details:'只写一个普通傍晚。'}});assert.equal(calls,2);
});

test('old eight critical records do not overflow or have their answers reinterpreted',()=>{
 const gaps=Array.from({length:8},(_,i)=>({key:'old_'+i,sourceId:'details',evidence:'小林',missingInformation:'旧缺口',whyMissing:'旧记录',useInStory:'保持未知'}));const x=saveSupplement(b,{...supplementState(b),criticalUnknowns:gaps});const p=explicitClarificationPlan(x);assert.equal(p.questions.length,0);assert.equal(p.criticalUnknowns.length,8);validateSupplement(persist(p,x));
});

test('duplicate explicit topic across constraint fields is asked once with original provenance',()=>{
 const p=explicitClarificationPlan({...b,additionalInfo:b.details});assert.equal(p.questions.length,1);assert.equal(p.criticalUnknowns[0].sourceId,'details');
});
test('more than three explicit requests continue in bounded groups rather than silently dropping the rest',()=>{
 const base={...b,details:['甲','乙','丙','丁'].map(n=>n+'和我什么关系，你先问我再写。').join('')};const first=explicitClarificationPlan(base);assert.equal(first.questions.length,3);assert.equal(first.stop,false);let saved=persist(first,base),s=supplementState(saved);for(const q of first.questions)s.answers[q.id]={selected:[],text:'普通朋友',skipped:false};saved=saveSupplement(saved,s);const second=explicitClarificationPlan(saved);assert.equal(second.questions.length,1);assert.equal(second.stop,true);assert.match(second.questions[0].questionText,/丁和我什么关系/);validateSupplement(persist(second,saved));
});
