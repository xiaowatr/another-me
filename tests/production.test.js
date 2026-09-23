import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createGuard} from '../server/production.js';
import {setTimeout as sleep} from 'node:timers/promises';
test('rate budget resets, counts retries, separates acknowledgement from model calls',()=>{let time=0;const g=createGuard({now:()=>time,modelLimit:2});assert.ok(g.accept('a','/api/story'));assert.ok(g.accept('a','/api/chat/stream'));assert.ok(!g.accept('b','/api/story'));assert.ok(g.accept('a','/api/chat/seen'));time=60000;assert.ok(g.accept('a','/api/story'));});
test('production serves built SPA and API without Vite, protects files, streams demo and rejects excessive input',async()=>{
 const port=5199,origin=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['server/index.js','--production'],{env:{...process.env,NODE_ENV:'production',PORT:String(port),APP_ORIGIN:origin,MINIMAX_API_KEY:''},stdio:'ignore'});
 try{
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(origin+'/healthz')).ok){ready=true;break;}}catch{}await sleep(50);}assert.ok(ready);
 assert.deepEqual(await (await fetch(origin+'/healthz')).json(),{ok:true});
 for(const route of ['/','/stories/example']){const r=await fetch(origin+route);assert.equal(r.status,200);assert.match(await r.text(),/assets\/index-/);}
 for(const route of ['/.env','/.git/config','/server/core.js','/tests/production.test.js','/api/usage','/api/stop','/missing.js'])assert.equal((await fetch(origin+route)).status,404,route);
 const post=(route,body,customOrigin=origin)=>fetch(origin+route,{method:'POST',headers:{origin:customOrigin,'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await post('/api/story',{},'https://untrusted.example')).status,403);
 assert.equal((await post('/api/story',{junk:'a'.repeat(200001)})).status,413);
 const background={inputVersion:'6',realityOutcome:'当时选择了学习绘画。',hypotheticalDirection:'尝试学习音乐。',details:''};
 const response=await post('/api/story',{background,clarificationSkipped:true});assert.equal(response.status,200);const story=await response.json();assert.equal(story.mode,'demo');assert.ok(story.sessionId);
 const r=await post('/api/chat/stream',{sessionId:story.sessionId,message:'你好'});assert.match(r.headers.get('content-type'),/ndjson/);assert.equal(r.headers.get('x-accel-buffering'),'no');const text=await r.text();assert.match(text,/"type":"text"/);assert.match(text,/"type":"done"/);
 const tooLong=await post('/api/chat/stream',{sessionId:story.sessionId,message:'字'.repeat(2001)});assert.match(await tooLong.text(),/"category":"input"/);
 }finally{child.kill();await new Promise(resolve=>{child.once('exit',resolve);setTimeout(resolve,1500);});}
});
