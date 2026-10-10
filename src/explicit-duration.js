// Only a single complete future-direction clause; do not scan history or infer weekly totals.
export function explicitDuration(text){
 const clauses=String(text||'').split(/[，,。；;\n]/).map(s=>s.trim());
 const candidates=clauses.filter(s=>s.startsWith('持续'));
 if(candidates.length!==1)return null;
 const m=candidates[0].match(/^持续([0-9一二两三四五六七八九十]+)个月$/);if(!m)return null;
 const months=/^\d+$/.test(m[1])?Number(m[1]):({'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10}[m[1]]??null);
 return Number.isInteger(months)&&months>=1&&months<=120?{months,text:candidates[0]}:null;
}
