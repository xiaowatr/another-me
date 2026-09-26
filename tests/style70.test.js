import test from 'node:test';
import assert from 'node:assert/strict';
import {storyMessages,chatMessages,streamingChatMessages} from '../server/prompts.js';
import {EXPRESSION_RULES,STORY_EXPRESSION,CHAT_EXPRESSION} from '../server/writing-style.js';
import {compileSetting,generationSetting} from '../src/effective-setting.js';
import {demoStory} from '../src/services/demo.js';
const inputs=[{birthYear:'2000',forkAge:'25',realityOutcome:'2025年9月我停了陶艺练习。',hypotheticalDirection:'如果继续练陶艺，只看9月和10月。'},{birthYear:'2000',forkAge:'25',realityOutcome:'2025年9月我继续每天到办公室工作。',hypotheticalDirection:'如果改为每周两天远程工作，只看9月和10月。'}];
test('two story requests carry reference excerpts and raw expression clues without changing effective setting',()=>{
 for(const background of inputs){const messages=storyMessages(background),data=JSON.parse(messages[1].content);
  assert.ok(messages[0].content.includes(EXPRESSION_RULES));assert.ok(messages[0].content.includes(STORY_EXPRESSION));
  assert.deepEqual(data.effectiveSetting,generationSetting(compileSetting(background)));
  assert.deepEqual(data.writingReference.examples.map(e=>e.id),['S01','S02']);
  assert.ok(data.userExpressionSamples.initial.includes(background.realityOutcome));
  assert.ok(data.writingReference.examples.every(e=>e.text.length<250));
 }
});
test('six chat situations use identical style in normal and stream paths; examples are not injected as conversation history',()=>{
 const session={background:inputs[0],story:demoStory,memories:[],history:[{role:'user',content:'我今天说话有点急，想直说。'},{role:'assistant',content:'虚构角色口癖，不能当作用户文风。'}]};
 const situations=[['刚才那个小插曲挺逗的。','D03'],['练了好久却没什么进步，我想说说。','D03'],['你理解错了，我没有要放弃。','A15'],['先去忙，回头有空再说。','C10'],['你记得我学了什么吗？','D03'],['请详细讲讲那一次练习。','D03']];
 for(const [message,firstId] of situations){const normal=chatMessages(session,message,'chat'),stream=streamingChatMessages(session,message,'chat'),data=JSON.parse(normal[1].content);
  for(const sent of [normal,stream]){assert.ok(sent[0].content.includes(EXPRESSION_RULES));assert.ok(sent[0].content.includes(CHAT_EXPRESSION));assert.ok(!sent[0].content.includes('日常回复通常约10至180字'));}
  assert.deepEqual(normal.slice(1),stream.slice(1));assert.equal(data.writingReference.examples[0].id,firstId);
  assert.equal(data.writingReference.examples.length,2);assert.ok(data.userExpressionSamples.recent.includes(message));
  assert.ok(!data.userExpressionSamples.recent.some(t=>t.includes('虚构角色口癖')));
  assert.ok(!normal.slice(2).some(m=>data.writingReference.examples.some(e=>m.content===e.text)));
  assert.ok(!data.writingReference.examples.some(e=>/^B0[123]$/.test(e.id)));
 }
});
