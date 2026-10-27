import test from 'node:test';
import assert from 'node:assert/strict';
import {narrationAnchor,calendarActivitySequence,narrativeTimeFrame,narrativeTimeIssues,calendarOrdinalIssues} from '../server/narrative-time.js';
import {compileSetting} from '../src/effective-setting.js';
import {generationInput} from '../server/generation-input.js';
import {storyMessages} from '../server/prompts.js';
import {hardStoryIssues} from '../server/story-hard-checks.js';
import {hardRetryFeedback} from '../server/generation-retry.js';
import {chooseStoryPool} from '../server/story-pool.js';
const b={birthYear:'2000',forkAge:'24',gender:'不透露',locationText:'城甲',realityOutcome:'2024年4月至6月我没开始学画。',hypotheticalDirection:'2024年4月我开始学画，每月两次，总共六次，无额外课。',details:'请在第六次课结束后的当晚写来信，可以回想第四节课。'};
const s=text=>({kind:'story',title:'几幅画',identity:'另一个自己',intro:'我完成六次课。',character:'我慢慢画。',opening:'我收好画笔。',scenes:[{time:'2024年4月',title:'开始',text:'我第一次上课，练习画线。'},{time:'2024年5月',title:'第四节课',text:'我在第四节课画了三张小画。'},{time:'2024年6月',title:'第六次课之后的那晚',text}]});
const input=()=>generationInput(compileSetting(b));
test('explicit same-evening letter becomes an event-relative source-backed anchor',()=>{
 const i=input(),a=i.constraints.narrativeTime.narrationAnchor;
 assert.equal(a.eventOrdinal,6);assert.equal(a.phase,'same_evening');assert.equal(a.sourceRef,'details');assert.ok(b.details.includes(a.quote));
 assert.equal(JSON.parse(storyMessages(b)[1].content).effectiveSetting.constraints.narrativeTime.narrationAnchor.eventOrdinal,6);
});
test('unsupported or optional timing is not promoted to a hard cutoff',()=>{
 for(const text of ['可以在第六次课结束后的当晚写来信。','比如在第六次课结束后的当晚写来信。','不要在第六次课结束后的当晚写来信。','如果在第六次课结束后的当晚写来信。','写第六次课以后的生活。'])assert.equal(narrationAnchor([{id:'details',text}]),null,text);
});
test('conflicting event cutoffs are not guessed; a latest explicit confirmation can resolve them',()=>{
 const sources=[{id:'details',text:b.details},{id:'extra',text:'在第五次课结束后的当晚写信。'}];assert.equal(narrationAnchor(sources),null);
 const a=narrationAnchor([...sources,{id:'confirmation:0',text:'改为在第四次课结束后的当晚写信。'}]);assert.equal(a.eventOrdinal,4);
});
test('D12-style full-month constraints produce separate monthly and cumulative ordinals',()=>{
 const sources=[{id:'hypotheticalDirection',text:'我在2024年4月开始学画。'},{id:'details',text:'2024年4月1日至6月30日这三个月，每个月恰好上两次课，共六次，无额外课。'}];
 const plan=calendarActivitySequence(sources);assert.equal(plan.kind,'creative_arrangement');assert.equal(plan.totalCount,6);
 assert.deepEqual(plan.occurrences.map(x=>[x.month,x.withinMonth,x.ordinal]),[[4,1,1],[4,2,2],[5,1,3],[5,2,4],[6,1,5],[6,2,6]]);
 assert.ok(sources[1].text.includes(plan.rangeQuote));assert.ok(sources[1].text.includes(plan.totalQuote));
});
test('partial months, conflicting totals, approximation and missing totals do not create a calendar ledger',()=>{
 for(const text of ['2024年4月15日至6月30日，每月两次，共六次课。','2024年4月1日至6月20日，每月两次，共六次课。','2024年4月至6月，每月两次，共八次课。','2024年4月至6月，大约每月两次，共六次课。','2024年4月至6月，每月两次课。']){
  assert.equal(calendarActivitySequence([{id:'hypotheticalDirection',text:'2024年4月我开始学画。'},{id:'details',text}]),null,text);
 }
});
test('same-evening narrator cannot assert completed next-morning actions',()=>{
 const issues=narrativeTimeIssues(s('第六次课结束，我收好画笔。第二天早上我把六张画摆在窗边，又装进了盒子。'),input());
 assert.equal(issues.length,1);assert.equal(issues[0].field,'scenes.2.text');assert.equal(issues[0].reason,'narration_cutoff_conflict');assert.ok(b.details.includes(issues[0].proof.rule.quote));
});
test('planning, hypotheticals, quotes and unanchored relative mornings are not hard failures',()=>{
 for(const text of ['明天早上我打算把画摆在窗边。','第二天早上我打算把画摆在窗边。','如果第二天早上我把画拿出去，也许会有新的想法。','老师说：“第二天早上我把画收走了。”'])assert.deepEqual(narrativeTimeIssues(s(text),input()),[],text);
 const x=s('第二天早上我把画摆在窗边。');x.scenes[2].title='几张画';assert.deepEqual(narrativeTimeIssues(x,input()),[]);
});
test('next morning in an earlier chapter remains legal',()=>{
 const x=s('今晚我把六张画收好。');x.scenes[0].text='第一次课后，第二天早上我把画拿出来看了看。';assert.deepEqual(narrativeTimeIssues(x,input()),[]);
});
test('a fourth-session memory in the final chapter can include its next morning',()=>{
 assert.deepEqual(narrativeTimeIssues(s('我想起第四次课。第二天早上我把那张画夹进本子里。'),input()),[]);
});
test('after returning from a memory, the letter cutoff applies again',()=>{
 const x=s('我想起第四次课。第二天早上我把那张画夹进本子里。回过神，今晚我已经上完第六次课。第二天早上我把所有画装好了。');
 const issues=narrativeTimeIssues(x,input());assert.equal(issues.length,1);assert.match(issues[0].proof.quote,/所有画/);
});
test('without an explicit letter cutoff this narrow rule never blocks next-day development',()=>{
 const i={sources:[{id:'details',text:'写这三个月的生活。'}]};assert.deepEqual(narrativeTimeIssues(s('第二天早上我把画装好了。'),i),[]);assert.equal(narrativeTimeFrame(i),null);
});
test('six lessons and nine objects with a fourth-session recollection remain allowed',()=>{
 const text='第六次课结束的当晚，我把九件小东西摆好，想起第四节课。';assert.deepEqual(narrativeTimeIssues(s(text),input()),[]);
});
test('direct time proof reaches existing checks and bounded retry feedback',()=>{
 const c=compileSetting(b);c.originalInput=b;const x=s('第二天早上我把所有画装好了。');
 const issue=hardStoryIssues(x,b,c).find(x=>x.reason==='narration_cutoff_conflict');assert.ok(issue);
 const f=hardRetryFeedback([issue],c);assert.equal(f.issues[0].field,'chapter3.text');assert.ok(b.details.includes(f.issues[0].inputBasis.narrationQuote));
 assert.equal(hardRetryFeedback([{...issue,proof:{...issue.proof,rule:{quote:'凭空的截止条件'}}}],c),null);
});
test('a rejected next-day draft retries within the original pool and can deliver a corrected same-evening draft',async()=>{
 const c=compileSetting(b);c.originalInput=b;let calls=0;const drafts=[];
 const result=await chooseStoryPool({caller:{call:async(t,m,o)=>{calls++;if(calls===2){assert.deepEqual(o.repairFields,['chapter3.text']);assert.ok(b.details.includes(JSON.parse(m[1].content).confirmedIssues[0].proof.rule.quote));return {result:{kind:'story',chapter3:{text:'今晚我把画收好，明天打算再看一遍。'}},requestId:'synthetic-time-'+calls};}return {result:s('第二天早上我把所有画装好了。'),requestId:'synthetic-time-'+calls};}},messages:storyMessages(b,'',false,c),background:b,effectiveSetting:c,onDraft:d=>drafts.push(d)});
 assert.equal(calls,2);assert.equal(result.requestId,'synthetic-time-2');assert.equal(drafts[0].eligible,false);assert.equal(drafts.at(-1).selected,true);
});
test('four repeated time failures stop without an eligible story or an extra call',async()=>{
 const c=compileSetting(b);let calls=0;
 await assert.rejects(chooseStoryPool({caller:{call:async()=>{calls++;return {result:s('第二天早上我把所有画装好了。')};}},messages:storyMessages(b,'',false,c),background:b,effectiveSetting:c}),e=>e.category==='setting_not_met');assert.equal(calls,4);
});

const calendarB={...b,details:'2024年4月1日至6月30日这三个月，每月两次，共六次课。'};
test('explicit start, rate, total and last-session letter provide the same D19 sequence',()=>{
 const seq=input().constraints.narrativeTime.activitySequence;assert.ok(seq);assert.deepEqual(seq.occurrences.map(x=>x.month),[4,4,5,5,6,6]);
});
test('first actual model failure: May eighth cannot be the fifth class under two per month from April',()=>{
 const i=generationInput(compileSetting(calendarB)),x=s('六月的第六次课结束，我收好了画笔。');x.scenes[1].text='五月八号是第五次课。那天我带了一张纸。';
 const issue=calendarOrdinalIssues(x,i)[0];assert.ok(issue);assert.equal(issue.observedOrdinal,undefined);assert.equal(issue.proof.observedOrdinal,5);assert.equal(issue.proof.expectedMaximum,4);
});
test('monthly second, a past-session recollection and nine objects are never counted as five lessons',()=>{
 const i=generationInput(compileSetting(calendarB));
 for(const text of ['五月的第二次课，我画了九张纸。','五月八号，我回想第五次课会怎样。','五月中旬的第二次课，我想起第一节课。','六月的第五次课，我画了九张纸。']){const x=s(text);assert.deepEqual(calendarOrdinalIssues(x,i),[],text);}
});
test('an explicit other year cannot be matched to the current calendar sequence',()=>{
 assert.deepEqual(calendarOrdinalIssues(s('2023年五月八号是第五次课。'),generationInput(compileSetting(calendarB))),[]);
});
test('imagining next morning is not an assertion that it has happened',()=>{
 assert.deepEqual(narrativeTimeIssues(s('我想象第二天早上我把这些画摆好了的样子。'),input()),[]);
});
test('calendar proof reaches the original bounded retry loop',async()=>{
 const c=compileSetting(calendarB);c.originalInput=calendarB;let calls=0;
 const result=await chooseStoryPool({caller:{call:async(t,m)=>{calls++;if(calls===2)assert.ok(JSON.parse(m[1].content).retryFeedback.issues.some(x=>x.inputBasis.calendarQuote));return {result:s(calls===1?'五月八号是第五次课。':'六月八号是第五次课。'),requestId:'calendar-'+calls};}},messages:storyMessages(calendarB,'',false,c),background:calendarB,effectiveSetting:c});
 assert.equal(calls,2);assert.equal(result.requestId,'calendar-2');
});

test('a final calendar-month session can identify the same requested sixth-session evening',()=>{
 const x=s('第二天早上我把画全部装好了。');x.scenes[2].title='六月第二次课之后';
 assert.equal(narrativeTimeIssues(x,input()).filter(i=>i.reason==='narration_cutoff_conflict').length,1);
});
test('an explicit partial-month range prevents the start-rate-total fallback too',()=>{
 const i=generationInput(compileSetting({...b,details:b.details+'2024年4月15日至6月20日。'}));
 assert.equal(i.constraints.narrativeTime.activitySequence,null);
});
