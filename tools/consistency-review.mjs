// Standalone offline experiment. This file is never imported by the production server.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {loadEnvFile} from 'node:process';
import {loadConfig} from '../server/core.js';
import {strictJson} from '../server/structured-story.js';
import {REVIEW_VERSION,reviewRequest,validateReview} from './consistency-review-contract.mjs';
const args=process.argv.slice(2),arg=k=>args[args.indexOf(k)+1],execute=args.includes('--execute');
if(!args.includes('--input')||!args.includes('--output'))throw Error('Required: --input fixture.json --output NEW_DIRECTORY [--execute --max-calls 3]');
const input=JSON.parse(fs.readFileSync(arg('--input'),'utf8')),samples=input.samples;
if(!Array.isArray(samples)||samples.length<1||samples.length>12)throw Error('Invalid sample count');
const output=path.resolve(arg('--output'));if(fs.existsSync(output))throw Error('Refusing overwrite or accidental repeat');
const batches=Array.from({length:Math.ceil(samples.length/4)},(_,i)=>samples.slice(i*4,i*4+4));
const cap=execute?Number(arg('--max-calls')):0;if(execute&&(!Number.isInteger(cap)||cap<1||cap>3||batches.length>cap))throw Error('Expected explicit cap 1..3, no automatic retries');
const requests=batches.map(reviewRequest),hash=s=>createHash('sha256').update(s).digest('hex');
fs.mkdirSync(output,{recursive:true});
const save=(name,value)=>fs.writeFileSync(path.join(output,name),typeof value==='string'?value:JSON.stringify(value,null,2));
save('plan.json',{review_version:REVIEW_VERSION,mode:execute?'execute':'prepare',input_sha256:hash(fs.readFileSync(arg('--input'))),samples:samples.map(s=>s.sample_id),planned_calls:batches.length,cap,automatic_retries:0,production_integration:false});
for(let i=0;i<requests.length;i++)save(`batch-${i+1}.request.json`,requests[i]);
if(!execute){console.log(JSON.stringify({prepared:true,samples:samples.length,planned_calls:requests.length,actual_calls:0}));process.exit(0);}
if(fs.existsSync('.env'))loadEnvFile('.env');const config=loadConfig(process.env);
if(config.mode!=='real'||config.base!=='https://api.minimax.cn/v1'||config.model!=='MiniMax-M3')throw Error('Model or endpoint differs from approved experiment');
let calls=0;const results=[];
for(let i=0;i<batches.length;i++){
 if(calls>=cap)throw Error('Call cap');calls++;const started=Date.now(),record={batch:i+1,started_at:new Date().toISOString(),model:config.model,destination:config.base,review_version:REVIEW_VERSION,samples:batches[i].map(s=>s.sample_id)};
 save(`batch-${i+1}.started.json`,record);console.log(JSON.stringify({batch:i+1,status:'started',actual_calls:calls}));
 try{
  const response=await fetch(config.base+'/chat/completions',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json'},signal:AbortSignal.timeout(90000),body:JSON.stringify({model:config.model,...requests[i],thinking:{type:'disabled'},reasoning_split:true,temperature:1,max_completion_tokens:3500})});
  const raw=await response.text();save(`batch-${i+1}.response.txt`,raw.split(config.key).join('[REDACTED]'));record.http_status=response.status;
  const body=JSON.parse(raw);record.usage=body.usage||null;record.provider_id=body.id||null;
  if(!response.ok||body.error||Number(body.base_resp?.status_code||0))throw Error('provider_response');
  const choice=body.choices?.[0],tools=choice?.message?.tool_calls;let text;
  if(choice?.finish_reason==='tool_calls'&&Array.isArray(tools)&&tools.length===1&&tools[0]?.function?.name==='report_consistency')text=tools[0].function.arguments;
  else if(choice?.finish_reason==='stop'&&!tools?.length)text=choice?.message?.content;
  else throw Error('transport_shape');
  strictJson(text);const checked=validateReview(JSON.parse(text),batches[i]);save(`batch-${i+1}.judgment.json`,checked);record.protocol_valid=checked.valid;record.model_findings=checked.reviews.reduce((n,r)=>n+r.findings.length,0);
 }catch(e){record.error=['provider_response','transport_shape'].includes(e.message)?e.message:e.name==='TimeoutError'?'timeout':'parse_or_transport_error';}
 record.completed_at=new Date().toISOString();record.duration_ms=Date.now()-started;results.push(record);save(`batch-${i+1}.run.json`,record);
 save('summary.json',{actual_calls:calls,cap,automatic_retries:0,production_integration:false,real_story_generations:0,cost:null,pricing_verified:false,results});console.log(JSON.stringify({batch:i+1,protocol_valid:record.protocol_valid||false,error:record.error||null,duration_ms:record.duration_ms}));
}
console.log(JSON.stringify({done:true,actual_calls:calls,protocol_valid_batches:results.filter(r=>r.protocol_valid).length}));
