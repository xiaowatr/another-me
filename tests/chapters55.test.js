import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseResult} from '../server/core.js';
import {storyTools} from '../server/story-tools.js';
import {storyClock} from '../src/story-clock.js';
import {checkStoryGrounding} from '../server/grounding.js';
import {writeLives,readLives} from '../src/life-store.js';
import {streamingChatMessages} from '../server/prompts.js';
import {createExperience} from '../server/experience.js';
const background={inputVersion:'6',birthYear:'1998',forkAge:'28',gender:'男',realityOutcome:'2026年4月，我没有参加社区读书活动。',hypotheticalDirection:'这次参加社区读书活动。',details:'',locationText:'杭州'};
const raw={kind:'story',title:'周末的书页',synopsis:'从挑书到秋天，我整理好了蓝色目录。',identity:'住在杭州的我',intro:'周末多了一个去处。',character:'喜欢整理书页的我',opening:'蓝色目录刚做好，你想先看哪一页？',scenes:[1,2,3,4].map((n)=>({time:`2026年${n+3}月`,title:`第${n}篇`,text:n===4?'我把蓝色目录放在书架上。':'我翻开一本书，记下喜欢的句子。'}))};
const parse=x=>parseResult(JSON.stringify(x),'story');
test('3-4 chapters accepted; count, empty, type, duplicate and size remain distinct',()=>{
 assert.equal(parse(raw).scenes.length,4);assert.equal(parse({...raw,scenes:raw.scenes.slice(0,3)}).scenes.length,3);
 for(const scenes of [raw.scenes.slice(0,2),[...raw.scenes,raw.scenes[0]]])assert.throws(()=>parse({...raw,scenes}),e=>e.diagnostic.reason==='chapter_count');
 for(const [text,reason] of [[' ','missing_or_empty_chapter'],[42,'invalid_chapter_field'],['字'.repeat(2001),'chapter_body_too_long']])assert.throws(()=>parse({...raw,scenes:raw.scenes.map((s,i)=>i===3?{...s,text}:s)}),e=>e.diagnostic.reason===reason&&e.diagnostic.field==='scenes.3');
 assert.throws(()=>parse({...raw,scenes:raw.scenes.map((s,i)=>i===3?{...s,time:42}:s)}),e=>e.diagnostic.reason==='invalid_chapter_field');
 assert.throws(()=>parseResult(JSON.stringify(raw).replace('"kind":"story"','"kind":"story","kind":"story"'),'story'),e=>e.diagnostic.reason==='duplicate_field');
 assert.equal(parse({...raw,scenes:raw.scenes.map((s,i)=>i===3?{...s,title:''}:s)}).scenes[3].title,'片段4');
 const flat={...raw};delete flat.scenes;raw.scenes.forEach((s,i)=>Object.entries(s).forEach(([k,v])=>flat[`scene_${i+1}_${k}`]=v));assert.equal(parse(flat).scenes[3].text,raw.scenes[3].text);
 assert.equal(storyTools([])[0].function.parameters.properties.scenes.maxItems,4);
});
test('fourth chapter goes through generation, save, restore and actual chat messages',async()=>{
 let calls=0;const app=createExperience({mode:'real',model:'mock',maxConcurrent:3},{call:async(task,msg,options)=>{calls++;const result=parse(raw);options.validateResult(result);return {result,requestId:'mock-four-chapters'};}});
 const result=await app.story({background});assert.equal(calls,1);assert.equal(result.story.scenes.length,4);
 const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 assert.ok(writeLives(storage,{activeId:'test55',lives:[{id:'test55',background,story:result.story,messages:[],memories:[]}]}));
 const life=readLives(storage).lives[0];assert.equal(life.story.scenes[3].text,raw.scenes[3].text);assert.equal(life.story.synopsis,raw.synopsis);assert.equal(life.chatTime.month,7);
 assert.match(JSON.stringify(life.conversationContext.parallelCharacter.storyFacts),/蓝色目录/);
 const restored=app.restore({snapshot:{background,story:life.story,history:[],memories:[]}});assert.ok(restored.sessionId);
 const sent=streamingChatMessages({background,story:life.story,history:[],memories:[]},'蓝色目录放在哪里？','chat');assert.match(sent[1].content,/蓝色目录/);assert.equal(JSON.parse(sent[1].content).lifeContext.chatTime.month,7);
 assert.equal(storyClock(background,life.story).month,7);
 // Existing reading view directly maps every scene, without a separate capped list.
 assert.match(fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8'),/story\.scenes\.map\(/);
});
test('fourth chapter is still content-validated',()=>{const bad={...raw,scenes:raw.scenes.map((s,i)=>i===3?{...s,text:'现在是2026年8月，我整理目录。'}:s)};assert.throws(()=>checkStoryGrounding(parse(bad),background),e=>e.diagnostic.reason==='chapter_body_date_conflict'&&e.diagnostic.field==='scenes.3');});
