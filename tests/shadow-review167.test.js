import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewRequest,validateReview} from '../tools/consistency-review-contract.mjs';
const sample={sample_id:'synthetic-1',fields:{intro:'这三个月的课还没上完。','scenes.2.text':'最后一次课结束，课程上完了。'},expected_observation:'conflict',gpt_scores:'must not be sent'};
const report=()=>({reviews:[{sample_id:'synthetic-1',verdict:'conflict',findings:[{kind:'summary_state',evidence:[{field:'intro',quote:'课还没上完'},{field:'scenes.2.text',quote:'课程上完了'}],reason:'同一段课程的完成状态相反。'}]}]});
test('review requests never contain expected labels or old GPT grades',()=>{
 const req=reviewRequest([sample]);assert.ok(!JSON.stringify(req).includes('expected_observation'));assert.ok(!JSON.stringify(req).includes('must not be sent'));assert.equal(req.tool_choice.function.name,'report_consistency');
});
test('two anchored quotes validate structure, never certify the model observation as truth',()=>{
 const r=validateReview(report(),[sample]);assert.equal(r.valid,true);assert.equal(r.reviews[0].truth_status,'model_observation_only');assert.equal(r.reviews[0].user_confirmation,'pending');
});
test('invented quotes and nonexistent fields are rejected before any reporting of usable findings',()=>{
 const a=report();a.reviews[0].findings[0].evidence[0].quote='我编造了原文';assert.equal(validateReview(a,[sample]).valid,false);
 const b=report();b.reviews[0].findings[0].evidence[0].field='unknown';assert.equal(validateReview(b,[sample]).valid,false);
});
test('a repeated quote cannot substitute for two pieces of evidence',()=>{
 const r=report();r.reviews[0].findings[0].evidence[1]={...r.reviews[0].findings[0].evidence[0]};assert.equal(validateReview(r,[sample]).valid,false);
});
test('missing duplicate and extra sample identifiers never silently pass',()=>{
 const a=report();a.reviews[0].sample_id='other';assert.equal(validateReview(a,[sample]).valid,false);const b=report();b.reviews.push({...b.reviews[0]});assert.equal(validateReview(b,[sample]).valid,false);
});
test('none and conflict verdicts must match findings; uncertain can abstain',()=>{
 const a=report();a.reviews[0].verdict='none';assert.equal(validateReview(a,[sample]).valid,false);
 const b=report();b.reviews[0].findings=[];assert.equal(validateReview(b,[sample]).valid,false);
 b.reviews[0].verdict='uncertain';assert.equal(validateReview(b,[sample]).valid,true);
});
test('scores rewrites unsupported categories and surplus fields are forbidden',()=>{
 const a=report();a.reviews[0].score=3;assert.equal(validateReview(a,[sample]).valid,false);const b=report();b.reviews[0].findings[0].kind='bad_prose';assert.equal(validateReview(b,[sample]).valid,false);
});
