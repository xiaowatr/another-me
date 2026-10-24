import test from 'node:test';
import assert from 'node:assert/strict';
import {frequencyRule,frequencyProof} from '../server/frequency-proof.js';
import {compileSetting} from '../src/effective-setting.js';
import {generationInput} from '../server/generation-input.js';
import {hardStoryIssues} from '../server/story-hard-checks.js';
import {chooseStoryPool} from '../server/story-pool.js';
import {storyMessages} from '../server/prompts.js';

const b={birthYear:'2000',forkAge:'24',gender:'不透露',locationText:'桐城',realityOutcome:'2024年4月我没有开始学陶艺。',hypotheticalDirection:'2024年4月我开始学陶艺，只看三个月。',details:'每个月恰好上两次课。'};
const story=text=>({kind:'story',title:'练习',identity:'另一个自己',intro:'我开始学陶艺。',character:'我慢慢尝试。',opening:'我收好工具。',scenes:[{time:'2024年4月',title:'开始',text},{time:'2024年5月',title:'练习',text:'我试着把碗口修平。'},{time:'2024年6月',title:'收工',text:'我把工具收好。'}]});
test('exact equivalent wording preserves the original quoted span and count',()=>{
 for(const text of ['每月两次','每月恰好两次','每个月恰好上两次课','每月上两次课','每月正好上两节课','每周固定练习一次','每周练习恰好一次']){
  const r=frequencyRule(text);assert.ok(r,text);assert.equal(r.count,text.includes('一次')?1:2);assert.equal(r.quote,text);
 }
});
test('range, approximation, maximum, minimum and alternative counts remain unconfirmed',()=>{
 for(const text of ['大约每月两次','每月恰好两次左右','每月最多两次','每月至少两次','每月两次以内','每月两次以上','每月两次半','每月两次多','每月两次或三次','每月两次到三次','每月不固定两次','每月两次；每月三次'])assert.equal(frequencyRule(text),null,text);
});
test('actual batch constraint wording is preserved in sources and gains structured frequency information',()=>{
 const details='在2022年4月1日至6月30日这三个月中，每个月恰好上两次课，共六次，不存在额外体验课或补课。';
 const input=generationInput(compileSetting({...b,details}));
 assert.ok(input.sources.some(s=>s.id==='details'&&s.text===details));
 assert.ok(input.constraints.frequencyStatements.some(s=>s.sourceRef==='details'&&s.count===2&&s.unit==='月'&&s.quote==='每个月恰好上两次课'));
});
test('explicit contradictory rates now reach the existing program check, without a new semantic gate',()=>{
 const c=compileSetting(b);c.originalInput=b;
 const issues=hardStoryIssues(story('这三个月我每个月恰好上三次课。'),b,c);
 const issue=issues.find(i=>i.reason==='frequency_conflict');assert.ok(issue);assert.equal(issue.proof.kind,'explicit_frequency');assert.equal(issue.proof.expectedCount,2);assert.equal(issue.proof.observedCount,3);
});
test('bounded total proof accepts the new basis wording without changing its evidence requirements',()=>{
 const proof=frequencyProof('每个月恰好上两次课',[{field:'scenes.0.text',quote:'三个月，一共八次课。'}],'三个月');
 assert.ok(proof);assert.equal(proof.expectedCount,6);assert.equal(proof.observedCount,8);
 assert.equal(frequencyProof('每个月恰好上两次课',[{field:'scenes.0.title',quote:'三个月，八次课。'}],'三个月'),null);
});
test('six sessions with nine works and a fourth-session recollection remain legal',()=>{
 const c=compileSetting(b);c.originalInput=b;const x=story('三个月，一共六次课。第六次课后，我想起第四次课做了三只小碟。桌上有九件作品，不是九次课。');
 assert.ok(!hardStoryIssues(x,b,c).some(i=>i.reason==='frequency_conflict'));
 for(const quote of ['第四次课，我做了三只小碟。','晚上把九件小东西摆在桌上。','五月八日是第二次课。','每个月大约三次课。','计划每个月恰好上三次课。'])assert.equal(frequencyProof(b.details,[{field:'scenes.0.text',quote}],'三个月'),null,quote);
});
test('same rates, shorthand and implicit attendance rates retain expected behavior',()=>{
 assert.deepEqual(frequencyRule('每月两次'),{unit:'月',count:2,quote:'每月两次'});
 assert.equal(frequencyProof('每个月恰好上两次课',[{field:'scenes.0.text',quote:'我每月正好上两节课。'}],'三个月'),null);
 assert.ok(frequencyProof('每个月恰好上两次课',[{field:'scenes.0.text',quote:'我每周都去上课。'}],'三个月'));
});
test('existing bounded story retry receives proof and returns corrected story after two mock calls',async()=>{
 const c=compileSetting(b);c.originalInput=b;let calls=0;const drafts=[];
 const caller={call:async(task,m)=>{calls++;assert.equal(task,'story');if(calls===2)assert.equal(JSON.parse(m[1].content).retryFeedback.issues[0].kind,'confirmed_conflict');return {result:story(calls===1?'三个月，一共八次课。':'三个月，一共六次课。'),requestId:'synthetic-frequency-'+calls};}};
 const result=await chooseStoryPool({caller,messages:storyMessages(b,'',false,c),background:b,effectiveSetting:c,onDraft:d=>drafts.push(d)});
 assert.equal(calls,2);assert.equal(result.requestId,'synthetic-frequency-2');assert.equal(drafts[0].eligible,false);assert.equal(drafts.at(-1).selected,true);
});
