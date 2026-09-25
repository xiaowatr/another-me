import {eventDate} from './age-validation.js';
﻿export const dateParts=text=>[...String(text||'').matchAll(/((?:18|19|20|21)\d{2})年(?:(\d{1,2})月(?:(\d{1,2})日)?)?/g)].map(m=>({year:+m[1],month:m[2]?+m[2]:null,...(m[3]?{day:+m[3]}:{}),text:m[0]})).filter(d=>d.month==null||d.month>=1&&d.month<=12);
export function timeAnchors(b,now=new Date()){
 const sources=['hypotheticalDirection','realityOutcome','details'].flatMap(field=>dateParts(b[field]).map(d=>({...d,field,source:b[field]})));
 const eventSources=sources.filter(d=>!/(?:观察|只看|只写)[：:]?\s*$/.test(d.source.slice(0,d.source.indexOf(d.text))));
 const start=eventSources.find(d=>d.field==='hypotheticalDirection')||eventSources.find(d=>d.field==='realityOutcome')||(/^\d{4}$/.test(b.birthYear||'')&&/^\d{1,3}$/.test(b.forkAge||'')?{year:+b.birthYear+ +b.forkAge,month:null,estimated:true}:null);
 const window=observationWindow(b,start,now);
 return {window,start,sources,asOf:now.toISOString().slice(0,10),currentYear:now.getFullYear(),currentMonth:now.getMonth()+1,observationRange:(b.hypotheticalDirection||'').match(/(?:只写|只看|仅写|仅看)([^。；]+)/)?.[1]||null};
}
export function futureScenario(b,a=timeAnchors(b)){const start=a.start,year=a.currentYear||Number(a.asOf?.slice(0,4)),month=a.currentMonth||Number(a.asOf?.slice(5,7));return Boolean(start&&(start.year>year||start.year===year&&start.month>month)||!start&&/未来.*(?:设想|探索|可能)|从现在起未来/.test(b.hypotheticalDirection||''));}
export function scenePhase(scene,b){const a=timeAnchors(b),d=dateParts(scene.time)[0];if(/回忆|此前|回顾/.test(scene.time||''))return 'memory';if(!d&&futureScenario(b,a))return 'future';return /未来|设想|可能情景|计划/.test(scene.time||'')||d&&(d.year>a.currentYear||d.year===a.currentYear&&d.month>a.currentMonth)?'future':/回忆|此前|回顾/.test(scene.time||'')?'memory':'past';}
export function temporalIssues(story,b,compiledTemporal){const a=compiledTemporal||timeAnchors(b),out=[];for(const [i,s] of (story.scenes||[]).entries()){
 const label=dateParts(s.time)[0];
 const rawMonths=a.observationRange?.match(/([0-9一二两三四五六七八九十]+)个月/)?.[1],months=rawMonths?(Number(rawMonths)||({'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10}[rawMonths])):null;
 const w=a.window;out.push(...preciseWindowIssues(s,w,label,i));const outside=d=>w?.start&&w?.end&&d&&(d.year<w.start.year||d.year>w.end.year||(d.month&&w.start.month&&d.year*12+d.month<w.start.year*12+w.start.month)||(d.month&&w.end.month&&d.year*12+d.month>w.end.year*12+w.end.month));
 if(outside(label)&&! /回忆|此前|回顾/.test(s.time||''))out.push({field:'scenes.'+i,reason:'outside_observation_window'});
 if(months&&label?.month&&a.start?.month&&label.year*12+label.month>a.start.year*12+a.start.month+months&&!/回忆|此前|回顾/.test(s.time))out.push({field:'scenes.'+i,reason:'outside_explicit_month_range'});
 // Future modality is presented by the application; missing wording is not a content contradiction.
 if(a.start&&label&&label.year*12+(label.month||1)<a.start.year*12+(a.start.month||1)&&! /回忆|此前|回顾/.test(s.time||''))out.push({field:'scenes.'+i,reason:'before_explicit_start'});
 for(const sentence of String(s.text||'').split(/[。！？；，,\n]/)){
  const scope=temporalScope(sentence);if(scope!=='current')continue;
 if(w?.months){const later=sentence.match(/([0-9一二两三四五六七八九十]+)(年|个月)后|第([0-9一二两三四五六七八九十]+)(年|个月)/);if(later&&!/如果|计划|打算|希望/.test(sentence)){const n=smallNumber(later[1]||later[3]),elapsed= n==null?null:later[1]?n*(later[2]==='年'?12:1):(n-1)*(later[4]==='年'?12:1);if(elapsed>w.months)out.push({field:'scenes.'+i,reason:'body_beyond_observation_window'});}}
 if(/如果|计划|打算|明年/.test(sentence))continue;
 for(const d of dateParts(sentence))if(outside(d))out.push({field:'scenes.'+i,reason:'body_beyond_observation_window'});
  const bare=sentence.match(/(?<![0-9年])(1[0-2]|[1-9])月/);const d=dateParts(sentence)[0]||(bare&&label?{year:label.year,month:+bare[1]}:null);if(label&&d&&(label.year!==d.year||label.month&&d.month&&label.month!==d.month))out.push({field:'scenes.'+i,reason:'chapter_body_date_conflict',evidence:{chapterTime:s.time,bodyDate:d,clause:sentence.trim().slice(0,240),scope,rule:'unqualified_current_date_differs_from_chapter'}});
 }
 }return out;}
// Clause-local modality; a recalled date never exempts a later current-time clause.
export function temporalScope(clause){
 const date=clause.search(/(?:18|19|20|21)\d{2}年|(?:1[0-2]|[1-9])月/),prefix=date>=0?clause.slice(0,date):clause;
 const cues=[...prefix.matchAll(/现在|此刻|当下|今天|眼下|此时|回忆|回顾|想起|记起|曾经|那时|当年|此前|上个月|那次|那天|当时|计划|打算|准备在|希望|如果|设想|明年/g)];
 const cue=cues.at(-1)?.[0];if(cue)return /计划|打算|准备在|希望|如果|设想|明年/.test(cue)?'future':/现在|此刻|当下|今天|眼下|此时/.test(cue)?'current':'memory';
 if(date>=0&&/那次|那天|当时|评选时/.test(clause.slice(date,date+40)))return 'memory';
 return 'current';
}
// Bounded first-person contradictions within a single reality/alternative field, never across worlds.
export function hardConflicts(b){const out=[];for(const field of ['realityOutcome','hypotheticalDirection']){
 const text=b[field]||'',claims=[];for(const clause of text.split(/[。；，,]/)){if(/如果|假如|要是|别人|他说|她说/.test(clause))continue;
 const m=clause.match(/(?:我|自己)(没有|没|并未|不)?(去|去了|离开|留下|留在)([^。；，,]*)/);if(m)claims.push({verb:m[2].replace('去了','去'),place:m[3].replace(/^了/,'').replace(/过$/,''),negative:!!m[1],source:clause});}
 for(let i=0;i<claims.length;i++)for(const prev of claims.slice(0,i)){const c=claims[i];if(/更正|纠正|其实|说错/.test(c.source))continue;if(prev.place===c.place&&((prev.verb===c.verb&&prev.negative!==c.negative)||!prev.negative&&!c.negative&&[prev.verb,c.verb].includes('离开')&&[prev.verb,c.verb].some(v=>v==='留在'||v==='留下')))out.push({field,sources:[prev.source,c.source],question:field==='realityOutcome'?'现实中那次究竟发生了什么？':'这次想探索哪一种选择？'});}
 }
 for(const field of ['realityOutcome','hypotheticalDirection']){
 const text=b[field]||'';const simultaneous=!/后来|之后|随后|年后|岁时.*岁时/.test(text);
 const ageText=text.replace(/(\d{1,2})(或|或者)(\d{1,2})岁/g,'$1岁$2$3岁');const ages=[...ageText.matchAll(/(?:当时|那时|那年|我)?(?:是|才)?(\d{1,2})岁/g)].map(m=>m[1]);
 if(field==='realityOutcome'&&simultaneous&&new Set(ages).size>1)out.push({field:'age',sources:text.split(/[。；]/).filter(p=>/\d{1,2}(?:岁|或|或者)/.test(p)),question:'当时究竟是几岁？'});
 if(field==='realityOutcome'&&/(?:去了|搬到|搬去)[^。；]+(?:一直|始终)(?:留在|留|没离开)/.test(text))out.push({field,sources:text.split(/[。；]/).filter(p=>/去|搬|留|离开/.test(p)),question:'现实中那次最终去了哪里？'});
 const finalPlaces=[...text.matchAll(/(?:现实中?|最终|最后)(?:我)?(?:是)?(?:去(?:了)?|留在)([^，。；、\s]{1,12})/g)].map(m=>m[1]);
 if(field==='realityOutcome'&&simultaneous&&new Set(finalPlaces).size>1&&!/更正|说错|其实/.test(text))out.push({field,sources:[text],question:'现实中那次最终去了哪里？'});
 if(field==='hypotheticalDirection'&&!/更正|说错|其实|先.*再|后来|然后/.test(text)&&/(?:想|希望|假设|假如|这次).*(?:去|离开)/.test(text)&&/(?:想|希望|假设|假如|这次).*(?:留下|留在|留[\u4e00-\u9fff]{2})/.test(text))out.push({field,sources:[text],question:'这次想探索离开，还是留下？'});
 }
 const anchor=timeAnchors(b);if(anchor.window?.anchor==='ambiguous')out.push({field:'range',sources:anchor.window.sources.map(s=>s.text),question:'这'+anchor.window.months+'个月从现在开始，还是从故事中的那次经历开始？请在原输入中说明起点。'});
 const y=eventDate(b)?.year;if(y&&/^\d{4}$/.test(b.birthYear||'')&&/^\d+$/.test(b.forkAge||'')&& ![y-Number(b.birthYear),y-Number(b.birthYear)-1].includes(+b.forkAge))out.push({field:'time',sources:[b.birthYear,b.forkAge,String(y)],question:'出生年份、当时年龄和事件年份对不上，请核对后修改原填写项。'});
 return out;
}
export function roleGender(b){const change=(b.hypotheticalDirection||'').match(/(?:我是|出生时是|出生就是|变成)(?:一个|个)?(男生|男孩|男性|女生|女孩|女性|非二元)/);return change?(/男/.test(change[1])?'男':/女/.test(change[1])?'女':'非二元'):['女','男','非二元'].includes(b.gender)?b.gender:null;}
export function applyClarification(b){
 b={...b};for(const field of ['realityOutcome','hypotheticalDirection']){const text=b[field]||'',matches=[...text.matchAll(/(?:更正|纠正|之前说错了)[：，,]\s*(?=我)/g)];if(matches.length){const last=matches.at(-1);b[field]=text.slice(last.index+last[0].length);}}
 const next={...b},answer=b.followupSkipped?'':b.followupAnswer||'';
 if(b.followupKey!=='hard-conflict'||!answer.trim()||b.clarificationAppliedAnswer===answer)return next;
 // Only explicit answer labels authorize replacing a world-specific assertion.
 const extract=label=>answer.match(new RegExp('(?:^|[，,；;。\\n])\\s*'+label+'(?:中)?[：:]?\\s*([^；;。\\n]+?)(?=[，,]\\s*(?:现实|假设)|$|[；;。\\n])'))?.[1]?.trim();
 const real=extract('现实'),imagined=extract('假设');
 const age=answer.match(/(?:年龄[：:]?|当时(?:是)?|\d{4}年)\s*(\d{1,3})岁/)||answer.trim().match(/^(\d{1,3})岁$/);
 const year=answer.match(/((?:18|19|20|21)\d{2})年/);
 if(real||imagined||age)next.clarificationOriginal=b.clarificationOriginal||JSON.stringify({realityOutcome:b.realityOutcome,hypotheticalDirection:b.hypotheticalDirection,forkAge:b.forkAge});
 if(real){const parts=String(b.realityOutcome||'').split(/[。；]/);const conflicts=hardConflicts(b).filter(c=>['realityOutcome','age'].includes(c.field));const retained=parts.filter(p=>p.trim()&&!conflicts.some(c=>c.sources.some(t=>t.includes(p)||p.includes(t))));const unresolvedAge=!age?String(b.realityOutcome||'').match(/\d{1,3}(?:岁)?(?:或|或者)\d{1,3}岁/)?.[0]:null;next.realityOutcome=[year?year[0]:(dateParts(b.realityOutcome)[0]?.text||''),unresolvedAge,real,...retained].filter(Boolean).join('。');}
 if(imagined)next.hypotheticalDirection=imagined;
 if(age){next.forkAge=age[1];if(!real)next.realityOutcome=next.realityOutcome.replace(/\d{1,3}(?:岁)?(?:或|或者)\d{1,3}岁|\d{1,3}岁/g,age[1]+'岁');}
 if(real||imagined||age)next.clarificationAppliedAnswer=answer;
 return next;
}

export function hardQuestion(b){const conflicts=hardConflicts(applyClarification(b));return conflicts.length?{id:"hard-conflict",question:[...new Set(conflicts.map(c=>c.question))].join(" "),options:[]}:null;}

const smallNumber=s=>/^\d+$/.test(s)?Number(s):({'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10}[s]??null);
export function observationWindow(b,fork,now=new Date()){
 for(const field of ['hypotheticalDirection','details','followupAnswer']){if(field==='followupAnswer'&&b.followupSkipped)continue;const text=b[field]||'',m=text.match(/(?:观察|只看|只写)[：:]?\s*((?:18|19|20|21)\d{2})年(\d{1,2})(?:月)?(?:—|–|-|至|到|和)(\d{1,2})月/);if(m&&+m[2]>=1&&+m[3]<=12&&+m[3]>=+m[2])return {months:+m[3]-+m[2]+1,anchor:'explicit-observation',start:{year:+m[1],month:+m[2]},end:{year:+m[1],month:+m[3]},precision:'month',sources:[{field,text:m[0]}]};}

 const sources=['hypotheticalDirection','details','followupAnswer'].filter(f=>f!=='followupAnswer'||!b.followupSkipped).flatMap(field=>String(b[field]||'').split(/[。；\n]/).flatMap(text=>{
 const normalized=text.replace(/半年/g,'六个月');const m=normalized.match(/(?:未来|接下来|之后|随后|以后|只写|只看|仅写|仅看|观察|从现在起|从当年|从那次|从(?:19|20)\d{2}年)[^。；]{0,35}?([0-9一二两三四五六七八九十]+)个月/);
 // Duration of the imagined stay; never reinterpret a stated past stay as this window.
 const stay=!/(?:现实|过去|曾经|以前)/.test(text)&&(field==='hypotheticalDirection'||/(?:驻留|停留|旅居)/.test(b.hypotheticalDirection||''))?(normalized.match(/(?:驻留|停留|旅居)([0-9一二两三四五六七八九十]+)个月/)||normalized.match(/([0-9一二两三四五六七八九十]+)个月[^。；，,]{0,8}(?:驻留|停留|旅居)/)):null;
 return m||stay?[{field,text,months:smallNumber((m||stay)[1]),...(stay?{scenarioDuration:true}:{})}]:[];
 }));
 if(!sources.length)return null;const item=sources.at(-1);if(!item.months)return null;
 const explicitNow=/从现在|从今天|接下来/.test(item.text),explicitFork=Boolean(item.scenarioDuration)||/从当年|从那年|从那次|分[岔叉].{0,8}起|从(?:19|20)\d{2}年|之后|随后|以后/.test(item.text),future=/未来/.test(item.text);
 const current={year:now.getFullYear(),month:now.getMonth()+1,day:now.getDate()};
 const different=fork&&(fork.year!==current.year||fork.month&&fork.month!==current.month);
 const anchor=explicitNow?'now':explicitFork?'fork':future&&different?'ambiguous':future?'now':'fork';
 const calculated=/^\d{4}$/.test(b.birthYear||'')&&/^\d+$/.test(b.forkAge||'')?{year:+b.birthYear+ +b.forkAge,month:null}:null;
 const start=anchor==='now'?current:anchor==='fork'?(fork?{year:fork.year,month:fork.month,...(fork.day?{day:fork.day}:{})}:calculated):null;
 let end=null;if(start){if(start.month){const index=start.year*12+start.month-1+item.months;end={year:Math.floor(index/12),month:index%12+1,...(start.day?{day:Math.min(start.day,new Date(Date.UTC(Math.floor(index/12),index%12+1,0)).getUTCDate())}:{})};}else end={year:start.year+Math.ceil(item.months/12),month:null};}
 const deadline=sources.flatMap(s=>[...s.text.matchAll(/(?:截至|截止到?|到)\s*((?:19|20)\d{2})年(\d{1,2})月(\d{1,2})日|((?:19|20)\d{2})年(\d{1,2})月(\d{1,2})日截止/g)]).at(-1);if(deadline)end={year:+(deadline[1]||deadline[4]),month:+(deadline[2]||deadline[5]),day:+(deadline[3]||deadline[6])};
 return {months:item.months,anchor,start,end,precision:start?.month?'month':'unknown-month',sources};
}

// Exact-day checks only when the compiled window has exact endpoints.
const utcDay=d=>d?.year&&d?.month&&d?.day?Date.UTC(d.year,d.month-1,d.day):null;
function preciseWindowIssues(scene,w,label,index){if(!w?.start||!w?.end)return [];const end=utcDay(w.end),start=utcDay(w.start);if(end==null)return [];const issues=[];
 for(const clause of String(scene.time+'。'+scene.text).split(/[。！？；\n]/)){
  if(/回忆|曾经|想起|计划|打算|希望|如果/.test(clause))continue;
  const explicit=dateParts(clause).find(d=>d.day);const bare=clause.match(/(?<![0-9])(1[0-2]|[1-9])月(\d{1,2})日/);let day=explicit?utcDay(explicit):bare&&label?.year?utcDay({year:label.year,month:+bare[1],day:+bare[2]}):null;
  const weekday=clause.match(/(\d{1,2})月第([一二三四五1-5])个(?:周日|星期日|星期天)/);if(day==null&&weekday&&label?.year){const month=+weekday[1],n=Number(weekday[2])||'一二三四五'.indexOf(weekday[2])+1;const first=new Date(Date.UTC(label.year,month-1,1)).getUTCDay();day=Date.UTC(label.year,month-1,1+(7-first)%7+7*(n-1));}
  if(day!=null&&(day>end||start!=null&&day<start))issues.push({field:'scenes.'+index,reason:'outside_explicit_day_range'});
  const duration=clause.match(/(?:这|过去的?|整整|已经过了|持续了?|共|第)([0-9一二两三四五六七八九十百]+)天/);if(duration&&start!=null){const raw=duration[1],n=/^\d+$/.test(raw)?+raw:raw==='一百'?100:smallNumber(raw);if(n!=null&&n>Math.floor((end-start)/86400000)+1)issues.push({field:'scenes.'+index,reason:'outside_explicit_day_duration'});}
 }return issues;
}
