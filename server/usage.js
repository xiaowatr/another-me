import fs from 'node:fs';
export const DEVELOPMENT_GROUP='iteration-2026-09-23-v12';
export const PRICING={model:'MiniMax-M2.5',site:'cn',input:2.1,output:8.4,cacheRead:0.21,checked:'2026-09-23',source:'https://platform.minimax.cn/docs/guides/pricing-paygo'};
const number=n=>Number.isSafeInteger(n)&&n>=0?n:null;
export function captureUsage(record,usage){
 if(!usage || typeof usage!=='object')return;
 record.usageSource='provider';
 for(const [local,key] of [['inputTokens','prompt_tokens'],['outputTokens','completion_tokens'],['totalTokens','total_tokens']])if(number(usage[key])!==null)record[local]=usage[key];
 if(number(usage.prompt_tokens_details?.cached_tokens)!==null)record.cachedTokens=usage.prompt_tokens_details.cached_tokens;
 // Only numeric usage fields, never response content or arbitrary metadata.
 const safe={};for(const [key,value] of Object.entries(usage)){
  if(number(value)!==null)safe[key]=value;
  else if(value && typeof value==='object' && !Array.isArray(value))safe[key]=Object.fromEntries(Object.entries(value).filter(([,v])=>number(v)!==null));
 }
 record.usage={...record.usage,...safe};
}
export function estimate(record){
 if(record.site!=='cn'||record.model!==PRICING.model||number(record.inputTokens)===null||number(record.outputTokens)===null)return null;
 const cached=number(record.cachedTokens);
 if(cached!==null && cached>record.inputTokens)return null;
 // Automatic OpenAI-compatible cache reads are included in prompt_tokens, not extra input.
 const maximum=(record.inputTokens*PRICING.input+record.outputTokens*PRICING.output)/1e6;
 const minimum=((cached??record.inputTokens)*PRICING.cacheRead+(cached===null?0:record.inputTokens-cached)*PRICING.input+record.outputTokens*PRICING.output)/1e6;
 return {min:minimum,max:cached===null?maximum:minimum,basis:cached===null?'缓存字段未知，按全命中至未命中给出估算区间':'按接口返回的缓存命中计算估算',pricing:PRICING};
}
export function summarize(records){
 const sent=records.filter(r=>r.sent===true);
 const sum={requests:sent.length,unknownUsage:0,knownInput:0,knownOutput:0,knownTotal:0,unknownInput:0,unknownOutput:0,unknownTotal:0,estimatedMin:0,estimatedMax:0,unpriced:0};
 for(const r of sent){
  for(const [key,total,unknown] of [['inputTokens','knownInput','unknownInput'],['outputTokens','knownOutput','unknownOutput'],['totalTokens','knownTotal','unknownTotal']]){if(number(r[key])===null)sum[unknown]++;else sum[total]+=r[key];}
  if(number(r.inputTokens)===null||number(r.outputTokens)===null||number(r.totalTokens)===null)sum.unknownUsage++;
  const cost=estimate(r);if(cost){sum.estimatedMin+=cost.min;sum.estimatedMax+=cost.max;}else sum.unpriced++;
 }
 return sum;
}
export function usageReport(directory='.local'){
 const file=directory+'/requests.jsonl',unique=new Map();let unreadable=0;
 if(fs.existsSync(file))for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean)){
  try{const r=JSON.parse(line);if(typeof r.requestId!=='string')throw Error();unique.set(r.requestId,{...unique.get(r.requestId),...r});}catch{unreadable++;}
 }
 const outcomes=new Map();const timings=directory+'/timings.jsonl';if(fs.existsSync(timings))for(const line of fs.readFileSync(timings,'utf8').split(/\r?\n/).filter(Boolean)){try{const t=JSON.parse(line);outcomes.set(t.requestId,t.outcome);}catch{}}
 const records=[...unique.values()].map(r=>{
  const clean={};for(const key of ['requestId','time','task','model','site','promptVersion','durationMs','success','errorCategory','sent','auditGroup','status','usageSource'])clean[key]=r[key]??null;
  for(const k of ['inputTokens','outputTokens','totalTokens','cachedTokens'])clean[k]=number(r[k]);
  clean.status=r.status==='pending'?'unfinished':r.status || (r.success?'success':r.errorCategory==='stopped'?'interrupted':'failed');
  if(outcomes.get(r.requestId)==='stopped')clean.status='interrupted';
  clean.estimate=estimate(clean);return clean;
 }).sort((a,b)=>(b.time||'').localeCompare(a.time||''));
 return {records,summary:summarize(records),development:summarize(records.filter(r=>r.auditGroup===DEVELOPMENT_GROUP)),developmentGroup:DEVELOPMENT_GROUP,unreadable,pricing:PRICING,balance:null,actualCharge:null};
}
