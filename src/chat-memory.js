import {applyMemoryOperations} from './memory-operations.js';
import {reviseMemories} from './memory-review.js';
export function acceptChatMemory(life,packet,{sourceId,sourceText,expectedRevision}){
 if(packet.sourceId!==sourceId||!Array.isArray(packet.operations)||packet.operations.length>3)throw Error('memory_source');
 if((life.sessionMeta?.chatMemorySources||[]).includes(sourceId))return life;
 if((life.memoryRevision||0)!==expectedRevision)throw Error('memory_stale_revision');
 const source=life.messages.find(m=>m.id===sourceId);if(!source||source.role!=='user'||source.text!==sourceText||['failed','stopped'].includes(source.status))throw Error('memory_source');
 for(const op of packet.operations)if(op.sourceId!==sourceId||op.subject!=='user'||op.needsConfirmation!==false||typeof op.evidence!=='string'||!op.evidence||!source.text.includes(op.evidence)||typeof op.subjectEvidence!=='string'||!op.subjectEvidence||!source.text.includes(op.subjectEvidence))throw Error('memory_source');
 const ready={...life,messages:life.messages.map(m=>m.id===sourceId?{...m,status:'sent'}:m)};
 const applied=applyMemoryOperations(ready,{lifeId:life.id,operations:packet.operations});
 const next=reviseMemories({...ready,sessionMeta:applied.sessionMeta},applied.memories);
 return {...next,sessionMeta:{...next.sessionMeta,chatMemorySources:[...(next.sessionMeta.chatMemorySources||[]),sourceId],chatMemoryStatus:packet.status}};
}
