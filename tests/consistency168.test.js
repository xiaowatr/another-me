import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {compileSetting} from '../src/effective-setting.js';import {generationInput} from '../server/generation-input.js';import {storyMessages} from '../server/prompts.js';
import {narrationAnchorIssues,courseCompletionIssues} from '../server/story-consistency.js';import {hardStoryIssues} from '../server/story-hard-checks.js';import {hardRetryFeedback} from '../server/generation-retry.js';
import {fieldRepairPlan,fieldRepairMessages,applyFieldRepair} from '../server/story-field-repair.js';import {fieldRepairTools} from '../server/story-tools.js';import {chooseStoryPool} from '../server/story-pool.js';import {createCaller} from '../server/minimax.js';
const b={birthYear:'1990',forkAge:'35',gender:'男',locationText:'城甲',realityOutcome:'2025年4月至6月，我没学陶艺。',hypotheticalDirection:'我在2025年4月开始学陶艺，每月恰好两次，总共六次，无额外课。',details:'请在第六次课结束后的当晚写来信，可以回想第四节课。'};
const compiled=()=>{const c=compileSetting(b);c.originalInput=b;return c;},input=()=>generationInput(compiled());
const texts=['第一次课，我慢慢揉泥。','第四次课，我修了杯口。','第六次课结束就是今晚。我收好工具，写这封信。'];
const story=t=>({kind:'story',title:'几件东西',identity:'另一个自己',intro:'我上了六次课，今晚是第六次课结束的当晚。',character:'我慢慢揉泥。',opening:'想跟你聊聊这段日子。',scenes:texts.map((s,i)=>({time:'2025年'+(4+i)+'月',title:i===2?'第六次课当晚':'片段'+i,text:i===2?t||s:s}))});
const wire=t=>({kind:'story',title:'几件东西',identity:'另一个自己',intro:'我上了六次课，今晚是第六次课结束的当晚。',...Object.fromEntries(story(t).scenes.map((s,i)=>['chapter'+(i+1),{title:s.title,text:s.text,internalTime:{events:[{mode:'scene',relativeToLetter:i===2?'at':'before',period:i+1,activity:[1,4,6][i]}]}}]))});
async function harness(fn){const directory=fs.mkdtempSync(path.join(os.tmpdir(),'am168-')),requests=[];const caller=createCaller({mode:'real',model:'offline',site:'cn',base:'https://offline.invalid',key:'offline'},{directory,env:{REQUEST_DIAGNOSTICS:'0'},fetchImpl:async(u,o)=>{const request=JSON.parse(o.body);requests.push(request);return Response.json({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{function:{name:'submit_story',arguments:JSON.stringify(await fn(requests.length,request))}}]}}]});}});return {caller,requests,close:()=>fs.rmSync(directory,{recursive:true,force:true})};}

test('same sixth class cannot be yesterday at its specified same-evening letter cutoff',()=>{
 for(const text of ['第六次课是昨晚。今晚我收好了工具。','六月第二次课，也就是第六次，是昨晚。','昨晚是第六次课。','第6次课在昨天晚上。']){
  const issue=narrationAnchorIssues(story(text),input())[0];assert.ok(issue,text);assert.equal(issue.proof.dayOffset,-1);assert.ok(b.details.includes(issue.proof.rule.quote));assert.ok(text.includes(issue.proof.quote));
 }
});
test('different named event, earlier passage, old-course recall and quoted speech are not hard failures',()=>{
 for(const text of ['第四次课是昨晚，我想起那段日子。','我想起去年另一门课，第六次课是昨晚。','老师说：“第六次课是昨晚。”','朋友的第六次课是昨晚。','如果第六次课在明晚，我打算再练一遍。'])assert.deepEqual(narrationAnchorIssues(story(text),input()),[],text);
 const s=story();s.scenes[0].text='第六次课是昨晚。';assert.deepEqual(narrationAnchorIssues(s,input()),[]);
});
test('tonight, other future plans and ordinary memories are retained',()=>{
 for(const text of ['第六次课就是今晚结束的。','第六次课结束，我想起第四次课的第二天。','第六次课结束，我打算明晚整理作品。'])assert.deepEqual(narrationAnchorIssues(story(text),input()),[],text);
});
test('without a source-backed numbered letter anchor no event identity is guessed',()=>{
 const i=generationInput(compileSetting({...b,details:'写这三个月的生活。'}));assert.deepEqual(narrationAnchorIssues(story('第六次课是昨晚。'),i),[]);
});
const d12={...b,birthYear:'1960',forkAge:'62',hypotheticalDirection:'我在2022年4月开始学陶艺。',realityOutcome:'2022年4月到6月，我没学陶艺。',details:'2022年4月1日至6月30日这三个月，每月恰好两次，共六次课。'};
const courseStory=()=>{const s=story('最后一次课是六月底。课上完了，老师说下一期秋天开，我说等通知，没说一定来。');s.intro='我六十二岁那年开始学陶艺，三个月上了六次，课还没上完。';s.synopsis=s.intro;return s;};
test('same-cycle completed final lesson contradicts the intro unfinished claim, even with a later undecided course',()=>{
 const s=courseStory(),issues=courseCompletionIssues(s,generationInput(compileSetting(d12)));assert.equal(issues.length,1);assert.equal(issues[0].field,'intro');assert.equal(issues[0].proof.expectedTotal,6);assert.ok(s.scenes[2].text.includes(issues[0].proof.bodyQuote));
});
test('unfinished objects, unmastered skill and another future course are not unfinished current attendance',()=>{
 for(const intro of ['三个月上了六次课，作品还没烧好。','三个月上了六次课，可我还没学会拉坯。','三个月上了六次课，下一期的课程还没上完。','三个月上了六次课，如果课还没上完会怎样。']){const s=courseStory();s.intro=intro;delete s.synopsis;assert.deepEqual(courseCompletionIssues(s,generationInput(compileSetting(d12))),[],intro);}
});
test('without exact source total, same-cycle summary binding or completed body witness no state is guessed',()=>{
 const s=courseStory();assert.deepEqual(courseCompletionIssues(s,{sources:[]}),[]);
 s.intro='课程还没上完。';delete s.synopsis;assert.deepEqual(courseCompletionIssues(s,generationInput(compileSetting(d12))),[]);
 const x=courseStory();x.scenes[2].text='我打算最后一次课上完了再决定。';assert.deepEqual(courseCompletionIssues(x,generationInput(compileSetting(d12))),[]);
});
test('new issues carry source-grounded feedback and reject unrelated proofs',()=>{
 const c=compiled(),issue=narrationAnchorIssues(story('第六次课是昨晚。'),input())[0];assert.equal(hardRetryFeedback([issue],c).issues[0].field,'chapter3.text');
 assert.equal(hardRetryFeedback([{...issue,proof:{...issue.proof,eventOrdinal:5}}],c),null);
});
test('chapter tools permit only one specified text, no titles, times or other chapters',()=>{
 const schema=fieldRepairTools(['chapter3.text'],storyMessages(b))[0].function.parameters;assert.deepEqual(schema.required,['kind','chapter3']);assert.deepEqual(schema.properties.chapter3.required,['text']);assert.equal(schema.properties.chapter3.additionalProperties,false);
 for(const fields of [['chapter4.text'],['chapter1.title'],['chapter1.text','chapter2.text'],['chapter3.text','chapter3.text']])assert.throws(()=>fieldRepairTools(fields));
});
test('only explicit time proofs can request a body repair; multiple chapter locations fall back',()=>{
 const c=compiled(),s=story('第六次课是昨晚。'),issue=narrationAnchorIssues(s,input())[0];assert.deepEqual(fieldRepairPlan(s,[issue],c).fields,['chapter3.text']);
 assert.equal(fieldRepairPlan(s,[{...issue,reason:'made_up'}],c),null);assert.equal(fieldRepairPlan(s,[issue,{...issue,field:'scenes.1.text'}],c),null);
});
test('repair messages provide exact current text and proof while withholding edit access to all other content',()=>{
 const c=compiled(),s=story('第六次课是昨晚。'),plan=fieldRepairPlan(s,narrationAnchorIssues(s,input()),c),m=fieldRepairMessages(storyMessages(b,'',false,c),s,plan),p=JSON.parse(m[1].content);
 assert.equal(p.currentFields['chapter3.text'],s.scenes[2].text);assert.equal(p.readonlyContext.scenes[0].text,s.scenes[0].text);assert.ok(!Object.hasOwn(p.readonlyContext.scenes[2],'text'));assert.ok(b.details.includes(p.confirmedIssues[0].proof.rule.quote));
});
test('real transport and pool repair the bad chapter in two calls, preserve all other story fields, and invalidate stale anchors',async()=>{
 const h=await harness(n=>n===1?wire('六月的第二次课，也就是第六次，是昨晚。\n\n今晚我收好了工具。'):{kind:'story',chapter3:{text:texts[2]}}),c=compiled(),drafts=[];
 try{
  const out=await chooseStoryPool({caller:h.caller,messages:storyMessages(b,'',false,c),background:b,effectiveSetting:c,onDraft:d=>drafts.push(d)}),old=drafts[0].payload.story;
  assert.equal(h.requests.length,2);assert.equal(h.requests[1].max_completion_tokens,3000);assert.deepEqual(out.result.scenes.slice(0,2),old.scenes.slice(0,2));assert.equal(out.result.scenes[2].title,old.scenes[2].title);assert.equal(out.result.scenes[2].time,old.scenes[2].time);assert.equal(out.result.intro,old.intro);assert.equal(out.result.title,old.title);assert.match(old.scenes[2].text,/昨晚/);assert.equal(out.result.scenes[2].text,texts[2]);
  assert.equal(drafts.at(-1).internalTimeline[2],null);assert.ok(drafts.at(-1).internalTimeDiagnostics.some(i=>i.proof.code==='annotation_stale_after_body_repair'));assert.ok(!JSON.stringify(out).includes('internalTime'));assert.equal(drafts.at(-1).delivery.status,'program_accepted_after_field_repair');
 }finally{h.close();}
});
test('an extra chapter, title, time or auxiliary field in a partial response is rejected',async()=>{
 for(const extra of ['chapter2','title','time','internalTime']){const h=await harness(()=>{const patch={kind:'story',chapter1:{text:'我慢慢揉泥。'}};if(extra==='chapter2')patch.chapter2={text:'改写别章'};else patch.chapter1[extra]='不允许';return patch;});try{const c=compiled(),s=story('第六次课是昨晚。'),plan={fields:['chapter1.text'],issues:[]};await assert.rejects(h.caller.call('story',fieldRepairMessages(storyMessages(b,'',false,c),s,plan),{repairFields:plan.fields}),e=>e.category==='invalid_response');}finally{h.close();}}
});
test('a still-wrong partial repair is rechecked, not automatically accepted',async()=>{
 const h=await harness(n=>n%2?wire('第六次课是昨晚。'):{kind:'story',chapter3:{text:'第六次课是昨晚。'}}),c=compiled();
 try{await assert.rejects(chooseStoryPool({caller:h.caller,messages:storyMessages(b,'',false,c),background:b,effectiveSetting:c}),e=>e.category==='setting_not_met');assert.equal(h.requests.length,4);}finally{h.close();}
});
test('a partial time fix introducing another hard count conflict is rejected within the shared cap',async()=>{
 const h=await harness(n=>n%2?wire('第六次课是昨晚。'):{kind:'story',chapter3:{text:'今晚第六次课结束，我每月上三次课。'}}),c=compiled();
 try{await assert.rejects(chooseStoryPool({caller:h.caller,messages:storyMessages(b,'',false,c),background:b,effectiveSetting:c}),e=>e.category==='setting_not_met');assert.equal(h.requests.length,4);}finally{h.close();}
});
test('a correct story never invokes a repair model',async()=>{
 const h=await harness(()=>wire()),c=compiled();try{await chooseStoryPool({caller:h.caller,messages:storyMessages(b,'',false,c),background:b,effectiveSetting:c});assert.equal(h.requests.length,1);}finally{h.close();}
});
test('intro-only completion repair preserves the complete body and existing metadata rules',()=>{
 const c=compileSetting(d12);c.originalInput=d12;const s=courseStory(),issues=hardStoryIssues(s,d12,c),plan=fieldRepairPlan(s,issues,c);assert.ok(plan);assert.deepEqual(plan.fields,['intro']);
 const repaired=applyFieldRepair(s,{kind:'story',intro:'我六十二岁那年开始学陶艺，三个月的六次课上完了。'},plan,storyMessages(d12,'',false,c),d12,c);assert.deepEqual(repaired.result.scenes,s.scenes);assert.deepEqual(repaired.issues,[]);assert.match(s.intro,/还没上完/);
});

test('another-course recollection retains its own reference time across sentences until returning',()=>{const s=story('我想起去年另一门课。第六次课是昨晚。回到今晚，第六次课是昨晚。');const issues=narrationAnchorIssues(s,input());assert.equal(issues.length,1);assert.match(issues[0].proof.quote,/回到今晚/);});

test('an earlier completed lesson cannot borrow a later last-lesson mention as completion evidence',()=>{const s=courseStory();s.scenes[2].text='第四次课结束，我考虑最后一次课还要做什么。';assert.deepEqual(courseCompletionIssues(s,generationInput(compileSetting(d12))),[]);});

test('another person unfinished course is not forced to the protagonist completion state',()=>{const s=courseStory();s.intro='三个月我上了六次课，朋友的课程还没上完。';s.synopsis=s.intro;assert.deepEqual(courseCompletionIssues(s,generationInput(compileSetting(d12))),[]);});
