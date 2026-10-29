import test from 'node:test';import assert from 'node:assert/strict';
import {storyMessages,streamingChatMessages} from '../server/prompts.js';
const variants=[{id:'career',preference:'我重视事业，想把专业做好，不希望被劝成只求安稳。',direction:'在原城市争取一个更有挑战的专业项目。',action:'我想先开始，但不想贸然辞职，能做哪一小步？'},{id:'stability',preference:'我偏爱安稳，想保留现有工作和生活节奏，不想为了成长强迫自己冒险。',direction:'留在现在的岗位，把工作和生活安排得更稳定。',action:'我想先开始，但要保留现在的节奏，能做哪一小步？'},{id:'family',preference:'我看重家庭，已说明有家人，希望把更多时间留给相处，不以升职远行为目标。',direction:'保留原来的工作，调整时间和家人有更多相处。',action:'我想先开始改善相处，但不想替别人做决定，能做哪一小步？'}];
export const preferenceCases=variants;
for(const v of variants)test(v.id+': shared bottom lines and explicit distinct preference reach both production prompts',()=>{
 const b={birthYear:'1992',forkAge:'34',gender:'不透露',locationText:'合成城',realityOutcome:'此前一直按原来的安排生活。',hypotheticalDirection:v.direction,details:v.preference};
 const story=storyMessages(b);const system=story.filter(m=>m.role==='system').map(m=>m.content).join('\n');assert.match(system,/合理的人生偏好不应统一/);assert.match(system,/共同安全、诚实与尊重他人/);assert.ok(story.some(m=>m.content.includes(v.preference)));assert.ok(story.some(m=>m.content.includes(v.direction)));
 const session={background:b,story:{title:'合成片段',intro:'我按自己的偏好安排这一天。',scenes:[{time:'2026年',title:'一天',text:'我把一项安排写在纸上。'}]},history:[],memories:[],corrections:[],roleRecords:[]};
 const chat=streamingChatMessages(session,v.action,'chat'),rules=chat[0].content;assert.match(rules,/合理的人生偏好不应统一/);assert.match(rules,/今天或近期能完成的小行动/);assert.match(rules,/明确只想倾诉、不要建议/);assert.ok(chat.some(m=>m.content.includes(v.preference)));assert.ok(chat.at(-1).content.includes(v.action));
});
