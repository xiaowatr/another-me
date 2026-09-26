import test from 'node:test';import assert from 'node:assert/strict';
import {openingAddresseeConflict,OPENING_AUDIENCE} from '../src/participant-identity.js';
import {storyMessages,CORE} from '../server/prompts.js';
import {normalizeMemoryResult} from '../server/memory-extraction.js';
import {memoryInput,acceptMemoryResult} from '../src/model-memory.js';
import {persistLifeChange,readLives} from '../src/life-store.js';
import {demoStory} from '../src/services/demo.js';
const b={birthYear:'2000',forkAge:'22',gender:'不透露',mbti:'unknown',locationText:'南京',realityOutcome:'分手时室友陪过我，我却迁怒了室友。',hypotheticalDirection:'假设我没有迁怒室友，认真感谢她。',details:''};
test('story receives shared core constraints and an explicit audience independent of scene dialogue',()=>{const m=storyMessages(b),p=JSON.parse(m[1].content);assert.ok(m[0].content.includes(CORE));assert.deepEqual(p.openingAudience,OPENING_AUDIENCE);assert.equal(p.identityMap.user.id,'realUser');});
test('direct thanks for a third person support is rejected without rewriting legitimate references',()=>{assert.equal(openingAddresseeConflict('谢谢你半夜安慰我，我一直记得。',b),true);assert.equal(openingAddresseeConflict('室友真的很好，那晚她陪我到半夜。',b),false);assert.equal(openingAddresseeConflict('我对室友说：“谢谢你半夜安慰我。”',b),false);assert.equal(openingAddresseeConflict('谢谢你愿意陪我聊聊。',b),false);});
const make=()=>({id:'past-user',background:b,story:demoStory,memoryRevision:0,memories:[],candidates:[],sessionMeta:{organizedUntil:0},messages:[{id:'u1',role:'user',status:'sent',text:'我和室友一起去过欢乐谷，也一起去苏州旅游过。'}]});
const op={kind:'add',subject:'user',timeState:'past',subjectEvidence:'我和室友',sourceId:'u1',targetId:null,type:'reality',text:'曾与室友一起去欢乐谷和苏州旅行。',evidence:'我和室友一起去过欢乐谷，也一起去苏州旅游过',needsConfirmation:false};
test('user past experience reaches durable memory and refresh, stale edits remain protected',()=>{const l=make(),input=memoryInput(l),job={id:'past-batch',input,expectedRevision:0};l.sessionMeta.memoryJob=job;const result=normalizeMemoryResult({operations:[op],conversationSummary:[{sourceId:'u1',text:op.text}]},input,job.id);assert.equal(result.operations.length,1);const map=new Map(),disk={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};const saved=persistLifeChange(disk,[l],l.id,l.id,l,x=>acceptMemoryResult(x,job,result));assert.equal(saved.okay,true);const fresh=readLives(disk).lives[0];assert.equal(fresh.memories[0].timeState,'past');assert.equal(fresh.memories[0].text,op.text);assert.equal(fresh.sessionMeta.organizedUntil,1);assert.throws(()=>acceptMemoryResult({...fresh,memoryRevision:99},job,result),/stale/);});
test('third person, parallel role, hypothetical and planned claims still do not auto-save',()=>{const input=memoryInput(make());for(const change of [{subject:'other_person'},{subject:'parallel_self'},{timeState:'hypothetical'},{timeState:'plan'},{timeState:'past',type:'preference'}])assert.equal(normalizeMemoryResult({operations:[{...op,...change}]},input,'b').operations.length,0);assert.throws(()=>normalizeMemoryResult({operations:[{...op,sourceId:'assistant'}]},input,'b'));});

import {storyOutputIssues,STORY_OUTPUT_RULE} from '../server/story-output-checks.js';
import {createExperience} from '../server/experience.js';
import {AppError} from '../server/core.js';
import {rewriteFeedback} from '../server/story-rewrite.js';
import {storyWithRetry} from '../src/services/story-retry.js';
test('reject internal explanations and unsupported own gendered roles before presentation',()=>{
 const check=text=>storyOutputIssues({scenes:[{text}]},b).map(x=>x.reason);
 assert.ok(check('我被分到了女低音声部——这里用第三人复述，不指代主角性别。').includes('internal_instruction_in_story'));
 assert.ok(check('我被分到了女低音声部。').includes('unsupported_gendered_role'));assert.ok(check('我被分到了女低声部。').includes('unsupported_gendered_role'));
 for(const text of ['我作为一个女生坐在后排。','老师冲我喊：“小伙子，坐这里。”'])assert.ok(check(text).includes('unprovided_protagonist_gender'));
 for(const text of ['根据系统提示词省略性别。','roleGender为空，因此不写。'])assert.ok(check(text).includes('internal_instruction_in_story'));
 for(const text of ['旁边的女生唱女低音，我跟着钢琴练习。','我听女低音声部唱完。','我负责女低音声部的伴奏。','她对我说：“我是女生，也喜欢踢球。”','我们讨论了一本写性别议题的书。'])assert.deepEqual(check(text),[],text);
 assert.deepEqual(storyOutputIssues({scenes:[{text:'我被分到了女低音声部。'}]},{...b,details:'我一直唱女低音声部。'}),[]);
 assert.deepEqual(storyOutputIssues({scenes:[{text:'我被分到了女低音声部。'}]},{...b,gender:'女'}),[]);
 for(const field of ['title','synopsis','identity','intro','character','opening'])assert.equal(storyOutputIssues({[field]:'此处采用中性描述，避免指代主角性别。'},b)[0].field,field);
 assert.ok(storyMessages(b)[0].content.includes(STORY_OUTPUT_RULE));
});
test('invalid original is not presented or saved; bounded rewrite receives the defect and valid next story succeeds',async()=>{
 const background={birthYear:'2000',forkAge:'25',gender:'不透露',mbti:'unknown',locationText:'南京',realityOutcome:'2025年9月没有报名。',hypotheticalDirection:'假设报名合唱团，只看2025年9月和10月。'};
 const good={kind:'story',title:'第一次练习',identity:'全职工作',intro:'周末参加合唱。',character:'在南京工作，周末唱歌。',opening:'刚唱完这一遍，还想再试试。',scenes:[{time:'2025年9月',title:'到场',text:'我坐下来听大家唱。'},{time:'2025年9月',title:'练习',text:'我跟着钢琴练习。'},{time:'2025年10月',title:'继续',text:'我收好谱子准备回家。'}]};let calls=0,last=null,accepted=0;
 const app=createExperience({mode:'real',model:'mock',reviewStories:false},{call:async(task,m,options)=>{calls++;if(calls===2)assert.equal(JSON.parse(m[1].content).rewriteFeedback.reason,'internal_instruction_in_story');const r=structuredClone(good);if(calls===1)r.scenes[0].text='我被分到了女低音声部——这里用第三人复述，不指代主角性别。';options.validateResult(r);accepted++;return {result:r,requestId:'mock'};}});
 const out=await storyWithRetry(()=>app.story({background,clarificationSkipped:true},{rewriteFeedback:last}),{onFailedAttempt:e=>{assert.equal(e.category,'background_conflict');last=rewriteFeedback(e);}});
 assert.equal(calls,2);assert.equal(accepted,1);assert.ok(!JSON.stringify(out.story).includes('不指代'));assert.equal(last.field,'scenes.0.text');
});

import {inventedOpeningInteraction} from '../server/story-output-checks.js';
test('opening rejects invented shared lessons but allows self events, quotes and future invitations',()=>{
 for(const text of ['这个周末教你做的那款戚风，还记得吗？','上次我带你去过的教室还开着。','咱俩昨天一起去上课。'])assert.equal(inventedOpeningInteraction(text),true,text);
 for(const text of ['我这个周末学了戚风。','下次我教你做的那款蛋糕，可以少放糖。','我没教你做过蛋糕。','我对朋友说：“上次我带你去过的教室还开着。”'])assert.equal(inventedOpeningInteraction(text),false,text);
 assert.equal(storyOutputIssues({opening:'这个周末教你做的那款戚风，还记得吗？'},b)[0].reason,'invented_opening_interaction');
 assert.ok(storyOutputIssues({scenes:[{text:'没说“可能”就说“可能”。'}]},b).some(i=>i.reason==='contradictory_repeated_phrase'));
 assert.deepEqual(storyOutputIssues({scenes:[{text:'没说“不行”就说“可以”。'}]},b),[]);
 const paragraph='我坐在桌边整理今天带来的书，翻到刚才没看完的地方，才发现中间夹着一张收据。我把收据放在旁边，继续读下一页。';assert.ok(storyOutputIssues({scenes:[{text:paragraph+'\n\n'+paragraph}]},b).some(i=>i.reason==='duplicated_story_paragraph'));
});

test('unknown siblings are not invented, third-party family and explicit hypothetical family are allowed',()=>{const check=(text,bg=b)=>storyOutputIssues({scenes:[{text}]},bg);for(const text of ['我妹妹给我发了消息。','我的姐姐也来了。','妹妹给我打了电话。'])assert.ok(check(text).some(i=>i.reason==='unprovided_family_member'),text);for(const text of ['朋友的妹妹来了。','她对我说：“我妹妹刚回来。”','我没有妹妹，也不知道当姐姐是什么感觉。'])assert.ok(!check(text).some(i=>i.reason==='unprovided_family_member'),text);assert.ok(!check('我妹妹刚回来。',{...b,details:'我有一个妹妹。'}).some(i=>i.reason==='unprovided_family_member'));assert.ok(!check('我妹妹刚回来。',{...b,hypotheticalDirection:'假设我有个妹妹。'}).some(i=>i.reason==='unprovided_family_member'));});

test('unknown protagonist gender and company routine rejected without blocking teachers or known work',()=>{const x={...demoStory,kind:'story',character:'我练了一只杯子。',opening:'杯子放在架子上。',intro:'这一次她按了报名。'};assert.ok(storyOutputIssues(x,b).some(x=>x.reason==='unprovided_protagonist_gender'));x.intro='我报了课。';x.scenes=[{time:'2025年9月',title:'练习',text:'我还是每周三从公司那边坐公交过来。'}];assert.ok(storyOutputIssues(x,b).some(x=>x.reason==='unprovided_protagonist_work'));x.scenes[0].text='下周三，刚好不加班。';assert.ok(storyOutputIssues(x,b).some(x=>x.reason==='unprovided_protagonist_work'));assert.ok(!storyOutputIssues(x,{...b,lifeSituation:'全职工作'}).some(x=>x.reason==='unprovided_protagonist_work'));x.scenes[0].text='老师拿来杯子，同学在旁边试画。';assert.ok(!storyOutputIssues(x,b).some(x=>x.reason==='unprovided_protagonist_work'));});
