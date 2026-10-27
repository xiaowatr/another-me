import test from 'node:test';import assert from 'node:assert/strict';
import {ageFactIssues} from '../server/age-facts.js';import {AGE_SLOT,fillAgeSlots,ageSlotIssues} from '../server/age-slots.js';
import {compileSetting} from '../src/effective-setting.js';import {storyMessages} from '../server/prompts.js';import {fieldRepairPlan} from '../server/story-field-repair.js';import {chooseStoryPool} from '../server/story-pool.js';
const b={birthYear:'1990',forkAge:'35',gender:'男',locationText:'城甲',realityOutcome:'2025年4月至6月我没学陶艺。',hypotheticalDirection:'2025年4月我开始学陶艺。',details:''};
const make=(text='我收好了工具。')=>({kind:'story',title:'几只碗',identity:'另一个自己',intro:'我开始学陶艺。',opening:'想跟你聊聊这段日子。',character:'我揉泥。',scenes:[{time:'2025年4月',title:'开始',text:'我慢慢揉泥。'},{time:'2025年5月',title:'期间',text:'我修了碗口。'},{time:'2025年6月',title:'后来',text}]});
test('literal current-age forms from real failure and related wording are detected',()=>{
 for(const text of ['我坐下写信，三十岁的人了，不想说大话。','我今年三十。','我都三十了。','我已经三十岁。','我现在三十岁。'])assert.ok(ageFactIssues(make(text),b).some(x=>x.field==='scenes.2.text'),text);
});
test('correct age and absent age need no repair',()=>{for(const text of ['我坐下写信，三十五岁的人了。','我今年三十五。','我都三十五了。','我收了工具。'])assert.deepEqual(ageFactIssues(make(text),b),[],text);});
test('other people, direct speech, old memories and future hypotheticals remain separate',()=>{
 for(const text of ['老师三十岁的人了，他继续揉泥。','我看着老师，三十岁的人了，他继续揉泥。','我说：“我都三十了。”','我想起以前，我都三十了，才第一次出门。','我想起以前。那时我三十岁。','如果我今年三十，会不会不同。','我三十岁那年去过海边。'])assert.deepEqual(ageFactIssues(make(text),b),[],text);
});
test('safe event-age slots are filled without mutating input or touching other chapters',()=>{
 const s=make('我当时'+AGE_SLOT+'岁，坐下收工具。'),before=structuredClone(s),out=fillAgeSlots(s,b);assert.match(out.story.scenes[2].text,/35岁/);assert.equal(out.filled.length,1);assert.deepEqual(s,before);assert.deepEqual(out.story.scenes.slice(0,2),s.scenes.slice(0,2));assert.deepEqual(ageSlotIssues(out.story),[]);
});
test('unknown or ambiguous age never picks a birthday or invents a number',()=>{
 for(const x of [{...b,forkAge:''},{...b,birthYear:'',forkAge:''},{...b,forkAge:'20'}]){const s=make('我当时'+AGE_SLOT+'岁。');assert.equal(fillAgeSlots(s,x).filled.length,0);assert.ok(ageSlotIssues(fillAgeSlots(s,x).story).length);}
});
test('past, future, other actors and later years cannot consume the event slot',()=>{
 for(const text of ['我想起以前，我当时'+AGE_SLOT+'岁。','如果我当时'+AGE_SLOT+'岁。','老师说：“我当时'+AGE_SLOT+'岁。”','老师当时'+AGE_SLOT+'岁。','2020年我当时'+AGE_SLOT+'岁。','我明年'+AGE_SLOT+'岁。'])assert.equal(fillAgeSlots(make(text),b).filled.length,0,text);
 const s=make('我现在'+AGE_SLOT+'岁。');s.scenes[2].time='2030年6月';assert.equal(fillAgeSlots(s,b).filled.length,0);
});
test('lower birthday-range age is not forced into a later month',()=>{
 const s=make('我当时'+AGE_SLOT+'岁。');assert.equal(fillAgeSlots(s,{...b,forkAge:'34'}).filled.length,0);s.scenes[2].time='2025年4月';assert.equal(fillAgeSlots(s,{...b,forkAge:'34'}).filled.length,1);
});
test('unrecognised age slots fail closed rather than reaching displayed story',()=>{const s=make('我{{AGE_OTHER}}岁。');assert.ok(ageSlotIssues(s).length);});
test('actual failed D19 age receives one chapter repair plan',()=>{const s=make('我坐下写这封信，三十岁的人了。'),c=compileSetting(b);c.originalInput=b;assert.deepEqual(fieldRepairPlan(s,ageFactIssues(s,b),c).fields,['chapter3.text']);});
test('program fills initial and repair slots, preserves other chapters, shares call budget',async()=>{
 const c=compileSetting(b);c.originalInput=b;const bad=make('我坐下写这封信，三十岁的人了。');let calls=0;
 const result=await chooseStoryPool({caller:{call:async(t,m,o)=>{calls++;if(calls===1)return {result:bad};assert.deepEqual(o.repairFields,['chapter3.text']);return {result:{kind:'story',chapter3:{text:'我当时'+AGE_SLOT+'岁，坐下写这封信。'}}};}},messages:storyMessages(b,'',false,c),background:b,effectiveSetting:c});
 assert.equal(calls,2);assert.match(result.result.scenes[2].text,/35岁/);assert.deepEqual(result.result.scenes.slice(0,2),bad.scenes.slice(0,2));
});
test('unresolved slot never passes the generation delivery gate',async()=>{
 const c=compileSetting(b);c.originalInput=b;let calls=0;await assert.rejects(chooseStoryPool({caller:{call:async()=>{calls++;return {result:make('老师当时'+AGE_SLOT+'岁。')};}},messages:storyMessages(b,'',false,c),background:b,effectiveSetting:c}),e=>e.category==='setting_not_met');assert.equal(calls,4);
});

test('a recollection spanning sentences cannot consume the current node slot',()=>{const s=make('我想起小时候。那时我当时'+AGE_SLOT+'岁。');assert.equal(fillAgeSlots(s,b).filled.length,0);});
test('slot in chapter title or time is rejected rather than shown',()=>{for(const key of ['title','time']){const s=make();s.scenes[2][key]=AGE_SLOT;assert.ok(ageSlotIssues(s).length);}});
test('initial generation slot is resolved before metadata and delivery checks',async()=>{const c=compileSetting(b);c.originalInput=b;const s=make('我当时'+AGE_SLOT+'岁，收好工具。');let calls=0;const r=await chooseStoryPool({caller:{call:async()=>{calls++;return {result:s};}},messages:storyMessages(b,'',false,c),background:b,effectiveSetting:c});assert.equal(calls,1);assert.match(r.result.scenes[2].text,/35岁/);assert.ok(!JSON.stringify(r.result).includes(AGE_SLOT));});
