import {CODE_VERSION} from './diagnostics.js';
const stages=new Set(['end_clicked','saved','batch_ready','no_new_messages','pending_message','request_sent','persisted','failed']);
export function memoryClientRecord(input,requestId){
 if(!input||!stages.has(input.stage))return null;
 const r={type:'memory_client_diagnostic',task:'memory',requestId,codeVersion:CODE_VERSION,stage:input.stage};
 for(const k of ['totalMessages','eligibleMessages','start','end','operations','savedMemories','pendingCandidates'])if(Number.isInteger(input[k])&&input[k]>=0&&input[k]<=100000)r[k]=input[k];
 if(['changed','unchanged','confirmation','empty'].includes(input.outcome))r.outcome=input.outcome;
 if(/^[a-f0-9-]{36}$/.test(input.batchId||''))r.batchId=input.batchId;
 if(/^[a-f0-9-]{36}$/.test(input.modelRequestId||''))r.modelRequestId=input.modelRequestId;
 return r;
}
