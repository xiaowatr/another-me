import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {fileURLToPath} from 'node:url';
import {takeMessage,takeStreamCharacters,chatDisplayUpdate,applyChatDisplay} from '../src/chat-stream.js';
import {chatRetryText} from '../src/retry-status.js';
test('done does not flush all queued text: actual UI handlers reveal received characters in order',async()=>{
 const source=fs.readFileSync(new URL('../src/main.jsx',import.meta.url),'utf8');
 const a=source.indexOf('  function flushTurn('),b=source.indexOf('  async function stopReply',a),doneLine=source.split('\n').find(l=>l.includes("if(e.type==='done')"));assert.ok(a>0&&b>a&&doneLine);
 const timers=[],acks=[],turn={buffer:'第一句话。\n\n第二句话🙂也慢慢出现。',shown:'',bubbleIds:[],started:0,sessionId:'s',id:'t',messageId:'m',ack:Promise.resolve(),resolveDrain:()=>{turn.drained=true;}};let messages=[];
 const handlers=new Function('t','takeMessage','takeStreamCharacters','chatDisplayUpdate','applyChatDisplay','setMessages','confirmSeen','requestAnimationFrame','setTimeout','clearTimeout',source.slice(a,b)+';return {flushTurn,onEvent(e){'+doneLine+'}};')(turn,takeMessage,takeStreamCharacters,chatDisplayUpdate,applyChatDisplay,fn=>messages=fn(messages),async x=>acks.push(x.text),fn=>fn(),fn=>{timers.push(fn);return timers.length;},()=>{});
 handlers.flushTurn(turn);const first=turn.shown;assert.ok(Array.from(first).length<=4);handlers.onEvent({type:'done',requestId:'r'});assert.equal(turn.shown,first);assert.notEqual(turn.drained,true);
 while(timers.length)timers.shift()();await turn.ack;
 assert.equal(turn.drained,true);assert.equal(messages.map(m=>m.text).join(''),'第一句话。\n\n第二句话🙂也慢慢出现。');assert.equal(messages.length,2);assert.equal(acks.at(-1),turn.shown);assert.ok(acks.length<=2,'short paced reply coalesces prefix acknowledgements');
});
test('retry status is finite and tied to actual events',()=>{
 assert.equal(chatRetryText({}), '');assert.match(chatRetryText({type:'retry',attempt:2,maxAttempts:2}),/2\/2/);assert.equal(chatRetryText({type:'retry',attempt:3,maxAttempts:2}),'');assert.match(chatRetryText({type:'status',phase:'repair'}),/理顺/);
});
