// Only server validation metadata, never client prose or failed story bodies.
export function rewriteFeedback(error){
 const d=error?.diagnostic;if(!d)return null;
 const reason=/^[a-z_]{1,80}$/.test(d.reason||'')?d.reason:null;
 const field=/^(title|identity|intro|character|opening|scenes\.[0-3](?:\.(time|title|text))?)$/.test(d.field||'')?d.field:null;
 return reason?{reason,field}:null;
}
