export const dateParts=text=>[...String(text||'').matchAll(/((?:19|20)\d{2})年(?:(\d{1,2})月)?/g)].map(m=>({year:+m[1],month:m[2]?+m[2]:null,text:m[0]})).filter(d=>d.month==null||d.month>=1&&d.month<=12);
export function timeAnchors(b,now=new Date()){
 const sources=['hypotheticalDirection','realityOutcome','details'].flatMap(field=>dateParts(b[field]).map(d=>({...d,field,source:b[field]})));
 const start=sources.find(d=>d.field==='hypotheticalDirection')||sources.find(d=>d.field==='realityOutcome')||null;
 return {start,sources,asOf:now.toISOString().slice(0,10),currentYear:now.getFullYear(),currentMonth:now.getMonth()+1,observationRange:(b.hypotheticalDirection||'').match(/(?:只写|只看|仅写|仅看)([^。；]+)/)?.[1]||null};
}
export function scenePhase(scene,b){const a=timeAnchors(b),d=dateParts(scene.time)[0];return /未来|设想|可能情景|计划/.test(scene.time||'')||d&&(d.year>a.currentYear||d.year===a.currentYear&&d.month>a.currentMonth)?'future':/回忆|此前|回顾/.test(scene.time||'')?'memory':'past';}
export function temporalIssues(story,b){const a=timeAnchors(b),out=[];for(const [i,s] of (story.scenes||[]).entries()){
 const label=dateParts(s.time)[0],future=scenePhase(s,b)==='future';
 const rawMonths=a.observationRange?.match(/([0-9一二两三四五六七八九十]+)个月/)?.[1],months=rawMonths?(Number(rawMonths)||({'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10}[rawMonths])):null;
 if(months&&label?.month&&a.start?.month&&label.year*12+label.month>a.start.year*12+a.start.month+months&&!/回忆|此前|回顾/.test(s.time))out.push({field:'scenes.'+i,reason:'outside_explicit_month_range'});
 if(future&&!/未来|设想|可能|计划/.test(s.time||''))out.push({field:'scenes.'+i,reason:'unlabelled_future'});
 if(a.start&&label&&label.year*12+(label.month||1)<a.start.year*12+(a.start.month||1)&&! /回忆|此前|回顾/.test(s.time||''))out.push({field:'scenes.'+i,reason:'before_explicit_start'});
 for(const sentence of String(s.text||'').split(/[。！？；\n]/)){
  if(/回忆|想起|曾经|那时|当年|此前|如果|计划|打算|明年/.test(sentence))continue;
  const bare=sentence.match(/(?<![0-9年])(1[0-2]|[1-9])月/);const d=dateParts(sentence)[0]||(bare&&label?{year:label.year,month:+bare[1]}:null);if(label&&d&&(label.year!==d.year||label.month&&d.month&&label.month!==d.month))out.push({field:'scenes.'+i,reason:'chapter_body_date_conflict'});
 }
 }return out;}
// Bounded first-person contradictions within a single reality/alternative field, never across worlds.
export function hardConflicts(b){const out=[];for(const field of ['realityOutcome','hypotheticalDirection']){
 const text=b[field]||'',claims=[];for(const clause of text.split(/[。；，,]/)){if(/如果|假如|要是|别人|他说|她说/.test(clause))continue;
 const m=clause.match(/(?:我|自己)(没有|没|并未|不)?(去|去了|离开|留下|留在)([^。；，,]*)/);if(m)claims.push({verb:m[2].replace('去了','去'),place:m[3].replace(/^了/,'').replace(/过$/,''),negative:!!m[1],source:clause});}
 for(let i=0;i<claims.length;i++)for(const prev of claims.slice(0,i)){const c=claims[i];if(/更正|纠正|其实|说错/.test(c.source))continue;if(prev.place===c.place&&((prev.verb===c.verb&&prev.negative!==c.negative)||!prev.negative&&!c.negative&&[prev.verb,c.verb].includes('离开')&&[prev.verb,c.verb].some(v=>v==='留在'||v==='留下')))out.push({field,sources:[prev.source,c.source],question:field==='realityOutcome'?'现实中那次究竟发生了什么？':'这次希望留下还是离开？'});}
 }
 const y=timeAnchors(b).start?.year;if(y&&/^\d{4}$/.test(b.birthYear||'')&&/^\d+$/.test(b.forkAge||'')&& ![y-Number(b.birthYear),y-Number(b.birthYear)-1].includes(+b.forkAge))out.push({field:'time',sources:[b.birthYear,b.forkAge,String(y)],question:'出生年份、当时年龄和事件年份对不上，请核对后修改原填写项。'});
 return out;
}
export function roleGender(b){const change=(b.hypotheticalDirection||'').match(/(?:我是|出生时是|出生就是|变成)(?:一个|个)?(男生|男孩|男性|女生|女孩|女性|非二元)/);return change?(/男/.test(change[1])?'男':/女/.test(change[1])?'女':'非二元'):b.gender&&b.gender!=='不透露'?b.gender:null;}
export function applyClarification(b){b={...b};for(const field of ['realityOutcome','hypotheticalDirection']){const text=b[field]||'',matches=[...text.matchAll(/(?:更正|纠正|之前说错了)[：，,]\s*(?=我)/g)];if(matches.length){const last=matches.at(-1);b[field]=text.slice(last.index+last[0].length);}}const answer=b.followupSkipped?'':b.followupAnswer||'';if(b.followupKey!=='hard-conflict'||!answer)return b;const next={...b};for(const [label,key] of [['现实','realityOutcome'],['假设','hypotheticalDirection']]){const m=answer.match(new RegExp(label+'[：:]([^\\n]+)'));if(m)next[key]=m[1].trim();}return next;}
