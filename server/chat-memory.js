import {normalizeMemoryResult} from './memory-extraction.js';
export const CHAT_MEMORY_RULE=`本轮在同一次回复中提取现实用户刚明确提供的长期偏好、事实或纠正，无需用户另按整理。只输出JSON，字段顺序为reply、updateType、memoryOperations；reply是自然角色正文，updateType固定none，memoryOperations为0至3项。没有可保存的信息用空数组，不凑数，也不靠正文是否说“记住了”判断。
每项为{kind:"add|update|revoke",subject:"user",type:"reality|preference",timeState:"current|ongoing|past",text:"简短记忆",sourceId:"latestUserSourceId",evidence:"本条用户消息中的连续原话",subjectEvidence:"本条消息中明确属于现实用户的连续原话",needsConfirmation:false}。update/revoke另给confirmedMemories中确切targetId；add不填targetId。已保存同义信息不重复添加；明确纠正对应旧卡片时更新它，只改被纠正部分。past仅用于明确过去事实，不把过去的偏好升级为当前偏好。时间、否定与条件按原话保留。
只用最新用户消息作写入来源，不用角色回复、故事、题目、选项或推测作证。第三人的信息、对角色的提问、假设情节、临时情绪、含糊表达不保存为现实用户事实；归属或更新目标不确定则留空，不猜测。结构化记忆不混进reply，不在角色正文宣称后台已保存。`;
export function normalizeChatMemory(result,session,message,sourceId,turnId){
 if(result.memoryError||Array.isArray(result.memoryOperations)&&result.memoryOperations.length>3)return {sourceId,turnId,operations:[],status:'failed'};
 if(!Array.isArray(result.memoryOperations)||!result.memoryOperations.length)return {sourceId,turnId,operations:[],status:'empty'};
 try{const normalized=normalizeMemoryResult({operations:result.memoryOperations},{lifeId:'chat',messages:[{id:sourceId,text:message}],memories:session.memories||[]},'chat:'+sourceId);return {sourceId,turnId,operations:normalized.operations.filter(o=>!o.needsConfirmation),status:normalized.operations.some(o=>!o.needsConfirmation)?'ready':'empty',summary:normalized.summary};}catch{return {sourceId,turnId,operations:[],status:'failed'};}
}
