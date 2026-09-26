import fs from 'node:fs';
import path from 'node:path';
// Deliberately do not trust caller-supplied forwarding headers. Shared proxy clients
// share a bucket; the global bucket is the hard spending-rate ceiling for one process.
export function createGuard({now=Date.now,modelLimit=20,apiLimit=600,peerLimit=480}={}){
 const buckets=new Map();let minute=-1,total=0,models=0;
 return {accept(peer,route){const m=Math.floor(now()/60000);if(m!==minute){minute=m;total=0;models=0;buckets.clear();}
 const count=(buckets.get(peer)||0)+1;buckets.set(peer,count);total++;
 if(count>peerLimit||total>apiLimit)return false;
 if(['/api/story','/api/chat/stream','/api/memory/extract','/api/questions'].includes(route)&&++models>modelLimit)return false;
 return true;}};
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
export function serveStatic(req,res,pathname,dist){
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 let decoded;try{decoded=decodeURIComponent(pathname);}catch{res.writeHead(400);return res.end();}
 if(decoded.includes('\\')||decoded.split('/').some(p=>p.startsWith('.'))){res.writeHead(404);return res.end();}
 let file=path.resolve(dist,'.'+decoded);if(!file.startsWith(path.resolve(dist)+path.sep)&&file!==path.resolve(dist)){res.writeHead(404);return res.end();}
 if(!fs.existsSync(file)||!fs.statSync(file).isFile()){
 if(path.extname(decoded)){res.writeHead(404);return res.end();}file=path.join(dist,'index.html');}
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':file.endsWith('index.html')?'no-cache':'public, max-age=3600'});
 if(req.method==='HEAD')return res.end();fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
}
