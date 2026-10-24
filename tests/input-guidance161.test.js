import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {conflictGuidance,issueGuidance,focusInputField,hardConflictGuidance} from '../src/input-guidance.js';
import {publicInputIssues,recordProgramCheck,safeStoryFailure} from '../server/story-delivery-diagnostics.js';
import {makeStoryTrace} from '../server/story-timing.js';
import {createStoryTasks} from '../server/story-tasks.js';
import {createStoryClient} from '../src/services/story-task-client.js';
import {AppError} from '../server/core.js';
import {chooseStoryPool} from '../server/story-pool.js';
import {storyMessages} from '../server/prompts.js';
import {compileSetting} from '../src/effective-setting.js';
test('input pointers require exact field evidence; confirmations and fabricated quotes cannot blame a form field',()=>{
 const b={realityOutcome:'原来留在原公司。',hypotheticalDirection:'这次接受新工作。'};
 const c={question:'哪次去了哪里？',evidence:[{sourceId:'realityOutcome',text:'留在原公司'},{sourceId:'hypotheticalDirection',text:'不存在的原话'},{sourceId:'confirmation:0',text:'这次接受新工作。'}]};
 assert.deepEqual(conflictGuidance(c,b).map(n=>n.field),['realityOutcome']);assert.match(conflictGuidance(c,b)[0].message,/系统还没理解/);
 assert.deepEqual(hardConflictGuidance([{field:'time',question:'时间待核对'}],b).map(n=>n.field),['birthYear','forkAge','realityOutcome']);
});
test('public input guidance only accepts input validation codes and known form fields',()=>{
 const d={stage:'input_validation',issues:[{code:'unresolved_actor_or_choice',fields:['hypotheticalDirection','password'],evidence:'private'},{code:'unsupported_role_career',fields:['realityOutcome']}]};
 const publicRows=publicInputIssues(d);assert.deepEqual(publicRows,[{code:'unresolved_actor_or_choice',fields:['hypotheticalDirection']}]);assert.equal(issueGuidance(publicRows)[0].field,'hypotheticalDirection');assert.deepEqual(publicInputIssues({...d,stage:'story'}),[]);assert.deepEqual(issueGuidance([{code:'capacity',fields:['details']}]),[]);
});
test('field navigation expands ancestors, focuses the right input and never clears its value',()=>{
 const calls=[],details={tagName:'DETAILS',open:false,parentElement:null},el={value:'保留原文',parentElement:details,scrollIntoView:o=>calls.push(['scroll',o.block]),focus:()=>calls.push(['focus'])};
 const root={querySelector:s=>{assert.equal(s,'[name="additionalInfo"]');return el;}};
 assert.equal(focusInputField('additionalInfo',root),true);assert.equal(details.open,true);assert.equal(el.value,'保留原文');assert.deepEqual(calls,[['scroll','center'],['focus']]);assert.equal(focusInputField('unknown',root),false);
});
test('task failure and actual client transport retain safe input issues and operation ID',async()=>{
 const map=new Map(),old=globalThis.localStorage;globalThis.localStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 try{const tasks=createStoryTasks({run:()=>{throw new AppError('input_conflict',422,{stage:'input_validation',issues:[{code:'replacement_target_missing',fields:['realityOutcome'],evidence:'private'}]});}});const id=randomUUID();const client=createStoryClient(async(route,body)=>{if(route==='/api/status')return {instanceId:tasks.instanceId};if(route==='/api/story'){tasks.submit('test',body);return tasks.settled('test',id);}return tasks.get('test',id);},{pause:async()=>{}});
 await assert.rejects(client.get({background:{realityOutcome:'旧设定'}},undefined,id),e=>e.requestId===id&&e.category==='input_conflict'&&e.inputIssues[0].fields[0]==='realityOutcome'&&!JSON.stringify(e.inputIssues).includes('private'));
 }finally{if(old===undefined)delete globalThis.localStorage;else globalThis.localStorage=old;}
});
test('program rejection remains visible even when provider succeeds and a later draft is delivered',async()=>{
 const b={birthYear:'2000',forkAge:'26',gender:'不透露',locationText:'桐城',realityOutcome:'2026年没有去陶艺课。',hypotheticalDirection:'2026年去陶艺课，只看两个月。',details:'每月两次。'},c=compileSetting(b);c.originalInput=b;
 const story=text=>({kind:'story',title:'学陶',identity:'另一个自己',intro:'我开始练习。',character:'我慢慢尝试。',opening:'我收好工具。',scenes:[{time:'2026年',title:'开始',text},{time:'2026年',title:'练习',text:'我把碗放在架子上。'},{time:'2026年',title:'收工',text:'我收好工具。'}]});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'am161-')),trace=makeStoryTrace({setHeader(){},statusCode:200},randomUUID(),{directory:dir,detached:true,emit:()=>{}});let count=0;
 try{const caller={call:async()=>({requestId:'synthetic-'+(++count),result:story(count===1?'两个月，八次课。':'我揉好泥，慢慢练习。')})};const result=await trace.run(()=>chooseStoryPool({caller,messages:storyMessages(b,'',false,c),background:b,effectiveSetting:c}));trace.complete();assert.equal(count,2);assert.equal(result.requestId,'synthetic-2');assert.equal(trace.record.programChecks[0].passed,false);assert.ok(trace.record.programChecks[0].issues.some(x=>x.reason==='frequency_conflict'));assert.equal(trace.record.programChecks[1].passed,true);assert.ok(!JSON.stringify(trace.record.programChecks).includes('八次课'));assert.equal(trace.record.programChecks[0].requestId,'synthetic-1');
 }finally{fs.unlinkSync(path.join(dir,'story-timings.jsonl'));fs.rmdirSync(dir);}
});
test('diagnostic output removes private text and untrusted diagnostic properties',()=>{
 assert.deepEqual(safeStoryFailure({category:'input_conflict',diagnostic:{stage:'input_validation',reason:'unresolved_setting',evidence:'private'}}),{category:'input_conflict',stage:'input_validation',reason:'unresolved_setting'});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'am161-safe-')),trace=makeStoryTrace({setHeader(){},statusCode:422},randomUUID(),{directory:dir,detached:true,emit:()=>{}});
 try{trace.run(()=>recordProgramCheck({requestId:'synthetic',sequence:0,attemptKind:'generation',issues:[{field:'private user prose',reason:'private user prose',proof:'private'}]}));trace.complete();assert.deepEqual(trace.record.programChecks[0].issues,[{field:null,reason:'program_check_failed'}]);}finally{fs.unlinkSync(path.join(dir,'story-timings.jsonl'));fs.rmdirSync(dir);}
});
