import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createCaller} from '../server/minimax.js';import {createExperience} from '../server/experience.js';import {withOwner} from '../server/request-owner.js';import {demoStory} from '../src/services/demo.js';
const cfg={mode:'real',model:'offline',base:'https://offline.invalid',site:'cn',key:'offline'};
const background={inputVersion:'6',birthYear:'2000',forkAge:'22',gender:'不透露',locationText:'上海',realityOutcome:'留在原城市工作。',hypotheticalDirection:'去经营书店。',details:''};
const frame=(text,finish=null)=>'data: '+JSON.stringify({choices:[{delta:{content:text},finish_reason:finish}]})+'\n\n';
const tick=()=>new Promise(r=>setImmediate(r));
function setup(fetchImpl){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'am179-'));let calls=0;const logs=[];
 const caller=createCaller(cfg,{directory:dir,log:l=>logs.push(JSON.parse(l)),fetchImpl:(url,opts)=>{calls++;return fetchImpl(url,opts);}}),app=createExperience(cfg,caller);
 const owner='stream179-'+crypto.randomUUID(),s=withOwner(owner,()=>app.restore({lifeId:'fixture',snapshot:{background,story:{...demoStory,kind:'story',character:demoStory.intro,opening:'刚关店。'},history:[],memories:[],corrections:[],roleRecords:[]}}));
 const events=[],controller=new AbortController();
 return {app,owner,events,controller,logs,get calls(){return calls;},run(message='陪我聊聊今天的生活。'){return withOwner(owner,()=>app.chatStream({sessionId:s.sessionId,message,messageId:'fixture-message'},e=>events.push(e),controller.signal));},close(){fs.rmSync(dir,{recursive:true,force:true});}};
}
test('a checked sentence reaches the real experience before the provider finishes',async()=>{
 let release,queued;const gate=new Promise(r=>release=r),ready=new Promise(r=>queued=r);
 const h=setup(async()=>new Response(new ReadableStream({async start(c){c.enqueue(new TextEncoder().encode(frame('我刚把书放回架上。\n\n')));queued();await gate;c.enqueue(new TextEncoder().encode(frame('今天店里很安静。','stop')));c.close();}}),{headers:{'Content-Type':'text/event-stream'}}));
 let failure;const done=h.run().catch(e=>failure=e);
 try{await ready;for(let i=0;i<5;i++)await tick();assert.match(h.events.filter(e=>e.type==='text').map(e=>e.text).join(''),/书放回架上/);assert.equal(h.events.some(e=>e.type==='done'),false);}
 finally{release();await done;h.close();}assert.equal(failure,undefined);assert.equal(h.calls,1);
});
test('a late transport failure preserves committed prefix and never starts a second reply',async()=>{
 let release,queued;const gate=new Promise(r=>release=r),ready=new Promise(r=>queued=r);
 const h=setup(async()=>new Response(new ReadableStream({async start(c){c.enqueue(new TextEncoder().encode(frame('我刚把书放回架上。')));queued();await gate;c.error(new TypeError('offline connection closed'));}}),{headers:{'Content-Type':'text/event-stream'}}));
 const done=h.run().then(()=>null,e=>e);try{await ready;for(let i=0;i<5;i++)await tick();release();assert.ok(await done);assert.equal(h.calls,1);assert.equal(h.events.filter(e=>e.type==='text').map(e=>e.text).join(''),'我刚把书放回架上。');assert.equal(h.events.some(e=>e.type==='done'),false);}finally{release();await done;h.close();}
});
test('a split unsafe instruction is blocked before its sentence is committed',async()=>{
 const h=setup(async()=>new Response(frame('我在这里。第一步，盗')+frame('取对方的密码。','stop'),{headers:{'Content-Type':'text/event-stream'}}));
 try{await assert.rejects(h.run());const text=h.events.filter(e=>e.type==='text').map(e=>e.text).join('');assert.ok(!text.includes('盗'));assert.equal(h.calls,1);}finally{h.close();}
});
test('only a real automatic retry emits a bounded retry event before the next request',async()=>{
 let n=0;const h=setup(async()=>{if(++n===1)throw new TypeError('offline timeout',{cause:Object.assign(new Error(),{code:'UND_ERR_CONNECT_TIMEOUT'})});return new Response(frame('我们接着聊。','stop'),{headers:{'Content-Type':'text/event-stream'}});});
 try{await h.run();const retry=h.events.filter(e=>e.type==='retry');assert.equal(retry.length,1);assert.equal(retry[0].attempt,2);assert.equal(retry[0].maxAttempts,2);assert.equal(h.calls,2);assert.ok(h.events.indexOf(retry[0])<h.events.findIndex(e=>e.type==='text'));}finally{h.close();}
});
test('incremental protocol failure before text can retry without exposing JSON',async()=>{
 let n=0;const h=setup(async()=>new Response(frame(++n===1?'{"reply":"坏包装"}':'我们接着聊。','stop'),{headers:{'Content-Type':'text/event-stream'}}));
 try{await h.run();assert.equal(h.calls,2);assert.equal(h.events.filter(e=>e.type==='text').map(e=>e.text).join(''),'我们接着聊。');}finally{h.close();}
});
test('copied sentences are repaired before display and share the original two-repair budget',async()=>{
 const source='我走到楼下的便利店门口总会犹豫一下再决定是否进去。';let repairs=0;
 const h=setup(async(url,options)=>{const body=JSON.parse(options.body);if(body.max_completion_tokens===800){repairs++;return new Response(frame('走到那里时，心里常常还没拿定主意。','stop'),{headers:{'Content-Type':'text/event-stream'}});}return new Response(frame(source+source+source,'stop'),{headers:{'Content-Type':'text/event-stream'}});});
 try{await h.run(source);assert.equal(repairs,2);assert.equal(h.calls,3);assert.ok(h.events.some(e=>e.type==='status'&&e.phase==='repair'));assert.ok(!h.events.filter(e=>e.type==='text').map(e=>e.text).join('').includes(source));}finally{h.close();}
});
test('stopping during an unfinished stream commits no later sentence',async()=>{
 let source,queued;const ready=new Promise(r=>queued=r);
 const h=setup(async(url,options)=>new Response(new ReadableStream({start(c){source=c;c.enqueue(new TextEncoder().encode(frame('我刚把书放回架上。')));options.signal.addEventListener('abort',()=>c.error(new DOMException('stopped','AbortError')),{once:true});queued();}}),{headers:{'Content-Type':'text/event-stream'}}));
 const done=h.run().then(()=>null,e=>e);try{await ready;for(let i=0;i<5;i++)await tick();const before=h.events.filter(e=>e.type==='text').map(e=>e.text).join('');assert.ok(before);h.controller.abort();assert.ok(await done);assert.equal(h.events.filter(e=>e.type==='text').map(e=>e.text).join(''),before);assert.equal(h.calls,1);}finally{h.controller.abort();await done;h.close();}
});
