import {STORY_MAX_MODEL_CALLS} from '../src/story-budget.js';
import {memoryClientRecord} from './memory-diagnostic.js';
import {createMemoryTasks} from './memory-extraction.js';
import {createStoryTasks} from './story-tasks.js';
import {authenticate,withOwner} from './request-owner.js';
import {makeStoryTrace} from './story-timing.js';
﻿import { usageReport } from './usage.js';
import { randomBytes,randomUUID } from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadEnvFile } from 'node:process';
import { createGuard, serveStatic } from './production.js';
import { loadConfig, AppError, errorMessages } from './core.js';
import { createCaller } from './minimax.js';
import { createExperience } from './experience.js';
const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const production = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
if (!production && fs.existsSync('.env')) { try { loadEnvFile('.env'); } catch { console.error('本地环境配置无法加载，请检查 .env 格式。'); process.exit(1); } }
const config = {...loadConfig(process.env),reviewStories:false};
const caller = createCaller(config);

const app = createExperience(config, caller, record => { try { fs.appendFileSync('.local/requests.jsonl', JSON.stringify(record) + '\n'); } catch { throw new AppError('local_storage', 500); } });
const tasks=createStoryTasks({check:owner=>app.checkAvailable(owner),run:(input,{owner,signal,taskId,parentTaskId,operation,onSetting,rewriteFeedback})=>withOwner(owner,()=>{const headers={};const fake={setHeader:(k,v)=>headers[k]=v,statusCode:200};const trace=makeStoryTrace(fake,taskId,{detached:true,onModelStart:()=>{if(operation.calls>=STORY_MAX_MODEL_CALLS)throw new AppError('retry_exhausted',409);operation.calls++;}});Object.assign(trace.record,{operationId:operation.id,parentTaskId,attempt:operation.attempts,rewriteCount:operation.rewrites});trace.record.ownerTag=owner.slice(0,12);trace.record.taskId=taskId;return trace.run(()=>app.story(input,{signal,onSetting,rewriteFeedback})).catch(e=>{fake.statusCode=e.status||500;throw e;}).finally(()=>{trace.record.cumulativeCallCount=operation.calls;trace.complete();});})});
const memoryTasks=createMemoryTasks({instanceId:tasks.instanceId,run:(data,batchId)=>app.memory(data,batchId)});
const port = Number(process.env.PORT || 5173);
const publicOrigin = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
const guard = createGuard();
const stopToken = randomBytes(32).toString('hex');
const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
const vite = production ? null : await (await import('vite')).createServer({ configFile: false, root, envDir: path.join(root, '.local/empty-vite-env'), server: { middlewareMode: true, hmr: { host: '127.0.0.1', port: 5175 }, host: '127.0.0.1', fs: { strict: true, allow: [root], deny: ['.env', '.env.*', '**/.git/**', '**/.local/**', '**/server/**', '**/tests/**', '*.pem', '*.crt'] } }, appType: 'spa' });
function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); }
async function readBody(req) { let size = 0, chunks = []; for await (const chunk of req) { size += chunk.length; if (size > 200000) throw new AppError('input', 413); chunks.push(chunk); } try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AppError('input'); } }
if(production && !fs.existsSync(path.join(root,'dist/index.html')))throw new Error('请先执行 npm run build。');
const server = http.createServer(async (req, res) => {
  if (!production && !allowedHosts.has(req.headers.host)) return json(res, 403, { error: '不支持的访问地址。' });
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  if (pathname === '/healthz' && req.method === 'GET') return json(res,200,{ok:true});
  if (pathname.startsWith('/api/')) {
    const requestId=/^[a-f0-9-]{36}$/.test(req.headers['x-client-trace-id']||'')?req.headers['x-client-trace-id']:randomUUID();const receivedAt=Date.now();res.setHeader('X-Trace-Id',requestId);
    if(production && ['/api/usage','/api/stop'].includes(pathname))return json(res,404,{error:'接口不存在。'});
    if(production && !guard.accept(req.socket.remoteAddress || 'unknown',pathname)){res.setHeader('Retry-After','60');return json(res,429,{category:'rate_limit',error:'请求较频繁，请稍后再试。'});}
    try {
      if (req.method === 'POST' && pathname === '/api/stop') {
        if (req.headers['x-stop-token'] !== stopToken) throw new AppError('forbidden', 403);
        json(res, 200, {stopped:true}); setTimeout(stop, 100); return;
      }
      if (req.method === 'GET' && pathname === '/api/status') return json(res, 200, {...app.status(),instanceId:tasks.instanceId});
      if (req.method === 'GET' && pathname === '/api/usage') return json(res,200,usageReport());
      const owner=authenticate(req);
      if(req.method==='GET'&&pathname==='/api/availability')return json(res,200,withOwner(owner,()=>app.availability()));
      const taskMatch=pathname.match(/^\/api\/story\/tasks\/([a-f0-9-]{36})(\/cancel)?$/);
      if(req.method==='GET'&&taskMatch&&!taskMatch[2])return json(res,200,tasks.get(owner,taskMatch[1]));
      if (req.method !== 'POST') return json(res, 404, { error: '接口不存在。' });
      if ((production ? req.headers.origin !== publicOrigin : req.headers.origin !== `http://${req.headers.host}`) || !req.headers['content-type']?.startsWith('application/json')) throw new AppError('forbidden', 403);
      const input = await readBody(req);
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('input');
      if(taskMatch&&taskMatch[2])return json(res,200,tasks.cancel(owner,taskMatch[1]));
      if(pathname==='/api/memory/diagnostic'){const record=memoryClientRecord(input,requestId);if(!record)throw new AppError('input');if(process.env.REQUEST_DIAGNOSTICS!=='0')console.info(JSON.stringify(record));return json(res,200,{ok:true});}
      if(pathname==='/api/memory/extract'){
        const log=record=>{if(process.env.REQUEST_DIAGNOSTICS!=='0')console.info(JSON.stringify({type:'memory_request_diagnostic',task:'memory',requestId,codeVersion:app.status().version,...record}));};
        log({stage:'received',batchId:/^[a-f0-9-]{36}$/.test(input.batchId||'')?input.batchId:null});
        try{const result=await withOwner(owner,()=>memoryTasks.submit(owner,input));log({stage:'returned',operations:result.operations.length,summary:result.summary||null,modelRequestId:result.requestId||null,durationMs:Date.now()-receivedAt});return json(res,200,result);}
        catch(e){log({stage:'failed',category:e.category||'upstream',durationMs:Date.now()-receivedAt});throw e;}
      }
      if(pathname === '/api/session/restore')return json(res,200,withOwner(owner,()=>app.restore(input)));
      if(pathname==='/api/questions')return json(res,200,await withOwner(owner,()=>app.questions(input)));
      if (pathname === '/api/story') return json(res,202,tasks.submit(owner,input));
      if(pathname==='/api/timing'){
        if(!/^[a-f0-9-]{36}$/.test(input.requestId || ''))throw new AppError('input');
        const record={clientStartedAt:/^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(input.startedAt||'')?input.startedAt:null,task:input.task==='story'?'story':'chat',clientTraceId:/^[a-f0-9-]{36}$/.test(input.clientTraceId||'')?input.clientTraceId:null,requestId:input.requestId,time:new Date().toISOString(),source:'browser',outcome:['success','failed','stopped','clarification','received','shown'].includes(input.outcome)?input.outcome:'unknown'};
        for(const key of ['firstBodyMs','firstShownMs','completeMs','displayCompleteMs','responseReceivedMs','jsonParsedMs','recoveryWaitMs'])record[key]=Number.isFinite(input[key])&&input[key]>=0&&input[key]<3600000?input[key]:null;
        record.failureStage=['restore','stream','seen'].includes(input.failureStage)?input.failureStage:null;record.recovered=input.recovered===true;record.aborted=input.aborted===true;record.errorCategory=['network','timeout','output_limit','invalid_response','background_conflict','capacity','busy','task_missing','task_expired','retry_exhausted'].includes(input.errorCategory)?input.errorCategory:null;
        fs.appendFileSync('.local/timings.jsonl',JSON.stringify(record)+'\n');if(process.env.REQUEST_DIAGNOSTICS!=='0')console.info(JSON.stringify({type:'browser_timing',...record}));return json(res,200,{ok:true});
      }
      if (pathname === '/api/chat/seen') return json(res,200,withOwner(owner,()=>app.seen(input)));
      if (pathname === '/api/chat/stream') {
        const controller=new AbortController();res.on('close',()=>controller.abort());
        res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Content-Type-Options':'nosniff','X-Accel-Buffering':'no'});res.flushHeaders();
        let streamId=/^[a-f0-9-]{36}$/.test(req.headers['x-client-trace-id']||'')?req.headers['x-client-trace-id']:null;const emit=data=>{if(data.requestId)streamId=data.requestId;if(data.type==='error'&&!data.requestId)data={...data,requestId:streamId};if(!res.destroyed)res.write(JSON.stringify(data)+'\n');};
        try{await withOwner(owner,()=>app.chatStream(input,emit,controller.signal));}catch(e){if(process.env.REQUEST_DIAGNOSTICS!=='0')console.info(JSON.stringify({type:'chat_request_error',requestId:e.requestId||streamId,category:e.category||'network',stage:e.diagnostic?.stage||'stream',reason:e.diagnostic?.reason||null,durationMs:Date.now()-receivedAt,codeVersion:app.status().version}));emit({type:'error',error:errorMessages[e.category] || '回复中断，请手动重试。',category:e.category || 'network',requestId:e.requestId});}finally{res.end();}return;
      }
      // All production chat uses the streaming route and explicit confirmed memories.
      return json(res, 404, { error: '接口不存在。' });
    } catch (e) { const category = e instanceof AppError ? e.category : 'upstream';e.requestId||=requestId;if(process.env.REQUEST_DIAGNOSTICS!=='0')console.info(JSON.stringify({type:'api_error',requestId,route:pathname.replace(/tasks\/[a-f0-9-]+/,'tasks/:id'),category,durationMs:Date.now()-receivedAt,codeVersion:app.status().version})); return json(res, e instanceof AppError ? e.status : 500, { error: errorMessages[category] || '请求失败，请稍后重试。', category, requestId: e.requestId,...(e.retryableBeforeModel?{retryableBeforeModel:true}:{}) }); }
  }
  // 开发服务器不能向浏览器提供密钥、诊断或服务端源文件。
  let decoded; try { decoded = decodeURIComponent(req.url); } catch { res.writeHead(400); return res.end(); }
  if (/(^|[\/\\])(?:\.env[^\/\\?]*|\.local|\.git|server|tests)(?:[\/\\?]|$)/i.test(decoded)) { res.writeHead(404); return res.end(); }
  if(production)return serveStatic(req,res,pathname,path.join(root,'dist'));
  vite.middlewares(req, res);
});
server.on('error', () => { console.error('无法启动服务，请检查端口及环境配置。'); process.exit(1); });
server.requestTimeout=30000;server.headersTimeout=15000;
server.listen(port, production ? '0.0.0.0' : '127.0.0.1', () => { if(!production)fs.writeFileSync('.local/runtime.json', JSON.stringify({token:stopToken})); console.log(`another me 已启动：http://127.0.0.1:${port}/ （${config.mode === 'demo' ? '未配置密钥：演示模式' : config.mode === 'real' ? '真实模型模式' : '需要检查配置'}）`); });
async function stop() { await vite?.close(); server.close(() => process.exit(0)); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);




