import test from 'node:test';
import assert from 'node:assert/strict';
import {narrationAnchor,narrativeTimeIssues} from '../server/narrative-time.js';
const input=text=>({sources:[{id:'details',text}]});
const story=text=>({scenes:[{title:'回忆',text:'我收好东西。'},{title:'期间',text:'我去上课。'},{title:'写这封信',text}]});
for(const phrase of ['请在当天晚上写来信。','只写当天晚上的经历。','请在当晚写信。'])test('explicit evening cutoff is preserved without inventing a date: '+phrase,()=>{
 const i=input(phrase),a=narrationAnchor(i.sources);assert.ok(a);assert.equal(a.eventOrdinal,null);assert.ok(phrase.includes(a.quote));
 assert.equal(narrativeTimeIssues(story('第二天早上，我已经用它喝过水了。'),i)[0]?.reason,'narration_cutoff_conflict');
});
test('optional hypothetical negative and example evenings are not promoted to hard deadlines',()=>{
 for(const text of ['可以在当天晚上写来信。','如果在当晚写信。','不要在当晚写信。','比如只写当天晚上的经历。'])assert.equal(narrationAnchor(input(text).sources),null,text);
});
test('a past memory and its next morning remain before the current letter',()=>{
 const i=input('只写当天晚上的经历。');assert.deepEqual(narrativeTimeIssues(story('我想起上周。第二天早上我把杯子洗好了。'),i),[]);
});
test('returning from a recollection restores the current-evening cutoff',()=>{
 const i=input('请在当天晚上写来信。'),text='我想起上周。第二天早上我把杯子洗好了。回到今晚，我把杯子放下。第二天早上我已经出门了。';
 const issues=narrativeTimeIssues(story(text),i);assert.equal(issues.length,1);assert.match(issues[0].proof.quote,/出门/);
});
test('future plans and imagined actions are not completed next-day events',()=>{
 const i=input('只写当天晚上的经历。');
 for(const text of ['明天早上我打算把杯子放到窗边。','第二天早上我准备再看看它。','如果第二天早上我把杯子收好了，会是什么样。','我想象第二天早上我已经用过杯子的样子。'])assert.deepEqual(narrativeTimeIssues(story(text),i),[],text);
});

test('an explicit yesterday memory does not move the letter cutoff forward',()=>{assert.deepEqual(narrativeTimeIssues(story('我想起昨天。第二天早上我把杯子洗好了。'),input('只写当天晚上的经历。')),[]);});
