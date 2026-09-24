import { usageReport } from './usage.js';
import { randomBytes } from 'node:crypto';
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
    if(production && ['/api/usage','/api/stop'].includes(pathname))return json(res,404,{error:'接口不存在。'});
    if(production && !guard.accept(req.socket.remoteAddress || 'unknown',pathname)){res.setHeader('Retry-After','60');return json(res,429,{category:'rate_limit',error:'请求较频繁，请稍后再试。'});}
    try {
      if (req.method === 'POST' && pathname === '/api/stop') {
        if (req.headers['x-stop-token'] !== stopToken) throw new AppError('forbidden', 403);
        json(res, 200, {stopped:true}); setTimeout(stop, 100); return;
      }
      if (req.method === 'GET' && pathname === '/api/status') return json(res, 200, app.status());
      if (req.method === 'GET' && pathname === '/api/usage') return json(res,200,usageReport());
      if (req.method !== 'POST') return json(res, 404, { error: '接口不存在。' });
      if ((production ? req.headers.origin !== publicOrigin : req.headers.origin !== `http://${req.headers.host}`) || !req.headers['content-type']?.startsWith('application/json')) throw new AppError('forbidden', 403);
      const input = await readBody(req);
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('input');
      if(pathname === '/api/session/restore')return json(res,200,app.restore(input));
      if (pathname === '/api/story') return json(res, 200, await app.story(input));
      if(pathname==='/api/timing'){
        if(!/^[a-f0-9-]{36}$/.test(input.requestId || ''))throw new AppError('input');
        const record={requestId:input.requestId,time:new Date().toISOString(),source:'browser',outcome:['success','failed','stopped'].includes(input.outcome)?input.outcome:'unknown'};
        for(const key of ['firstBodyMs','firstShownMs','completeMs','displayCompleteMs'])record[key]=Number.isFinite(input[key])&&input[key]>=0&&input[key]<3600000?input[key]:null;
        fs.appendFileSync('.local/timings.jsonl',JSON.stringify(record)+'\n');return json(res,200,{ok:true});
      }
      if (pathname === '/api/chat/seen') return json(res,200,app.seen(input));
      if (pathname === '/api/chat/stream') {
        const controller=new AbortController();res.on('close',()=>controller.abort());
        res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Content-Type-Options':'nosniff','X-Accel-Buffering':'no'});res.flushHeaders();
        const emit=data=>{if(!res.destroyed)res.write(JSON.stringify(data)+'\n');};
        try{await app.chatStream(input,emit,controller.signal);}catch(e){emit({type:'error',error:errorMessages[e.category] || '回复中断，请手动重试。',category:e.category || 'network'});}finally{res.end();}return;
      }
      // All production chat uses the streaming route and explicit confirmed memories.
      return json(res, 404, { error: '接口不存在。' });
    } catch (e) { const category = e instanceof AppError ? e.category : 'upstream'; return json(res, e instanceof AppError ? e.status : 500, { error: errorMessages[category] || '请求失败，请稍后重试。', category, requestId: e.requestId }); }
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




