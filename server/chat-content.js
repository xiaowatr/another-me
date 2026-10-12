// Conservative completed plain-text fallback. Protocol text is never displayed.
// This produces no memory operations and must be reported as degraded memory.
export function plainChatContent(content){
 if(typeof content!=='string')return null;
 const text=content.trim();
 if(!text||text.length>6000||/^[{\["]/.test(text)||/[<>]|```|\]<\]minimax\[>\[|"(?:reply|memoryOperations)"\s*:/.test(text)||/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)||/[\uD800-\uDBFF]$/.test(text))return null;
 return text;
}
