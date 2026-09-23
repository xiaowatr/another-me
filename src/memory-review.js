// Conservative summaries of explicit user clauses, without inferring traits.
export function summarizeMemory(value){
 let text=String(value||'').trim().replace(/^(?:更正|其实|之前说错了?)[，,:：\s]*/,'').replace(/[。！；\s]+$/,'');
 if(!text||/[?？]|吗$|呢$|如果|假如|要是|可能|也许|假设|他说|她说|角色|另一个自己|我(?:觉得|好像|似乎)|(?:今天|现在).*(?:难过|开心|生气|烦|累)/.test(text))return null;
 if(/[，,].*(?:但是|不过|然而|不再)/.test(text))return null;
 text=text.split(/[，,]/)[0];
 if(/(?:今天|今晚|明天|这会儿|临时)/.test(text))return null;
 const rules=[
 [/^我(?:一直|真的|非常|很|特别|比较|更|平时|通常)*(不喜欢|喜欢|喜爱|爱好)(.+)$/,'preference',m=>(m[1]==='不喜欢'?'不喜欢：':'兴趣偏好：')+m[2]],
 [/^(?:我)?希望你(.+)$/,'preference',m=>'交流偏好：'+m[1]],
 [/^请(?:你)?(不要|别|先)(.+)$/,'preference',m=>'交流偏好：'+m[1]+m[2]],
 [/^我(?:现在|目前)?住在(.+)$/,'reality',m=>'居住地：'+m[1]],
 [/^我来自(.+)$/,'reality',m=>'来自：'+m[1]],
 [/^我(?:目前|现在|正在)?在学(.+)$/,'reality',m=>'正在学习：'+m[1]],
 [/^我(?:学过)(.+)$/,'reality',m=>'学习经历：'+m[1]],
 [/^我(?:曾经)?做过(.+)$/,'reality',m=>'做过的事：'+m[1]],
 [/^我(?:正在|打算|计划|希望|想要|决定)(.+)$/,'preference',m=>'当前方向：'+m[1]],
 [/^我(?:一直|平时|通常)?习惯(.+)$/,'preference',m=>'日常习惯：'+m[1]],
 [/^我(?:目前|现在)?在(.+?)(工作|读书|上学)$/,'reality',m=>(m[2]==='工作'?'工作地点：':'学习地点：')+m[1]],
 [/^我(不是|不再是|现在是|是)(.+)$/,'reality',m=>'自述身份：'+(m[1]==='不是'?'不是':m[1]==='不再是'?'不再是':'')+m[2]]
 ];
 for(const [pattern,type,format] of rules){const match=text.match(pattern);if(match)return {type,text:format(match)+'。'};}return null;
}
﻿// Summaries remain traceable to user messages; plans stay distinct from facts.
export const memoryKey=s=>String(summarizeMemory(s)?.text||s||'').replace(/[\s，。！？、；：,.!?;:“”"‘’]/g,'').replace(/(?:一直|真的|非常|很|特别|比较)/g,'').replace(/喜爱|爱好/g,'喜欢');
export function sameMemory(a,b){const x=memoryKey(a),y=memoryKey(b);if(x===y)return true;const stance=t=>(t.match(/不|没|未|别|\d+/g)||[]).join('|');if(stance(x)!==stance(y))return false;let small=x.length<y.length?x:y,big=x.length<y.length?y:x;if(small.length<7)return false;if(big.includes(small))return true;if(small.length/big.length<.8)return false;let i=0;for(const c of big)if(c===small[i])i++;return i===small.length;}
export const emptyReview=()=>({organizedUntil:0,roundStart:0,suppressed:[],rounds:[],review:null,lastChatAt:null});
export function proposeMemories(life){
 const meta={...emptyReview(),...life.sessionMeta},end=life.messages.length,start=Math.min(meta.organizedUntil,end),candidates=[];
 const known=[...(life.memories||[]),...(life.candidates||[]),...(meta.suppressed||[])];
 for(let i=start;i<end;i++){const m=life.messages[i];if(m.role!=='user'||m.status==='pending'||m.status==='failed')continue;
 const clauses=(m.text||'').split(/(?<=[。！？；\n])/).map(s=>s.trim()).filter(Boolean);
 for(let j=0;j<clauses.length;j++){const original=clauses[j],summary=summarizeMemory(original);if(!summary)continue;const text=summary.text;if(text.length<6||text.length>300||/[?？]|我在想|我觉得|我好像|我似乎|我在生气|我在难过|如果|假如|要是|可能|也许|假设|希望他|他说|她说|今天.*(?:难过|开心|烦|累)|现在.*(?:难过|生气|烦|累)/.test(text))continue;
 if(!summary)continue;
 const sourceId=m.id||`${life.id}:legacy:${i}`;
 if(known.some(k=>sameMemory(k.text,text)||k.sourceId===sourceId)||candidates.some(k=>sameMemory(k.text,text)))continue;
 const corrections=/其实|更正|改为|不再|现在更|之前说错/.test(original)?(life.memories||[]).filter(k=>{const a=memoryKey(k.text),b=memoryKey(text);return [...a].filter(c=>b.includes(c)).length>=Math.max(3,a.length*.5);}):[];
 candidates.push({id:`auto:${sourceId}:${j}`,type:summary.type,text,sourceId,sourceText:m.text,sourceRole:'user',origin:'automatic',createdAt:new Date().toISOString(),...(corrections.length===1?{replacesId:corrections[0].id}:{} )});
 if(candidates.length===5)return {candidates,through:i};
 }}
 return {candidates,through:end};
}
export function finishReview(life,now=new Date().toISOString(),extract=proposeMemories){
 const meta={...emptyReview(),...life.sessionMeta};
 if(meta.review?.end>=life.messages.length&&meta.review?.status==='complete')return life;
 const round=meta.review?.status==='failed'?meta.review:{id:`round:${life.id}:${meta.organizedUntil}:${life.messages.length}`,start:meta.roundStart,end:life.messages.length,endedAt:now,startedAt:meta.startedAt||now};
 try{const result=extract(life);return {...life,candidates:[...(life.candidates||[]),...result.candidates],sessionMeta:{...meta,organizedUntil:result.through,roundStart:round.end,startedAt:null,review:{...round,status:'complete'},rounds:[...meta.rounds.filter(r=>r.id!==round.id),round]}};}
 catch{return {...life,sessionMeta:{...meta,review:{...round,status:'failed'}}};}
}
export function dismissCandidates(life,next){const removed=(life.candidates||[]).filter(c=>!next.some(n=>n.id===c.id));return {...life,candidates:next,sessionMeta:{...emptyReview(),...life.sessionMeta,suppressed:[...(life.sessionMeta?.suppressed||[]),...removed.map(c=>({text:c.text,sourceId:c.sourceId}))]}};}
export function reviseMemories(life,next){const changed=(life.memories||[]).filter(m=>!next.some(n=>m.id===n.id&&m.text===n.text&&m.type===n.type));return {...life,memories:next,contextStart:changed.length?life.messages.length:life.contextStart,sessionMeta:{...emptyReview(),...life.sessionMeta,startedAt:life.sessionMeta?.startedAt||next.find(m=>m.savedAt&&!life.memories.some(old=>old.id===m.id&&old.savedAt===m.savedAt))?.savedAt||null,suppressed:[...(life.sessionMeta?.suppressed||[]),...changed.map(m=>({text:m.text,sourceId:m.sourceId}))]}};}

export function completeReview(life,ids=life.candidates.filter(c=>c.sourceRole!=='assistant'&&['reality','preference'].includes(c.type)).map(c=>c.id)){
 let next=[...life.memories];for(const c of life.candidates.filter(c=>ids.includes(c.id)&&c.sourceRole!=='assistant'&&['reality','preference'].includes(c.type)&&c.text.trim())){if(!next.some(m=>m.id!==c.id&&m.id!==c.replacesId&&sameMemory(m.text,c.text))){next=next.filter(m=>m.id!==c.replacesId&&m.id!==c.id);next.push({...c,text:c.text.trim(),savedAt:new Date().toISOString()});}}
 if(next.length>30)throw Error('memory_capacity');return dismissCandidates(reviseMemories(life,next),life.candidates.filter(c=>!ids.includes(c.id)));
}
