import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createCaller} from '../server/minimax.js';import {callChatWithRetry} from '../server/chat-retry.js';import {AppError} from '../server/core.js';
const cfg={mode:'real',model:'offline',base:'https://offline.invalid',site:'cn',key:'private'};
const raw=code=>new TypeError('fetch failed',{cause:Object.assign(new Error(),{code})});
const connect=()=>new AppError('timeout',502,{stage:'transport',retryable:true,retryableBeforeResponse:true,reason:'transport_timeout'});
const protocol=()=>new AppError('invalid_response',502,{stage:'parse',reason:'chat_envelope'});
test('actual caller connection timeout recovers within two linked attempts, never exposing a failed reply',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'am177-'));let calls=0;const logs=[],text=[],waits=[];
 try{const caller=createCaller(cfg,{directory,log:l=>logs.push(JSON.parse(l)),fetchImpl:async()=>{if(++calls===1)throw raw('UND_ERR_CONNECT_TIMEOUT');return new Response('data: '+JSON.stringify({choices:[{delta:{content:'慢慢聊。'},finish_reason:'stop'}]})+'\n\n',{headers:{'Content-Type':'text/event-stream'}});}});
 await callChatWithRetry(caller,[],{chatOperationId:'one-turn',onText:t=>text.push(t)},{sleep:async ms=>waits.push(ms)});
 assert.equal(calls,2);assert.deepEqual(waits,[500]);assert.equal(text.join(''),'慢慢聊。');const done=logs.filter(x=>x.status!=='pending');assert.deepEqual(done.map(x=>x.attempt),[1,2]);assert.equal(done[0].retryableBeforeResponse,true);assert.equal(done[1].parentRequestId,done[0].requestId);assert.equal(done[1].operationId,'one-turn');
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('only the known pre-header chat connect timeout earns the recovery flag',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'am177-causes-'));
 try{for(const task of ['chat','questions'])for(const code of ['UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','ECONNRESET','ENOTFOUND','CERT_HAS_EXPIRED']){
 const caller=createCaller(cfg,{directory,log:()=>{},fetchImpl:async()=>{throw raw(code)}});
 await assert.rejects(caller.call(task,[],{onText:()=>{}}),e=>Boolean(e.diagnostic?.retryableBeforeResponse)===(task==='chat'&&code==='UND_ERR_CONNECT_TIMEOUT'));
 }}finally{fs.rmSync(directory,{recursive:true,force:true});}
});
test('transport and protocol recovery share a total two-call limit',async()=>{
 for(const errors of [[connect(),connect()],[connect(),protocol()],[protocol(),connect()]]){let calls=0;await assert.rejects(callChatWithRetry({call:async()=>{throw errors[calls++]}},[],{onText:()=>{}},{sleep:async()=>{}}));assert.equal(calls,2);}
});
test('partial reply, cancellation, business error and unqualified timeout never restart',async()=>{
 for(const mode of ['shown','received','abort','business','timeout']){let calls=0;const controller=new AbortController();
 await assert.rejects(callChatWithRetry({call:async(t,m,o)=>{calls++;let e=connect();if(mode==='shown')o.onText('已经收到');if(mode==='received')e.replyReceived=true;if(mode==='abort')controller.abort();if(mode==='business')e=new AppError('background_conflict');if(mode==='timeout')e=new AppError('timeout',502,{stage:'transport',retryable:true});throw e;}},[],{signal:controller.signal,onText:()=>{}},{sleep:async()=>{}}));assert.equal(calls,1,mode);}
 let calls=0;const controller=new AbortController();await assert.rejects(callChatWithRetry({call:async()=>{calls++;throw connect()}},[],{signal:controller.signal,onText:()=>{}},{sleep:async()=>controller.abort()}),e=>e.category==='stopped');assert.equal(calls,1);
});
