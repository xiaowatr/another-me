import {historyRisk} from './session-context.js';
// Only visible, unexcluded role messages; original wording retains modality and source.
export function roleRecords(messages,background,memories=[],start=0){
 return messages.slice(start).filter(m=>m.role==='assistant'&&!m.contextExcluded&&!historyRisk(m.text||'',background,memories)).flatMap(m=>(m.text||'').split(/(?<=[。！？\n])/).map(text=>text.trim()).filter(text=>text && /[。！？]$/.test(text)&&!/[？?]|如果|假如|要是|你|现实用户|我(?:觉得|认为|猜你|听说你|记得你)/.test(text)).map((text,i)=>({sourceId:m.id+':'+i,kind:/打算|计划|希望|想要|明天|明年|以后|将来|准备/.test(text)?'plan':/可能|也许|大概是|猜/.test(text)?'uncertain':'statement',text:text.slice(0,600)})));
}
export function selectRoleRecords(records,question=''){
 const terms=question.match(/[\p{Script=Han}]{2}/gu)||[];
 const scored=records.map((r,i)=>({r,i,score:terms.filter(t=>r.text.includes(t)).length})).sort((a,b)=>b.score-a.score||b.i-a.i);
 let size=0;return scored.filter(x=>(size+=x.r.text.length)<=6000).sort((a,b)=>a.i-b.i).map(x=>x.r);
}
