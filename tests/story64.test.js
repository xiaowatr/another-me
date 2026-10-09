import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createStoryTasks} from '../server/story-tasks.js';
import {createExperience} from '../server/experience.js';
import {AppError} from '../server/core.js';
import {temporalIssues,timeAnchors} from '../src/input-anchors.js';
import {consumeStoryCall} from '../server/story-stage-budget.js';
import {createStoryClient} from '../src/services/story-task-client.js';
import {makeStoryTrace} from '../server/story-timing.js';


const b={inputVersion:'6',birthYear:'2000',forkAge:'26',realityOutcome:'2026年4月我没有参加活动。',hypotheticalDirection:'如果我参加了，只看2026年5月和6月。'};
test('time validation keeps valid recollection and plans but rejects out-of-window main scene/current body',()=>{
 const issues=(time,text)=>temporalIssues({scenes:[{time,title:'日常',text}]},b,timeAnchors(b));
 assert.equal(issues('2026年5月','想起2026年4月那次评选。计划2026年7月再参加一次。').length,0);
 assert.ok(issues('2026年4月','我来到现场。').some(x=>x.reason==='outside_observation_window'));
 assert.ok(issues('2026年6月','此刻是2026年7月，我来到现场。').some(x=>x.reason==='body_beyond_observation_window'));
 assert.ok(issues('2026年6月','三个月后我已经完成了这项活动。').some(x=>x.reason==='body_beyond_observation_window'));
});
