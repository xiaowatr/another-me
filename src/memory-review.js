// Conservative summaries of explicit user clauses, without inferring traits.
export function summarizeMemory(value){
 let text=String(value||'').trim().replace(/^(?:我)?(?:更正|其实|说错了|之前说错了?)[，,:：\s]*/,'').replace(/[。！；\s]+$/,'');
 text=text.replace(/^(周末|平时|通常|每天|每周)我(喜欢|不喜欢|习惯)/,'我$2$1');
 if(/^(?:最近|近期)(?:在学|正在学|开始学)/.test(text))text='我'+text;
 if(/^(?:我)?(?:平时|通常|每周|周末)(?:经常|总是|会|都)(?!不会)(.+)$/.test(text))text=text.replace(/^(?:我)?(平时|通常|每周|周末)(?:经常|总是|会|都)(.+)$/,'我习惯$1$2');
 if(/^(?:学习|学过|正在学)/.test(text))text='我'+text.replace(/^学习/,'正在学习');
 if(/^(?:最近|近期)?(?:开始学|学摄影|喜欢|不喜欢)/.test(text))text='我'+text.replace(/^最近学/,'最近开始学');
 text=text.replace(/^(?:现在|如今)([^，,。]{1,30})我(?:也)?喜欢了$/, '我也喜欢$1').replace(/^我(?:现在|如今)(也)?/, '我$1');
 if(!text||/[?？]|吗$|呢$|如果|假如|要是|可能|也许|假设|他说|她说|角色|另一个自己|我(?:觉得|好像|似乎)|(?:他|她|你)(?:平时|周末|喜欢|在学)|(?:今天|现在).*(?:难过|开心|生气|烦|累)/.test(text))return null;
 if(/[，,].*(?:但是|不过|然而|不再)/.test(text))return null;
 text=text.split(/[，,]/)[0];
 if(/(?:今天|今晚|明天|这会儿|临时)/.test(text))return null;
 const rules=[
 [/^我(?:刚刚|刚|最近)?(?:来到|到)([^，。！？]+?)(?:了)?$/,'reality',m=>'近期到达：'+m[1]],
 [/^(?:我)?(?:准备|打算|计划)?(?:在([^，。！？]{1,20}))?(?:待|住|停留)([一二两三四五六七八九十百\d]+个?(?:月|周|星期|年))(?:吧|左右)?$/,'preference',m=>'停留计划：'+(m[1]?'在'+m[1]:'')+m[2]],
 [/^(?:我)?(?:上一份|上份|之前的|原来的)工作(?:已经|已)?(?:辞职|辞掉)(?:了|不干了)?$/,'reality',()=> '工作近况：已离开上一份工作'],
 [/^我(?:已经|刚刚|刚|最近)?辞职(?:了)?$/,'reality',()=> '工作近况：已辞职'],
 [/^我(?:一直|真的|非常|很|特别|比较|更|平时|通常|也)*(不喜欢|喜欢|喜爱|爱好)(.+)$/,'preference',m=>(m[1]==='不喜欢'?'不喜欢：':'兴趣偏好：')+m[2]],
 [/^(?:我)?希望你(.+)$/,'preference',m=>'交流偏好：'+m[1]],
 [/^请(?:你)?(不要|别|先)(.+)$/,'preference',m=>'交流偏好：'+m[1]+m[2]],
 [/^我(?:现在|目前)?住在(.+)$/,'reality',m=>'居住地：'+m[1]],
 [/^我来自(.+)$/,'reality',m=>'来自：'+m[1]],
 [/^我(?:(?:最近|近期|刚刚|刚)?开始学(?:习)?|(?:目前|现在|正在)?在学|正在学习|最近在学)(.+)$/,'reality',m=>'正在学习：'+m[1]],
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
 const meta={...emptyReview(),...life.sessionMeta},end=life.messages.length,start=Math.min(meta.organizedUntil,end),candidates=[],updatedCandidates=(life.candidates||[]).map(c=>({...c}));
 const known=[...(life.memories||[]),...(life.candidates||[])];
 for(let i=start;i<end;i++){const m=life.messages[i];if(m.role!=='user'||m.status==='pending'||m.status==='failed')continue;
 if(m.kind==='closing')continue;
 const clauses=memoryClauses(m.text);
 for(let j=0;j<clauses.length;j++){const original=clauses[j],summary=summarizeMemory(original);if(!summary)continue;const text=summary.text;if(text.length<6||text.length>300||/[?？]|我在想|我觉得|我好像|我似乎|我在生气|我在难过|如果|假如|要是|可能|也许|假设|希望他|他说|她说|今天.*(?:难过|开心|烦|累)|现在.*(?:难过|生气|烦|累)/.test(text))continue;
 if(!summary)continue;
 const sourceId=m.id||`${life.id}:legacy:${i}`;
 const duplicate=(meta.suppressed||[]).some(k=>(k.sourceId===sourceId||i<(k.through??meta.organizedUntil))&&sameMemory(k.text,text))||known.some(k=>sameMemory(k.text,text))||candidates.some(k=>sameMemory(k.text,text));
 const correction=memoryCorrection(original,summary)||preferenceReversal(summary);
 const replacementEdits=[];
 if(correction){
  const pool=[...candidates,...updatedCandidates,...(life.memories||[])].filter(k=>k.sourceId!==sourceId);
  const hits=pool.flatMap(k=>memoryParts(k.text).map((part,index)=>({k,part,index}))).filter(x=>(summarizeMemory(x.part)?.text||x.part).startsWith(correction.category)&&(!correction.oldValue||(correction.exact?memoryKey((summarizeMemory(x.part)?.text||x.part).split('：').slice(1).join('：'))===memoryKey(correction.oldValue):memoryKey(x.part).includes(memoryKey(correction.oldValue)))));
  // An unnamed correction is safe only when it identifies one existing preference.
  if(correction.oldValue||hits.length===1)for(const {k,part} of hits){
   const existingEdit=replacementEdits.find(e=>e.id===k.id);const text=memoryParts(existingEdit?existingEdit.text:k.text).filter(p=>p!==part).join('；');
   const draft=candidates.find(x=>x.id===k.id)||updatedCandidates.find(x=>x.id===k.id);
   if(draft){draft.text=text; if(text.startsWith('正在学习：')&&!text.includes('兴趣偏好：'))draft.type='reality';}
   else if(existingEdit)existingEdit.text=text;else replacementEdits.push({id:k.id,text,previousText:k.text});
  }
 }
 if(duplicate)continue;
 candidates.push({id:`auto:${sourceId}:${j}`,type:summary.type,text,sourceId,sourceText:m.text,sourceRole:'user',origin:'automatic',createdAt:new Date().toISOString(),...(replacementEdits.length?{replacementEdits,...(replacementEdits.length===1&&!replacementEdits[0].text?{replacesId:replacementEdits[0].id}:{})}:{} )});

 }}
 const merged=mergeRelatedMemories(candidates.filter(c=>c.text)),selected=merged.slice(-5),deferred=merged.slice(0,-5);
 const through=deferred.length?Math.min(...deferred.map(c=>life.messages.findIndex((m,i)=>(m.id||life.id+':legacy:'+i)===c.sourceId))):end;
 return {candidates:selected,updatedCandidates:updatedCandidates.filter(c=>c.text),through,stats:{start,end,userMessages:life.messages.slice(start,end).filter(m=>m.role==='user'&&m.kind!=='closing'&&!['pending','failed'].includes(m.status)).length,candidates:selected.length}};
}
export function finishReview(life,now=new Date().toISOString(),extract=proposeMemories){
 const meta={...emptyReview(),...life.sessionMeta};
 if(meta.review?.end>=life.messages.length&&meta.review?.status==='complete')return life;
 const round=meta.review?.status==='failed'?meta.review:{id:`round:${life.id}:${meta.organizedUntil}:${life.messages.length}`,start:meta.roundStart,end:life.messages.length,endedAt:now,startedAt:meta.startedAt||now};
 try{const result=extract(life);return {...life,candidates:[...(result.updatedCandidates||life.candidates||[]),...result.candidates],sessionMeta:{...meta,organizedUntil:result.through,roundStart:round.end,startedAt:null,review:{...round,status:'complete',stats:result.stats},rounds:[...meta.rounds.filter(r=>r.id!==round.id),round]}};}
 catch{return {...life,sessionMeta:{...meta,review:{...round,status:'failed'}}};}
}
export function dismissCandidates(life,next){const removed=(life.candidates||[]).filter(c=>!next.some(n=>n.id===c.id));return {...life,candidates:next,sessionMeta:{...emptyReview(),...life.sessionMeta,suppressed:[...(life.sessionMeta?.suppressed||[]),...removed.map(c=>({text:c.text,sourceId:c.sourceId,through:life.messages.length}))]}};}
export function reviseMemories(life,next){const changed=(life.memories||[]).filter(m=>!next.some(n=>m.id===n.id&&m.text===n.text&&m.type===n.type));return {...life,memories:next,contextStart:changed.length?life.messages.length:life.contextStart,sessionMeta:{...emptyReview(),...life.sessionMeta,startedAt:life.sessionMeta?.startedAt||next.find(m=>m.savedAt&&!life.memories.some(old=>old.id===m.id&&old.savedAt===m.savedAt))?.savedAt||null,suppressed:[...(life.sessionMeta?.suppressed||[]),...changed.map(m=>({text:m.text,sourceId:m.sourceId,through:life.messages.length}))]}};}

export function completeReview(life,ids=life.candidates.filter(c=>candidateHasUserSource(life,c)&&['reality','preference'].includes(c.type)).map(c=>c.id)){
 let next=[...life.memories];for(const c of life.candidates.filter(c=>ids.includes(c.id)&&c.sourceRole!=='assistant'&&['reality','preference'].includes(c.type)&&c.text.trim())){for(const edit of c.replacementEdits||[]){next=next.flatMap(m=>m.id!==edit.id||m.text!==edit.previousText?[m]:edit.text?[{...m,text:edit.text,type:edit.text.startsWith('正在学习：')&&!edit.text.includes('兴趣偏好：')?'reality':m.type}]:[]);}if(!next.some(m=>m.id!==c.id&&m.id!==c.replacesId&&sameMemory(m.text,c.text))){next=next.filter(m=>m.id!==c.replacesId&&m.id!==c.id);next.push({...c,text:c.text.trim(),savedAt:new Date().toISOString()});}}
 if(next.length>30)throw Error('memory_capacity');return dismissCandidates(reviseMemories(life,next),life.candidates.filter(c=>!ids.includes(c.id)));
}

export function memoryClauses(value){
 return String(value||'').split(/(?<=[。！？；\n])/).flatMap(sentence=>{
 if(/^(?:我)?(?:更正|其实|说错了|之前说错)|[?？]|(?:但是|不过|然而|不再|不是)/.test(sentence))return [sentence.trim()];
 const parts=sentence.split(/[，,]/);const own=/^(?:我|最近|近期|喜欢)/.test(parts[0].trim());
 return parts.map((part,i)=>{let p=part.trim();if(i&&own&&/^(?:周末|平时|通常|每天|每周|一直)?(?:喜欢|不喜欢|习惯|打算|计划)/.test(p))p='我'+p;return p.replace(/^我(周末|每天|每周)(喜欢|不喜欢)(.+)$/,'我$2$1$3');}).filter(Boolean);
 });
}
export function closeConversation(life,now=new Date().toISOString()){
 if(life.messages.at(-1)?.kind==='closing')return life;
 return {...life,messages:[...life.messages,{id:'closing:'+life.id+':'+life.messages.length,role:'user',kind:'closing',status:'sent',text:'先聊到这里吧',createdAt:now}]};
}

export function mergeRelatedMemories(items){const result=[];for(const item of items){const match=result.find(m=>m.sourceId===item.sourceId&&((/摄影/.test(m.text)&&/拍.*(?:街景|照片|风景)/.test(item.text))||sameMemory(m.text,item.text)));if(!match){result.push({...item});continue;}if(sameMemory(match.text,item.text)){if(item.text.length>match.text.length)match.text=item.text;}else{match.text=match.text.replace(/。$/,'')+'；'+item.text;match.type='preference';}}return result;}

export function candidateHasUserSource(life,c){if(c.type==='fiction')return c.sourceRole==='assistant'||c.sourceRole==='user';if(c.sourceRole!=='user')return false;return life.messages.some(m=>m.role==='user'&&(m.id===c.sourceId||c.sourceId===life.id+':legacy:'+life.messages.indexOf(m))&&(!c.sourceText||c.sourceText===m.text));}

// Only explicit user corrections can replace an earlier item. Ordinary additional interests coexist.
function memoryParts(text){return String(text).split(/[；;，,]/).map(s=>s.replace(/[。\s]+$/,'')).filter(Boolean);}
export function memoryCorrection(original,summary){
 if(!/^(?:我)?(?:更正|其实|说错了|之前说错)|不是|而是|改为/.test(original))return null;
 const category=summary.text.match(/^[^：]+：/)?.[0];if(!category)return null;
 const oldValue=original.match(/[，,]\s*(?:不是|不喜欢)\s*([^。；，,]+)/)?.[1]?.trim()||null;
 return {category,oldValue};
}

// Match only an explicit opposite preference for the same object, including user-edited summaries.
function preferenceReversal(summary){const m=summary.text.match(/^(兴趣偏好|不喜欢)：(.+?)[。]?$/);return m?{category:m[1]==='兴趣偏好'?'不喜欢：':'兴趣偏好：',oldValue:m[2].replace(/。$/,''),exact:true}:null;}

// Explicit user action rechecks old messages while preserving deletion/edit suppression.
export function revisitMemories(life){const meta={...emptyReview(),...life.sessionMeta};return finishReview({...life,sessionMeta:{...meta,organizedUntil:0,review:null}});}
