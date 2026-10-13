export const CHAT_MEMORY_RULE=`直接输出完整的自然聊天正文，不输出JSON、工具调用、字段名或协议说明。本轮不逐条写长期记忆：用户结束交流时由应用另行整理，经用户编辑确认后才保存。当前上下文中的偏好与纠正直接用于回复，无需等待长期保存；不要声称已经长期记住或后台保存。`;
export function normalizeChatMemory(result,session,message,sourceId,turnId){
 return {sourceId,turnId,operations:[],status:'not_requested',protocolStatus:result.chatProtocolError?'degraded':result.chatProtocol==='plain_text'?'plain_text':'structured',...(Number.isInteger(result.legacyOperationsDiscarded)?{legacyOperationsDiscarded:result.legacyOperationsDiscarded}:{})};
}
