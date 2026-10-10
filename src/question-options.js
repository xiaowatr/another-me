export const isUnknownOption=t=>/^(?:说不清|不确定|不愿透露|都不太符合|还没定|还没想好|没有特别限定|没什么特别舍不得)/.test(t);
export const selectionLimit=q=>q.kind==='single'?1:q.kind==='multi'?(q.maxSelections||2):0;
export function toggleOption(q,selected,option){
 if(selected.includes(option))return selected.filter(v=>v!==option);
 if(q.kind==='single'||isUnknownOption(option)||selected.some(isUnknownOption))return [option];
 return selected.length<selectionLimit(q)?[...selected,option]:selected;
}
export function validSelections(q,selected){return Array.isArray(selected)&&new Set(selected).size===selected.length&&selected.length<=selectionLimit(q)&&selected.every(v=>q.options.includes(v)||v==='说不清／不愿透露')&&!(selected.length>1&&selected.some(isUnknownOption));}
