export const dateParts=text=>[...String(text||'').matchAll(/((?:19|20)\d{2})年(?:(\d{1,2})月)?/g)].map(m=>({year:+m[1],month:m[2]?+m[2]:null,text:m[0]})).filter(d=>d.month==null||d.month>=1&&d.month<=12);
export function timeAnchors(b,now=new Date()){
 const sources=['hypotheticalDirection','realityOutcome','details'].flatMap(field=>dateParts(b[field]).map(d=>({...d,field,source:b[field]})));
 const start=sources.find(d=>d.field==='hypotheticalDirection')||sources.find(d=>d.field==='realityOutcome')||null;
 const window=observationWindow(b,start,now);
 return {window,start,sources,asOf:now.toISOString().slice(0,10),currentYear:now.getFullYear(),currentMonth:now.getMonth()+1,observationRange:(b.hypotheticalDirection||'').match(/(?:只写|只看|仅写|仅看)([^。；]+)/)?.[1]||null};
}
export function scenePhase(scene,b){const a=timeAnchors(b),d=dateParts(scene.time)[0];return /未来|设想|可能情景|计划/.test(scene.time||'')||d&&(d.year>a.currentYear||d.year===a.currentYear&&d.month>a.currentMonth)?'future':/回忆|此前|回顾/.test(scene.time||'')?'memory':'past';}
export function temporalIssues(story,b,compiledTemporal){const a=compiledTemporal||timeAnchors(b),out=[];for(const [i,s] of (story.scenes||[]).entries()){
 const label=dateParts(s.time)[0],future=scenePhase(s,b)==='future';
 const rawMonths=a.observationRange?.match(/([0-9一二两三四五六七八九十]+)个月/)?.[1],months=rawMonths?(Number(rawMonths)||({'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10}[rawMonths])):null;
 const w=a.window;const outside=d=>w?.start&&w?.end&&d&&(d.year<w.start.year||d.year>w.end.year||(d.month&&w.start.month&&d.year*12+d.month<w.start.year*12+w.start.month)||(d.month&&w.end.month&&d.year*12+d.month>w.end.year*12+w.end.month));
 if(outside(label)&&! /回忆|此前|回顾/.test(s.time||''))out.push({field:'scenes.'+i,reason:'outside_observation_window'});
 if(months&&label?.month&&a.start?.month&&label.year*12+label.month>a.start.year*12+a.start.month+months&&!/回忆|此前|回顾/.test(s.time))out.push({field:'scenes.'+i,reason:'outside_explicit_month_range'});
 if(future&&!/未来|设想|可能|计划/.test(s.time||''))out.push({field:'scenes.'+i,reason:'unlabelled_future'});
 if(a.start&&label&&label.year*12+(label.month||1)<a.start.year*12+(a.start.month||1)&&! /回忆|此前|回顾/.test(s.time||''))out.push({field:'scenes.'+i,reason:'before_explicit_start'});
 for(const sentence of String((s.time||'')+'。'+(s.text||'')).split(/[。！？；\n]/)){
  if(/回忆|想起|曾经|那时|当年|此前/.test(sentence))continue;
 if(w?.months){const later=sentence.match(/([0-9一二两三四五六七八九十]+)(年|个月)后|第([0-9一二两三四五六七八九十]+)(年|个月)/);if(later&&!/如果|计划|打算|希望/.test(sentence)){const n=smallNumber(later[1]||later[3]),elapsed= n==null?null:later[1]?n*(later[2]==='年'?12:1):(n-1)*(later[4]==='年'?12:1);if(elapsed>w.months)out.push({field:'scenes.'+i,reason:'body_beyond_observation_window'});}}
 if(/如果|计划|打算|明年/.test(sentence))continue;
 for(const d of dateParts(sentence))if(outside(d))out.push({field:'scenes.'+i,reason:'body_beyond_observation_window'});
  const bare=sentence.match(/(?<![0-9年])(1[0-2]|[1-9])月/);const d=dateParts(sentence)[0]||(bare&&label?{year:label.year,month:+bare[1]}:null);if(label&&d&&(label.year!==d.year||label.month&&d.month&&label.month!==d.month))out.push({field:'scenes.'+i,reason:'chapter_body_date_conflict'});
 }
 }return out;}
// Bounded first-person contradictions within a single reality/alternative field, never across worlds.
export function hardConflicts(b){const out=[];for(const field of ['realityOutcome','hypotheticalDirection']){
 const text=b[field]||'',claims=[];for(const clause of text.split(/[。；，,]/)){if(/如果|假如|要是|别人|他说|她说/.test(clause))continue;
 const m=clause.match(/(?:我|自己)(没有|没|并未|不)?(去|去了|离开|留下|留在)([^。；，,]*)/);if(m)claims.push({verb:m[2].replace('去了','去'),place:m[3].replace(/^了/,'').replace(/过$/,''),negative:!!m[1],source:clause});}
 for(let i=0;i<claims.length;i++)for(const prev of claims.slice(0,i)){const c=claims[i];if(/更正|纠正|其实|说错/.test(c.source))continue;if(prev.place===c.place&&((prev.verb===c.verb&&prev.negative!==c.negative)||!prev.negative&&!c.negative&&[prev.verb,c.verb].includes('离开')&&[prev.verb,c.verb].some(v=>v==='留在'||v==='留下')))out.push({field,sources:[prev.source,c.source],question:field==='realityOutcome'?'现实中那次究竟发生了什么？':'这次想探索哪一种选择？'});}
 }
 for(const field of ['realityOutcome','hypotheticalDirection']){
 const text=b[field]||'';const simultaneous=!/后来|之后|随后|年后|岁时.*岁时/.test(text);
 const ages=[...text.matchAll(/(?:当时|那时|那年|我)?(?:是|才)?(\d{1,2})岁/g)].map(m=>m[1]);
 if(field==='realityOutcome'&&simultaneous&&new Set(ages).size>1)out.push({field:'age',sources:[text],question:'当时究竟是几岁？'});
 if(field==='realityOutcome'&&/去了[^，。；]+[，,].*(?:一直|始终)(?:留在|没离开)/.test(text))out.push({field,sources:[text],question:'现实中那次最终去了哪里？'});
 const finalPlaces=[...text.matchAll(/(?:现实中?|最终|最后)(?:我)?(?:是)?(?:去(?:了)?|留在)([^，。；、\s]{1,12})/g)].map(m=>m[1]);
 if(field==='realityOutcome'&&simultaneous&&new Set(finalPlaces).size>1&&!/更正|说错|其实/.test(text))out.push({field,sources:[text],question:'现实中那次最终去了哪里？'});
 if(field==='hypotheticalDirection'&&!/更正|说错|其实|先.*再|后来|然后/.test(text)&&/(?:想|希望|假设|假如|这次).*(?:去|离开)/.test(text)&&/(?:想|希望|假设|假如|这次).*(?:留下|留在)/.test(text))out.push({field,sources:[text],question:'这次想探索离开，还是留下？'});
 }
 const anchor=timeAnchors(b);if(anchor.window?.anchor==='ambiguous')out.push({field:'range',sources:anchor.window.sources.map(s=>s.text),question:'这'+anchor.window.months+'个月从现在开始，还是从故事中的那次经历开始？请在原输入中说明起点。'});
 const y=anchor.start?.year;if(y&&/^\d{4}$/.test(b.birthYear||'')&&/^\d+$/.test(b.forkAge||'')&& ![y-Number(b.birthYear),y-Number(b.birthYear)-1].includes(+b.forkAge))out.push({field:'time',sources:[b.birthYear,b.forkAge,String(y)],question:'出生年份、当时年龄和事件年份对不上，请核对后修改原填写项。'});
 return out;
}
export function roleGender(b){const change=(b.hypotheticalDirection||'').match(/(?:我是|出生时是|出生就是|变成)(?:一个|个)?(男生|男孩|男性|女生|女孩|女性|非二元)/);return change?(/男/.test(change[1])?'男':/女/.test(change[1])?'女':'非二元'):['女','男','非二元'].includes(b.gender)?b.gender:null;}
export function applyClarification(b){b={...b};for(const field of ['realityOutcome','hypotheticalDirection']){const text=b[field]||'',matches=[...text.matchAll(/(?:更正|纠正|之前说错了)[：，,]\s*(?=我)/g)];if(matches.length){const last=matches.at(-1);b[field]=text.slice(last.index+last[0].length);}}const answer=b.followupSkipped?'':b.followupAnswer||'';if(b.followupKey!=='hard-conflict'||!answer)return b;const next={...b};const conflicts=hardConflicts(b),fields=[...new Set(conflicts.map(c=>c.field))];if(fields.length===1&&!['time','range','age'].includes(fields[0])&&!/现实[：:]|假设[：:]/.test(answer)&&answer!=='说不清')next[fields[0]]=answer.trim();for(const [label,key] of [['现实','realityOutcome'],['假设','hypotheticalDirection']]){const m=answer.match(new RegExp(label+'(?:中)?[：:]([^；;\\n]+)'));if(m)next[key]=m[1].trim();}const age=answer.match(/(?:年龄[：:]|当时(?:是)?)(\d{1,2})(?:岁)?/);if(age){next.forkAge=age[1];if(!/现实[：:]/.test(answer))next.realityOutcome=next.realityOutcome.replace(/\d{1,2}岁/g,age[1]+'岁');}return next;}

export function hardQuestion(b){const conflicts=hardConflicts(applyClarification(b));return conflicts.length?{id:"hard-conflict",question:[...new Set(conflicts.map(c=>c.question))].join(" "),options:[]}:null;}

const smallNumber=s=>/^\d+$/.test(s)?Number(s):({'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10}[s]??null);
export function observationWindow(b,fork,now=new Date()){
 const sources=['hypotheticalDirection','details','followupAnswer'].filter(f=>f!=='followupAnswer'||!b.followupSkipped).flatMap(field=>String(b[field]||'').split(/[。；\n]/).flatMap(text=>{const m=text.match(/(?:未来|接下来|之后|以后|只写|只看|仅写|仅看|观察|从现在起|从当年|从那次|从(?:19|20)\d{2}年)[^。；]{0,35}?([0-9一二两三四五六七八九十]+)个月/);return m?[{field,text,months:smallNumber(m[1])}]:[]}));
 if(!sources.length)return null;const item=sources.at(-1);if(!item.months)return null;
 const explicitNow=/从现在|从今天|接下来/.test(item.text),explicitFork=/从当年|从那年|从那次|分[岔叉].{0,8}起|从(?:19|20)\d{2}年|之后|以后/.test(item.text),future=/未来/.test(item.text);
 const current={year:now.getFullYear(),month:now.getMonth()+1,day:now.getDate()};
 const different=fork&&(fork.year!==current.year||fork.month&&fork.month!==current.month);
 const anchor=explicitNow?'now':explicitFork?'fork':future&&different?'ambiguous':future?'now':'fork';
 const calculated=/^\d{4}$/.test(b.birthYear||'')&&/^\d+$/.test(b.forkAge||'')?{year:+b.birthYear+ +b.forkAge,month:null}:null;
 const start=anchor==='now'?current:anchor==='fork'?(fork?{year:fork.year,month:fork.month}:calculated):null;
 let end=null;if(start){if(start.month){const index=start.year*12+start.month-1+item.months;end={year:Math.floor(index/12),month:index%12+1};}else end={year:start.year+Math.ceil(item.months/12),month:null};}
 return {months:item.months,anchor,start,end,precision:start?.month?'month':'unknown-month',sources};
}
