import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const root=new URL('../',import.meta.url);
const {createCaller}=await import(new URL('server/minimax.js',root));const {captureUsage}=await import(new URL('server/usage.js',root));
const {planWithGapCheck}=await import(new URL('server/supplementary-planner.js',root));
test('logged question failure shape proves requested disabled is separate from reported reasoning',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'am181-'));let body,calls=0;
 try{const caller=createCaller({mode:'real',site:'cn',base:'https://offline.invalid',key:'offline-placeholder',model:'MiniMax-M3'},{directory,env:{REQUEST_DIAGNOSTICS:'0'},fetchImpl:async(_url,options)=>{calls++;body=JSON.parse(options.body);return new Response(JSON.stringify({model:'MiniMax-M3',choices:[{finish_reason:'length',message:{content:'',reasoning_content:'PRIVATE_REASONING_SHOULD_NOT_LEAK'}}],usage:{prompt_tokens:12047,completion_tokens:3500,total_tokens:15547,completion_tokens_details:{reasoning_tokens:3500},prompt_tokens_details:{cached_tokens:128}}}),{status:200,headers:{'Content-Type':'application/json'}});}});
 await assert.rejects(caller.call('questions',[{role:'system',content:'offline fixture'},{role:'user',content:'offline fixture'}],{questionStage:'selection'}),e=>e.category==='output_limit');
 assert.equal(calls,1);assert.deepEqual(body.thinking,{type:'disabled'});assert.equal(body.max_completion_tokens,3500);assert.equal(body.service_tier,undefined);assert.equal(body.model,'MiniMax-M3');
 const text=fs.readFileSync(path.join(directory,'requests.jsonl'),'utf8'),r=JSON.parse(text.trim().split('\n').at(-1));assert.equal(r.requestedThinking,'disabled');assert.equal(r.reportedReasoningTokens,3500);assert.equal(r.reportedAnswerTokens,0);assert.equal(r.thinkingControlStatus,'reported_reasoning_despite_disabled');assert.equal(r.outputLimitDetail,'reported_reasoning_only');assert.ok(!text.includes('PRIVATE_REASONING_SHOULD_NOT_LEAK'));
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('reasoning accounting does not invent a number or negative answer tokens',()=>{
 const missing={thinking:'disabled'};captureUsage(missing,{prompt_tokens:10,completion_tokens:8});assert.equal(missing.reportedReasoningTokens,undefined);
 const bad={thinking:'disabled'};captureUsage(bad,{completion_tokens:5,completion_tokens_details:{reasoning_tokens:7}});assert.equal(bad.reportedAnswerTokens,undefined);
 const none={thinking:'disabled'};captureUsage(none,{completion_tokens:8,completion_tokens_details:{reasoning_tokens:0}});assert.equal(none.thinkingControlStatus,'reported_no_reasoning');assert.equal(none.reportedAnswerTokens,8);
});
test('reasoning-only output limit preserves finite planner fallback without a paid retry',async()=>{
 let calls=0;const b={birthYear:'1994',forkAge:'32',gender:'男',locationText:'城甲',realityOutcome:'我没报名课程。',hypotheticalDirection:'换成我报名。',details:'六次课九件作品。'};
 const plan=await planWithGapCheck(b,{call:async()=>{calls++;throw Object.assign(Error('fixture'),{category:'output_limit',requestId:'offline-limit',diagnostic:{reason:'output_limit'}});}},{sleep:async()=>{}});
 assert.equal(calls,1);assert.equal(plan.planDiagnostics.outcome,'analysis_unavailable');assert.equal(plan.planDiagnostics.attempts.length,1);assert.equal(plan.recoveryReason,'output_limit');
});
