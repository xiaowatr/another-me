// Recognize an explicitly first-person non-action, not a general semantic parser.
// Dates/modifiers may organize several clauses; the original text stays intact.
const date=String.raw`(?:\d{4}年(?:\d{1,2}月(?:\d{1,2}[日号])?)?|\d{1,2}月(?:\d{1,2}[日号])?)`;
const prefix=new RegExp(String.raw`^\s*(?:现实中[，,：:\s]*)?(?:(?:${date}(?:[至到—-]${date})?|那年|那时|当时|那次)[，,：:\s]*)?`);
const modifiers=String.raw`(?:(?:原本|本来|之前|以前|一直|当时|那时|那次|其实|曾经|早就|还|也|就)\s*){0,4}`;
const negative=String.raw`(?:没(?:有)?|并未|未曾|未|不曾|不(?!是))[^，,。；！？]+`;
const single=new RegExp(String.raw`^我${modifiers}(${negative})$`);
const intention=new RegExp(String.raw`^我${modifiers}(?:想|打算|准备|可以)[^，,。；！？]+$`);
const ending=new RegExp(String.raw`^(?:最后|最终|后来)?(?:我)?${modifiers}(${negative})$`);
const middle=new RegExp(String.raw`^(?:我${modifiers})?(?:看见|看到|听说|得知|了解|打听|考虑|犹豫|发现)[^，,。；！？]+$`);
const ownState=/^(?:还是|仍然|仍)(?:在|留在|做|住在|保持|维持|按|过)[^，,。；！？]+$/;
export function explicitSelfNonAction(text){
 const original=String(text||''),body=original.replace(prefix,'').trim().replace(/[。；！？\s]+$/,'');
 // Reported/conditional and multi-sentence statements need their full context.
 if(!body||/[。；！？“”「」『』"`]|如果|假如|要是|倘若/.test(body))return null;
 const parts=body.split(/[，,]/).map(s=>s.replace(prefix,'').trim()).filter(Boolean);
 if(parts.length>5)return null;
 if(parts.length>1&&ownState.test(parts.at(-1)))parts.pop();
 if(parts.length===1){const match=single.exec(parts[0]);return match?[original,'我',match[1]]:null;}
 if(!intention.test(parts[0]))return null;
 // "I wanted someone else to ..." cannot establish that I failed to act.
 if(/(?:想|打算|准备|可以)(?:先|再|直接|去)?(?:让|叫|请|劝|要求)/.test(parts[0]))return null;
 const end=ending.exec(parts.at(-1));if(!end)return null;
 if(!parts.slice(1,-1).every(p=>middle.test(p)))return null;
 return [original,'我',end[1]];
}
