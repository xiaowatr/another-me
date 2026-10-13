// Completed natural chat text, also used by the legacy fallback.
// Protocol text is never displayed and this produces no memory operations.
export function plainChatContent(content){
 if(typeof content!=='string')return null;
 const text=content.trim();
 if(!text||text.length>6000||/^[{\["]/.test(text)||/[<>]|```|\]<\]minimax\[>\[|"(?:reply|memoryOperations)"\s*:/.test(text)||/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)||/[\uD800-\uDBFF]$/.test(text))return null;
 return text;
}
