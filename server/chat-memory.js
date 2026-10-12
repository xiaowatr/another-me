import {normalizeMemoryResult} from './memory-extraction.js';
export const CHAT_MEMORY_RULE=`只调用submit_chat一次，字段顺序reply、updateType、memoryOperations。reply自然回应当前消息，updateType固定none，memoryOperations固定空数组。本轮不逐条写长期记忆：用户结束交流时由应用另行整理，经用户编辑确认后才保存。当前上下文中的偏好与纠正直接用于回复，无需等待长期保存；不要声称已经长期记住或后台保存。`;
// A JSON string literal around a quote is formatting, only if its decoded value
// is still an exact substring of this turn's user source. Never rewrite evidence.
function sourceQuote(value,source){if(typeof value!=='string'||source.includes(value))return value;if(!value.startsWith('"')||!value.endsWith('"'))return value;try{const decoded=JSON.parse(value);if(typeof decoded==='string'&&decoded.trim()&&source.includes(decoded))return decoded;}catch{}return value;}
export function normalizeChatMemory(result,session,message,sourceId,turnId){
 if(result.memoryError||Array.isArray(result.memoryOperations)&&result.memoryOperations.length>3)return {sourceId,turnId,operations:[],status:'failed'};
 if(!Array.isArray(result.memoryOperations)||!result.memoryOperations.length)return {sourceId,turnId,operations:[],status:'empty'};
 try{const operations=result.memoryOperations.map(o=>o?.sourceId===sourceId?{...o,evidence:sourceQuote(o.evidence,message),subjectEvidence:sourceQuote(o.subjectEvidence,message)}:o);const normalized=normalizeMemoryResult({operations},{lifeId:'chat',messages:[{id:sourceId,text:message}],memories:session.memories||[]},'chat:'+sourceId);return {sourceId,turnId,operations:normalized.operations.filter(o=>!o.needsConfirmation),status:normalized.operations.some(o=>!o.needsConfirmation)?'ready':'empty',summary:normalized.summary};}catch{return {sourceId,turnId,operations:[],status:'failed'};}
}
