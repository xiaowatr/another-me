export const isUnknownOption=t=>/^(?:说不清|不确定|不愿透露|都不太符合|还没定|还没想好|没有特别限定|没什么特别舍不得)/.test(t);
export const selectionLimit=q=>q.kind==='single'?1:q.kind==='multi'?(q.maxSelections||2):0;
export function toggleOption(q,selected,option){
 if(selected.includes(option))return selected.filter(v=>v!==option);
 if(q.kind==='single'||isUnknownOption(option)||selected.some(isUnknownOption))return [option];
 return selected.length<selectionLimit(q)?[...selected,option]:selected;
}
export function validSelections(q,selected){return Array.isArray(selected)&&new Set(selected).size===selected.length&&selected.length<=selectionLimit(q)&&selected.every(v=>q.options.includes(v)||v==='说不清／不愿透露')&&!(selected.length>1&&selected.some(isUnknownOption));}

// The bank remains immutable. Only reviewed, canonical options can be hidden.
export function reviewedQuestionOptions(q,meta={}){
 const excluded=new Set((Array.isArray(meta?.excludedOptions)?meta.excludedOptions:[]).filter(x=>x&&typeof x.sourceId==='string'&&typeof x.evidence==='string'&&x.evidence.trim()&&q.options?.includes(x.option)).map(x=>x.option));
 return {...q,options:(q.options||[]).filter(x=>!excluded.has(x))};
}
