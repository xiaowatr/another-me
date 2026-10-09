import fs from 'node:fs';
import path from 'node:path';
import {redactEvidence} from './diagnostics.js';
// Only failed story/check output is retained. No headers, prompts, reasoning or successful responses.
export function createFailureEvidence(directory,{now=Date.now,ttl=7*86400000,maxFiles=100}={}){
 const root=path.resolve(directory);fs.mkdirSync(root,{recursive:true});
 const prune=()=>{const files=fs.readdirSync(root).filter(n=>/^[a-f0-9-]{36}\.json$/.test(n)).map(name=>{const file=path.resolve(root,name);if(path.dirname(file)!==root)return null;const st=fs.lstatSync(file);return st.isFile()?{file,mtime:st.mtimeMs}:null;}).filter(Boolean).sort((a,b)=>b.mtime-a.mtime);
  for(const [i,f]of files.entries())if(now()-f.mtime>ttl||i>=maxFiles)fs.unlinkSync(f.file);
 };
 prune();const timer=setInterval(()=>{try{prune();}catch{}},3600000);timer.unref?.();
 return {prune,close:()=>clearInterval(timer),save(record,raw,key){
  prune();if(!/^[a-f0-9-]{36}$/.test(record.requestId)||typeof raw!=='string')return;
  let text=redactEvidence(raw,key).replace(/(?<!\d)\d{17}[\dXx](?!\d)/g,'[已隐藏证件号]').replace(/(?:[\u4e00-\u9fff]{2,12}(?:路|街|巷))\d{1,5}号(?:[^，。\n"\\]{0,12})?/g,'[已隐藏详细地址]');
  const limit=32000,data={savedAt:new Date(now()).toISOString(),expiresAt:new Date(now()+ttl).toISOString(),requestId:record.requestId,task:record.task,reason:record.failureReason,length:raw.length,truncated:text.length>limit,output:text.slice(0,limit)};
  fs.writeFileSync(path.join(root,record.requestId+'.json'),JSON.stringify(data),{mode:0o600});prune();
 }};
}
