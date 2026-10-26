import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {internalTimeSchema,internalTimelineIssues,withoutInternalTime} from '../server/internal-timeline.js';
import {compileSetting} from '../src/effective-setting.js';
import {generationInput} from '../server/generation-input.js';
import {storyMessages} from '../server/prompts.js';
import {storyTools} from '../server/story-tools.js';
import {validateSchema} from '../server/schema-validation.js';
import {createCaller} from '../server/minimax.js';
import {chooseStoryPool} from '../server/story-pool.js';
import {createExperience} from '../server/experience.js';
import {createStoryTasks} from '../server/story-tasks.js';
import {hardRetryFeedback} from '../server/generation-retry.js';
import {storyOutputIssues} from '../server/story-output-checks.js';
const b={birthYear:'2000',forkAge:'24',gender:'不透露',locationText:'城甲',realityOutcome:'2024年4月至6月我没有开始学画。',hypotheticalDirection:'我在2024年4月开始学画，只看三个月。',details:'2024年4月1日至6月30日这三个月，每月两次，共六次课。请在第六次课结束后的当晚写来信。'};
const point=(order,period=null,activity=null)=>({period,activity});
const paragraph=(p,mode='scene',relativeToLetter='before')=>({...p,mode,relativeToLetter});
const one=(p,mode='scene',letter='before')=>({events:[paragraph(p,mode,letter)]});
const times=()=>[one(point(1,1,1)),one(point(3,2,3)),one(point(6,3,6),'scene','at')];
const text=['第一次课我慢慢练习画线。','五月的课上我练习画圆。','第六次课结束当晚，我把画收好，准备写这封信。'];
const story=()=>({kind:'story',title:'几张画',identity:'另一个自己',intro:'三个月，我上了六次课。',character:'我慢慢画。',opening:'想聊聊这段日子。',scenes:text.map((s,i)=>({time:'2024年'+(4+i)+'月',title:'片段'+(i+1),text:s}))});
const wire=()=>({kind:'story',title:'几张画',identity:'另一个自己',intro:'三个月，我上了六次课。',...Object.fromEntries(text.map((s,i)=>['chapter'+(i+1),{internalTime:times()[i],title:'片段'+(i+1),text:s}]))});
const compiled=()=>{const c=compileSetting(b);c.originalInput=b;return c;};
const setting=()=>generationInput(compiled());
async function callerHarness(run,{json=false}={}){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'am165-')),requests=[];let n=0;
 const caller=createCaller({mode:'real',model:'offline',site:'cn',base:'https://offline.invalid',key:'offline'},{directory,env:{REQUEST_DIAGNOSTICS:'0'},fetchImpl:async(u,o)=>{
  const request=JSON.parse(o.body);requests.push(request);const value=await run(++n,request),content=JSON.stringify(value);
  return Response.json({choices:[{finish_reason:json?'stop':'tool_calls',message:json?{content}:{tool_calls:[{function:{name:'submit_story',arguments:content}}]}}]});
 }});
 return {caller,requests,close:()=>fs.rmSync(directory,{recursive:true,force:true})};
}
test('body tool offers at most three private event anchors without requiring metadata',()=>{
 const schema=storyTools(storyMessages(b))[0].function.parameters;
 for(const k of ['chapter1','chapter2','chapter3']){assert.ok(!schema.properties[k].required.includes('internalTime'));assert.equal(Object.keys(schema.properties[k].properties)[0],'internalTime');}
 const time=schema.properties.chapter1.properties.internalTime;
 assert.equal(time.properties.events.maxItems,3);assert.ok(!JSON.stringify(time).includes('paragraphs'));assert.ok(!JSON.stringify(time).includes('day'));
});
test('month and activity schemas use known one-based ranges',()=>{
 const schema=internalTimeSchema(setting());assert.deepEqual(schema.properties.events.items.properties.period.enum,[null,1,2,3]);
 assert.ok(!schema.properties.events.items.properties.activity.enum.includes(0));
 const t=times()[0];t.events[0].period=0;assert.ok(validateSchema(schema,t).length);
});
test('unknown month and activity stay null without invented calendar facts',()=>{
 const i=generationInput(compileSetting({...b,hypotheticalDirection:'我去了另一个城市。',details:'写普通日常。'})),schema=internalTimeSchema(i);
 assert.deepEqual(schema.properties.events.items.properties.period.enum,[null]);assert.deepEqual(schema.properties.events.items.properties.activity.enum,[null]);
 assert.deepEqual(internalTimelineIssues([one(point()),one(point()),one(point())],story(),i),[]);
});
test('legacy tools and old saved stories do not manufacture annotations',()=>{
 assert.ok(!storyTools([])[0].function.parameters.properties.chapter1.properties.internalTime);assert.deepEqual(internalTimelineIssues(null,story(),setting()),[]);
});
test('event anchors do not have to map one-to-one to blank-line paragraphs',()=>{
 const s=story();s.scenes[1].text+='\n\n我洗了画笔。\n\n我收好画纸。';assert.deepEqual(internalTimelineIssues(times(),s,setting()),[]);
});
test('past recollections and a future plan can accompany the same current evening',()=>{
 const t=times();t[2].events=[paragraph(point(4,2,4),'recall','before'),paragraph(point(6,3,6),'scene','at'),paragraph(point(null,null,null),'plan','after')];
 assert.deepEqual(internalTimelineIssues(t,story(),setting()),[]);
});
test('annotation mistakes are safe private diagnostics with no automatic retry feedback',()=>{
 const t=times();t[1].events[0].activity=5;const issues=internalTimelineIssues(t,story(),setting());
 assert.ok(issues.some(i=>i.proof.code==='activity_period'));assert.equal(hardRetryFeedback(issues,compiled()),null);
 assert.equal(hardRetryFeedback([{field:'scenes.0.text',reason:'internal_timeline_conflict',proof:{kind:'internal_timeline',code:'paragraph_map'}}],compiled()),null);
});
test('annotations cannot turn completed post-letter events into a content pass',()=>{
 const t=times();t[2].events[0].relativeToLetter='after';assert.ok(internalTimelineIssues(t,story(),setting()).some(i=>i.proof.code==='completed_after_letter'));
 t[2].events[0].mode='plan';assert.deepEqual(internalTimelineIssues(t,story(),setting()),[]);
});
test('plain JSON and tool responses preserve valid private anchors and strip public story',async()=>{
 for(const json of [false,true]){const h=await callerHarness(()=>wire(),{json});try{const r=await h.caller.call('story',storyMessages(b,'',false));assert.deepEqual(r.internalTimeline,times());assert.ok(!JSON.stringify(r.result).includes('internalTime'));assert.equal(h.requests.length,1);}finally{h.close();}}
});
test('missing malformed zero-based and precise-date metadata do not reject valid prose',async()=>{
 for(const invalid of ['missing','malformed','zero','date','legacy']){
  const h=await callerHarness(()=>{const x=wire();if(invalid==='missing')delete x.chapter1.internalTime;if(invalid==='malformed')x.chapter1.internalTime='bad';if(invalid==='zero')x.chapter1.internalTime.events[0].period=0;if(invalid==='date')x.chapter1.internalTime.day='2024-04-09';if(invalid==='legacy')x.chapter1.internalTime={anchor:{order:0,period:0,activity:1},paragraphs:[]};return x;});
  try{const r=await h.caller.call('story',storyMessages(b,'',false));assert.ok(r.internalTimeDiagnostics.length);assert.equal(r.internalTimeline[0],null);assert.ok(!JSON.stringify(r.result).includes('internalTime'));assert.equal(h.requests.length,1);}finally{h.close();}
 }
});
test('invalid auxiliary metadata delivers prose in one call and remains in private draft diagnostics',async()=>{
 const h=await callerHarness(()=>{const x=wire();x.chapter2.internalTime.events[0].activity=5;return x;}),c=compiled(),drafts=[];
 try{const r=await chooseStoryPool({caller:h.caller,messages:storyMessages(b,'',false,c),background:b,effectiveSetting:c,onDraft:d=>drafts.push(d)});assert.equal(h.requests.length,1);assert.ok(drafts[0].internalTimeDiagnostics.length);assert.equal(drafts[0].eligible,true);assert.ok(!JSON.stringify(r).includes('internalTime'));}finally{h.close();}
});
test('no metadata is also allowed at pool level without spending a retry',async()=>{
 const h=await callerHarness(()=>{const x=wire();for(let i=1;i<=3;i++)delete x['chapter'+i].internalTime;return x;}),c=compiled();
 try{await chooseStoryPool({caller:h.caller,messages:storyMessages(b,'',false,c),background:b,effectiveSetting:c});assert.equal(h.requests.length,1);}finally{h.close();}
});
test('unrelated missing body and extra visible fields still fail transport validation',async()=>{
 for(const mutate of [x=>delete x.chapter2.text,x=>x.chapter1.extra='unapproved']){
  const h=await callerHarness(()=>{const x=wire();mutate(x);return x;});try{await assert.rejects(h.caller.call('story',storyMessages(b,'',false)),e=>e.category==='invalid_response');}finally{h.close();}
 }
});
test('a malformed partial repair cannot smuggle time metadata or overwrite chapters',async()=>{
 const h=await callerHarness(()=>({kind:'story',intro:'我慢慢画。',internalTime:{events:[]}}));try{await assert.rejects(h.caller.call('story',storyMessages(b,'',false),{repairFields:['intro']}),e=>e.category==='invalid_response');}finally{h.close();}
});
test('consistent or absent labels never bypass the existing prose frequency checks',async()=>{
 for(const missing of [false,true]){const h=await callerHarness(()=>{const x=wire();x.chapter2.text='三个月，一共八次课。';if(missing)for(let i=1;i<=3;i++)delete x['chapter'+i].internalTime;return x;}),c=compiled();
  try{await assert.rejects(chooseStoryPool({caller:h.caller,messages:storyMessages(b,'',false,c),background:b,effectiveSetting:c}),e=>e.category==='setting_not_met');assert.equal(h.requests.length,4);}finally{h.close();}
 }
});
test('real caller retries a completed next-morning event on prose evidence despite legal labels',async()=>{
 const h=await callerHarness(n=>{const x=wire();if(n===1)x.chapter3.text='第六次课结束当晚，我收好画纸。第二天早上我把画全部装好了。';return x;}),c=compiled(),drafts=[];
 try{await chooseStoryPool({caller:h.caller,messages:storyMessages(b,'',false,c),background:b,effectiveSetting:c,onDraft:d=>drafts.push(d)});assert.equal(h.requests.length,2);assert.ok(drafts[0].hardIssues.some(i=>i.reason==='narration_cutoff_conflict'));assert.ok(h.requests[1].messages.some(m=>m.content.includes('narrationQuote')));}finally{h.close();}
});
test('intro-only repair keeps private diagnostics and body but does not require valid metadata',async()=>{
 const h=await callerHarness(n=>{if(n===2)return {kind:'story',intro:'三个月，我上了六次课。'};const x=wire();x.intro='三个月，一共八次课。';x.chapter1.internalTime='invalid';return x;}),c=compiled(),drafts=[];
 try{const r=await chooseStoryPool({caller:h.caller,messages:storyMessages(b,'',false,c),background:b,effectiveSetting:c,onDraft:d=>drafts.push(d)});assert.equal(h.requests.length,2);assert.equal(drafts.at(-1).delivery.status,'program_accepted_after_field_repair');assert.ok(drafts.at(-1).internalTimeline);assert.ok(drafts.at(-1).internalTimeDiagnostics.some(i=>i.proof.code==='annotation_shape'));assert.ok(!JSON.stringify(r).includes('internalTime'));}finally{h.close();}
});
test('API task polling and session story never expose advisory data or diagnostic codes',async()=>{
 const h=await callerHarness(()=>{const x=wire();x.chapter1.internalTime='invalid';return x;});try{
  const drafts=[],app=createExperience({mode:'real',model:'offline'},h.caller),tasks=createStoryTasks({archive:(o,id,d)=>drafts.push(d),run:(i,opts)=>app.story(i,opts)}),taskId=randomUUID();
  tasks.submit('local',{taskId,instanceId:tasks.instanceId,input:{background:b,clarificationSkipped:true}});const result=await tasks.settled('local',taskId);assert.equal(result.status,'succeeded');assert.ok(drafts.some(d=>d.internalTimeDiagnostics?.length));assert.ok(!JSON.stringify(result).includes('internalTime'));assert.ok(!JSON.stringify(result).includes('annotation_shape'));assert.equal(h.requests.length,1);
 }finally{h.close();}
});
test('defensive stripping preserves prose and never mutates source objects',()=>{
 const x=story();x.internalTimeline=times();x.scenes[0].internalTime=times()[0];const before=JSON.stringify(x),clean=withoutInternalTime(x);assert.equal(clean.scenes[0].text,x.scenes[0].text);assert.ok(!JSON.stringify(clean).includes('internalTime'));assert.equal(JSON.stringify(x),before);
});
test('metadata copied into visible prose remains a hard content error',async()=>{
 for(const text of ['internalTime: period=2，activity=3。','这里多了一行：{"internalTime":{"events":[]}}。']){
  const h=await callerHarness(()=>{const x=wire();x.chapter2.text=text;return x;}),c=compiled();try{await assert.rejects(chooseStoryPool({caller:h.caller,messages:storyMessages(b,'',false,c),background:b,effectiveSetting:c}),e=>e.category==='setting_not_met');assert.equal(h.requests.length,4);}finally{h.close();}
 }
});
