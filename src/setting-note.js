// Display only compiled, sourced settings. Never infer missing information.
export function settingNote(effective){
 const lines=[];const change=effective?.change;
 if(change?.source?.text && typeof change.text==='string' && change.text.trim())lines.push('这次：'+change.text.trim());
 const w=effective?.temporal?.window;
 if(w && w.anchor!=='ambiguous' && Number.isFinite(w.months) && w.months>0){
  const start=w.start;const anchor=w.anchor==='now'?'从现在起':start?.year&&start?.month?'从'+start.year+'年'+start.month+'月起':w.anchor==='fork'?'从那次改变起':'';
  if(anchor)lines.push('观察：'+anchor+w.months+'个月');
 }
 const retained=effective?.retained?.find(r=>r.source?.text && typeof r.text==='string' && r.text.trim().length<=28 && !lines.some(l=>l.includes(r.text.trim())));
 if(retained)lines.push('保留：'+retained.text.trim());
 return lines.slice(0,3);
}
