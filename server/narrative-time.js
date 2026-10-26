import {frequencyRule} from './frequency-proof.js';
const digits='[一二两三四五六七八九十\\d]+';
const number=s=>{if(/^\d+$/.test(s))return Number(s);const u={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};if(s==='十')return 10;if(/^[一二三四五六七八九]?十[一二三四五六七八九]?$/.test(s)){const [a,b]=s.split('十');return (u[a]||1)*10+(u[b]||0);}return u[s]||null;};
const clauseList=text=>String(text||'').split(/[。！？；\n]/).map(s=>s.trim()).filter(Boolean);
const requestSource=s=>['hypotheticalDirection','details','extra','followupAnswer'].includes(s.id)||s.id.startsWith('confirmation:');
// Only explicitly stated event-relative letter cutoffs. No dates or event identities are guessed.
export function narrationAnchor(sources){
 const matches=[];
 for(const s of sources.filter(requestSource))for(const text of clauseList(s.text)){
  const m=text.match(new RegExp('第('+digits+')(次|节)(课|活动|训练|练习)(?:结束|完成)(?:后|之后)?的?(当晚|当天晚上|当日晚上).{0,8}?(?:写(?:来)?信|写来信|来信)'));
  if(!m){
   const evening=text.match(/(?:只写|只描写|只记录)(?:当天晚上|当晚|今晚)|(?:当天晚上|当日晚上|当晚|今晚).{0,8}(?:写(?:来)?信|写这封信)/);
   if(evening&&!/(?:例如|比如|假如|如果|不是|不在|不要|不必|无需|可以|或者)/.test(text.slice(0,evening.index)))matches.push({kind:'same_evening_letter',eventOrdinal:null,eventUnit:null,phase:'same_evening',sourceRef:s.id,quote:evening[0]});
   continue;
  }
  if(/(?:例如|比如|假如|如果|不是|不在|不要在|不必|无需|可以|或者)/.test(text.slice(0,m.index)))continue;
  const ordinal=number(m[1]);if(!Number.isInteger(ordinal)||ordinal<1||ordinal>24)continue;
  matches.push({kind:'event_evening_letter',eventOrdinal:ordinal,eventUnit:m[3],phase:'same_evening',sourceRef:s.id,quote:m[0]});
 }
 const latest=matches.filter(x=>x.sourceRef==='followupAnswer'||x.sourceRef.startsWith('confirmation:')).at(-1);
 const active=latest?[latest]:matches;
 return active.length&&new Set(active.map(x=>x.eventOrdinal+'|'+x.eventUnit)).size===1?active.at(-1):null;
}
// A source-backed creative schedule, not a record of completed attendance.
// Exact full calendar months + one rate + an agreeing explicit total are required.
export function calendarActivitySequence(sources){
 const hyp=sources.find(s=>s.id==='hypotheticalDirection'),activities=[...String(hyp?.text||'').matchAll(/(?:开始|继续)?学([^，。！？；\s]{1,12})/g)];
 if(activities.length!==1)return null;
 const results=[];
 for(const s of sources.filter(requestSource)){
  const text=s.text,range=text.match(/(\d{4})年(\d{1,2})月(?:(\d{1,2})日)?(?:至|到)(?:(\d{4})年)?(\d{1,2})月(?:(\d{1,2})日)?/),rate=frequencyRule(text),total=text.match(new RegExp('(?:一共|总共|合计|共)('+digits+')(?:次|节)(?:课|课程)?'));
  if(!range||!rate||rate.unit!=='月'||!total||/(?:大约|左右|不完整|最多|至少)/.test(text))continue;
  const year=+range[1],month=+range[2],endYear=+(range[4]||range[1]),endMonth=+range[5],months=(endYear-year)*12+endMonth-month+1,count=number(total[1]);
  if(month<1||month>12||endMonth<1||endMonth>12||months<1||months>12||range[3]&&+range[3]!==1||range[6]&&+range[6]!==new Date(Date.UTC(endYear,endMonth,0)).getUTCDate())continue;
  if(count!==months*rate.count||count>24||rate.count<1)continue;
  const occurrences=Array.from({length:count},(_,i)=>{const d=new Date(Date.UTC(year,month-1+Math.floor(i/rate.count),1));return {ordinal:i+1,year:d.getUTCFullYear(),month:d.getUTCMonth()+1,withinMonth:i%rate.count+1,cumulativeCompleted:i+1};});
  results.push({kind:'creative_arrangement',activity:activities[0][1]+'课',sourceRefs:[hyp.id,s.id],rangeQuote:range[0],frequencyQuote:rate.quote,totalQuote:total[0],totalCount:count,occurrences});
 }
 if(results.length===1)return results[0];
 if(results.length)return null;
 if(sources.filter(requestSource).some(s=>/\d{4}年\d{1,2}月(?:\d{1,2}日)?(?:至|到)/.test(s.text)))return null;
 // When the last class is also the letter anchor, an exact monthly rate and
 // exact total in the same learning-start statement support a creative sequence.
 const a=narrationAnchor(sources),text=hyp?.text||'',start=text.match(/(\d{4})年(\d{1,2})月.{0,6}开始学/),rate=frequencyRule(text),total=text.match(new RegExp('(?:一共|总共|合计|共)('+digits+')(?:次|节)(?:课|课程)?'));
 if(!a||a.eventUnit!=='课'||!start||!rate||rate.unit!=='月'||!total||/(?:大约|左右|不完整|最多|至少|断断续续|隔月|暂停|间断|缺席)/.test(sources.filter(requestSource).map(s=>s.text).join('；')))return null;
 const count=number(total[1]),year=+start[1],month=+start[2],months=count/rate.count;
 if(month<1||month>12||count!==a.eventOrdinal||count>24||!Number.isInteger(months)||months<1||months>12)return null;
 const occurrences=Array.from({length:count},(_,i)=>{const d=new Date(Date.UTC(year,month-1+Math.floor(i/rate.count),1));return {ordinal:i+1,year:d.getUTCFullYear(),month:d.getUTCMonth()+1,withinMonth:i%rate.count+1,cumulativeCompleted:i+1};});
 return {kind:'creative_arrangement',activity:activities[0][1]+'课',sourceRefs:[hyp.id,a.sourceRef],rangeQuote:start[0],frequencyQuote:rate.quote,totalQuote:total[0],totalCount:count,occurrences};
}
export function narrativeTimeFrame(input){
 const sources=input.sources||[],anchor=narrationAnchor(sources),sequence=calendarActivitySequence(sources);
 if(!anchor&&!sequence)return null;
 return {narrationAnchor:anchor,activitySequence:sequence,meaning:'写信时点是叙述者当前可知道的截止；更早片段可以回顾，之后的事情只能写成打算或设想。activitySequence仅为符合原话的创作安排，不是新增现实经历；本月序号与累计序号分开，回顾旧课不新增次数，回顾后交代返回哪个时点。'};
}
const isQuoted=s=>/[“”「」『』"]/.test(s);
// A narrow direct proof: the final passage is explicitly anchored to the requested
// evening and then asserts next-morning actions as completed. Earlier memories,
// plans, hypotheticals and unanchored relative dates are not hard failures.
export function narrativeTimeIssues(story,input){
 const issues=calendarOrdinalIssues(story,input);
 const anchor=narrationAnchor(input.sources||[]);if(!anchor)return issues;
 const scenes=story.scenes||[],index=scenes.length-1,scene=scenes[index];if(!scene)return issues;
 const atEvent=new RegExp('第('+digits+')(?:次|节)'+anchor.eventUnit+'(?:[^。！？；]{0,10})(?:结束|完成|那晚|当晚|晚上)');
 const sequence=calendarActivitySequence(input.sources||[]),last=sequence?.occurrences.at(-1);
 const eventAt=s=>{const text=String(s),m=text.match(atEvent);if(m&&number(m[1])===anchor.eventOrdinal)return true;
  const calendar=text.match(new RegExp('('+digits+')月的?第('+digits+')(?:次|节)'+anchor.eventUnit));
  return Boolean(last&&last.ordinal===anchor.eventOrdinal&&calendar&&number(calendar[1])===last.month&&number(calendar[2])===last.withinMonth);
 };
 let current=Boolean(eventAt(scene.title))||(anchor.kind==='same_evening_letter'&&!/回忆|回想|想起|上周|以前|当年|去年/.test(scene.title)),anchorQuote=current?scene.title:null;
 for(const quote of clauseList(scene.text)){
  if(isQuoted(quote))continue;
  if(/回忆|回想|想起|记起|记得/.test(quote)&&/(?:第[一二两三四五六七八九十\d]+(?:次|节)|上周|昨天|前天|以前|曾经|当年|去年)/.test(quote)){current=false;continue;}
  if(eventAt(quote)||/^(?:今晚|当晚|当天晚上|此刻)[，,]?/.test(quote)||/回到(?:今晚|当晚|眼前)|回过神|思绪.{0,4}(?:回来|拉回)/.test(quote)){current=true;anchorQuote=quote;}
  if(!current||!/(?:第二天|次日|翌日)(?:早上|清晨|早晨|上午)/.test(quote))continue;
  if(/如果|假如|假设|想象|设想|打算|计划|准备|希望|也许|可能|会不会|到时|明天|将会/.test(quote))continue;
  if(!/(?:了|已经|最终|我把|我又|被我)/.test(quote))continue;
  issues.push({field:'scenes.'+index+'.text',reason:'narration_cutoff_conflict',proof:{kind:'narration_cutoff',rule:{sourceRef:anchor.sourceRef,quote:anchor.quote},anchorQuote,quote,field:'scenes.'+index+'.text',calculation:'来信时点为指定活动结束当晚，正文却将随后早晨的动作叙述为已经发生'}});
 }
 return issues.slice(0,2);
}

// Reject only a direct date/ordinal assertion exceeding the number possible by
// that calendar month. Low ordinals can be monthly numbering or recollection.
export function calendarOrdinalIssues(story,input){
 const sequence=calendarActivitySequence(input.sources||[]);if(!sequence)return [];
 const out=[];
 for(const [i,scene] of (story.scenes||[]).entries())for(const quote of clauseList(scene.text)){
  if(isQuoted(quote)||/如果|假如|计划|打算|回忆|回顾|想起|记得|例如|比如/.test(quote))continue;
  const pattern=new RegExp('(?:(\\d{4})年)?('+digits+')月(?:'+digits+'(?:日|号))?(?:是|的)?第('+digits+')(?:次|节)(?:课|上课)','g');
  for(const m of quote.matchAll(pattern)){
   const month=number(m[2]),ordinal=number(m[3]),possible=sequence.occurrences.filter(x=>x.month===month&&(!m[1]||x.year===+m[1]));
   if(!possible.length||ordinal==null)continue;const max=possible.at(-1).ordinal;
   if(ordinal>max)out.push({field:'scenes.'+i+'.text',reason:'calendar_ordinal_conflict',proof:{kind:'calendar_ordinal',rule:{quote:sequence.frequencyQuote,sourceRefs:sequence.sourceRefs},rangeQuote:sequence.rangeQuote,totalQuote:sequence.totalQuote,quote,field:'scenes.'+i+'.text',expectedMaximum:max,observedOrdinal:ordinal,calculation:month+'月按原话频率最多累计'+max+'次；正文明确第'+ordinal+'次'}});
  }
 }return out.slice(0,2);
}
