import test from 'node:test';
import assert from 'node:assert/strict';
import {storyOutputIssues} from '../server/story-output-checks.js';
import {ageFacts,ageFactIssues,ageNumber,ageProofIsGrounded} from '../server/age-facts.js';
import {compileSetting} from '../src/effective-setting.js';
import {generationInput} from '../server/generation-input.js';
import {storyMessages} from '../server/prompts.js';
import {hardStoryIssues} from '../server/story-hard-checks.js';
import {hardRetryFeedback} from '../server/generation-retry.js';
import {chooseStoryPool} from '../server/story-pool.js';
const b={birthYear:'1960',forkAge:'62',gender:'女',locationText:'城甲',realityOutcome:'2022年4月至6月我没有开始学陶艺。',hypotheticalDirection:'我在2022年4月开始学陶艺。',details:'每月两次，共六次课。'};
const story=(intro='我六十二岁那年开始学陶艺。')=>({kind:'story',title:'几只碗',identity:'另一个自己',intro,character:'我走进教室。',opening:'想跟你聊聊这段日子。',scenes:[{time:'2022年4月',title:'第一次',text:'我在第一次课上慢慢练习。'},{time:'2022年5月',title:'期间',text:'我试着修碗口。'},{time:'2022年6月',title:'后来',text:'第六次课结束，我收好工具。'}]});
test('explicit event age is read by the program, without asking the model to calculate it',()=>{
 const f=ageFacts(b);assert.deepEqual(f.allowedAgeAtEvent,[62]);assert.equal(f.eventYear,2022);assert.equal(f.birthYear,1960);assert.equal(f.inputConflict,false);
 assert.deepEqual(generationInput(compileSetting(b)).constraints.ageFacts.allowedAgeAtEvent,[62]);
});
test('year-only evidence retains birthday uncertainty and never guesses a birthday',()=>{
 const f=ageFacts({...b,forkAge:''});assert.deepEqual(f.allowedAgeAtEvent,[61,62]);assert.equal(f.birthdayUnknown,true);
 for(const age of [61,62])assert.deepEqual(ageFactIssues(story(`我${age}岁那年开始学陶艺。`),{...b,forkAge:''}),[]);
 assert.ok(ageFactIssues(story('我60岁那年开始学陶艺。'),{...b,forkAge:''}).length);
});
test('explicit 61 at this node is not overwritten by year subtraction to 62',()=>{
 const x={...b,forkAge:'61'};assert.deepEqual(ageFacts(x).allowedAgeAtEvent,[61]);assert.deepEqual(ageFactIssues(story('我六十一岁那年开始学陶艺。'),x),[]);assert.ok(ageFactIssues(story(),x).length);
});
test('inconsistent historical inputs do not become a guessed authoritative age',()=>{
 const x={...b,forkAge:'20'};assert.equal(ageFacts(x).inputConflict,true);assert.deepEqual(ageFactIssues(story(),x),[]);
});
test('without enough age evidence the program does not invent a number',()=>{
 const x={...b,birthYear:'',forkAge:''};assert.deepEqual(ageFacts(x).allowedAgeAtEvent,[]);assert.deepEqual(ageFactIssues(story('我六十岁开始学陶艺。'),x),[]);
});
test('an estimated year from birth plus age is not promoted to a user-provided date',()=>{
 const f=ageFacts({...b,hypotheticalDirection:'我开始学陶艺。',realityOutcome:'我没开始学陶艺。',inputVersion:'6'});assert.equal(f.eventYear,null);assert.deepEqual(f.allowedAgeAtEvent,[62]);
});
test('Chinese and Arabic exact ages include zero and up to 120',()=>{
 for(const [s,n] of [['六十',60],['六十二',62],['二十',20],['十',10],['十一',11],['一百',100],['一百零一',101],['一百一十',110],['一百一十九',119],['一百二十',120],['0',0],['零',0]])assert.equal(ageNumber(s),n,s);
 for(const s of ['一百三十','131','六十多','不确定','岁'])assert.equal(ageNumber(s),null,s);
});
test('RT03-type Chinese intro age conflicts are caught with exact source evidence',()=>{
 const issue=ageFactIssues(story('我六十岁那年在城甲报了陶艺课。'),b)[0];assert.equal(issue.field,'intro');assert.equal(issue.proof.observedAge,60);assert.deepEqual(issue.proof.expectedAges,[62]);assert.match(issue.proof.quote,/六十岁/);assert.equal(ageProofIsGrounded(issue.proof,b),true);
});
test('a nearby numeric age is also a conflict when the user explicitly supplied the node age',()=>{
 assert.ok(ageFactIssues(story('我61岁那年开始学陶艺。'),b).length);assert.deepEqual(ageFactIssues(story('我62岁那年开始学陶艺。'),b),[]);
});
test('no age mention is required for an otherwise valid story',()=>assert.deepEqual(ageFactIssues(story('我开始学陶艺。'),b),[]));
test('other people ages and reported dialogue are not forced to the protagonist age',()=>{
 for(const text of ['老师六十岁，教我揉泥。','我认识一位六十岁的老师。','我妈六十岁那年开始学陶艺。','老师说：“我六十岁那年开始学陶艺。”'])assert.deepEqual(ageFactIssues(story(text),b),[],text);
});
test('vague ages and future wishes are not exact-number contradictions',()=>{
 for(const text of ['我大概六十岁开始学陶艺。','我六十岁左右开始学陶艺。','如果我二十岁那年开始学陶艺，会怎样。','我打算将来继续学陶艺。'])assert.deepEqual(ageFactIssues(story(text),b),[],text);
});
test('explicit old-year recollections use their own year and birthday range',()=>{
 assert.deepEqual(ageFactIssues(story('2020年我六十岁，曾经想过学陶艺。'),b),[]);
 assert.deepEqual(ageFactIssues(story('我在2020年六十岁，曾经想过学陶艺。'),b),[]);
 assert.ok(ageFactIssues(story('2020年我七十岁。'),b).length);
});
test('unanchored childhood recollections are not forced to the event age',()=>{
 for(const text of ['我想起小时候。我五岁的时候看过泥塑。','我二十岁那年去过海边。'])assert.deepEqual(ageFactIssues(story(text),b),[],text);
 const x=story();x.scenes[0].text='我想起小时候。那时我五岁，第一次见到泥。';assert.deepEqual(ageFactIssues(x,b),[]);
});
test('explicit later-year scenes use calendar ranges rather than the original node age',()=>{
 const x=story();x.scenes[2]={time:'2025年',title:'以后',text:'我现在六十五岁。'};assert.deepEqual(ageFactIssues(x,b),[]);x.scenes[2].text='我现在六十岁。';assert.ok(ageFactIssues(x,b).some(i=>i.field==='scenes.2.text'));
});
test('grounded age feedback rejects forged expectations or unrelated facts signatures',()=>{
 const c=compileSetting(b);c.originalInput=b;const issue=ageFactIssues(story('我60岁开始学陶艺。'),b)[0];assert.ok(hardRetryFeedback([issue],c));
 for(const p of [{...issue.proof,expectedAges:[50]},{...issue.proof,factsSignature:'invented'}])assert.equal(hardRetryFeedback([{...issue,proof:p}],c),null);
});
test('age checks join existing hard checks and cannot be bypassed by time annotations',()=>{
 const c=compileSetting(b);c.originalInput=b;assert.ok(hardStoryIssues(story('我六十岁那年开始学陶艺。'),b,c).some(i=>i.reason==='age_fact_conflict'));
});
test('an intro age error is repaired locally in the shared budget, preserving all scenes',async()=>{
 const c=compileSetting(b);c.originalInput=b;let calls=0;const drafts=[];
 const bad=story('我六十岁那年开始学陶艺。');
 const result=await chooseStoryPool({caller:{call:async(t,m,o)=>{calls++;if(calls===1)return {result:bad,requestId:'offline-age-1'};assert.deepEqual(o.repairFields,['intro']);return {result:{kind:'story',intro:'我六十二岁那年开始学陶艺。'},requestId:'offline-age-2'};}},messages:storyMessages(b,'',false,c),background:b,effectiveSetting:c,onDraft:d=>drafts.push(d)});
 assert.equal(calls,2);assert.deepEqual(result.result.scenes,bad.scenes);assert.equal(result.result.intro,'我六十二岁那年开始学陶艺。');assert.equal(drafts.at(-1).delivery.status,'program_accepted_after_field_repair');
});

test('a later birthday is not forced back to the explicitly supplied starting age',()=>{const x={...b,forkAge:'61'};for(const intro of ['到了六月，我六十二岁了。','2022年6月我六十二岁了。'])assert.deepEqual(ageFactIssues(story(intro),x),[],intro);});

test('a later-month numeric age still has to fit the known birth year',()=>{const x={...b,forkAge:'61'};assert.ok(ageFactIssues(story('2022年6月我六十三岁了。'),x).length);});

test('an earlier birthday wish is not asserted as the current starting age',()=>{assert.deepEqual(ageFactIssues(story('我六十岁生日那天想过学陶艺，后来才报名。'),b),[]);});

test('body age feedback uses the real chapter tool field path',()=>{const c=compileSetting(b);c.originalInput=b;const x=story();x.scenes[0].text='我六十岁开始学陶艺。';const issue=ageFactIssues(x,b)[0];assert.equal(hardRetryFeedback([issue],c).issues[0].field,'chapter1.text');});

test('program age-fact labels cannot leak into story prose',()=>{const x=story();x.scenes[0].text='ageFacts: explicitAgeAtEvent=62。';assert.ok(storyOutputIssues(x,b).some(i=>i.reason==='internal_instruction_in_story'));});
