// Only explicit frequency/totals or an ordinal tied to the observation window.
// Scenes, captions and unlabelled lists are never a complete attendance record.
const digits='[一二两三四五六七八九十\\d]+';
const number=s=>{if(/^\d+$/.test(s))return Number.isSafeInteger(Number(s))?Number(s):null;if(!/^(?:[一二两三四五六七八九]?十[一二三四五六七八九]?|[一二两三四五六七八九])$/.test(s))return null;const units={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};if(s==='十')return 10;if(s.includes('十')){const [a,b]=s.split('十');return (a?units[a]:1)*10+(b?units[b]:0);}return units[s]??null;};
// Exact wording variants share one parser; preserve the original quote for provenance.
const exactRate='每(?:个)?(月|周|天)(?:恰好|正好|固定)?(?:上课|参加|练习|去|上)?(?:恰好|正好|固定)?('+digits+')(?:次(?:课)?|节课)';
export function frequencyRule(value){
 const text=String(value),matches=[...text.matchAll(new RegExp(exactRate,'g'))];
 if(!matches.length||/(?:大约|约|左右|最多|至多|至少|缺席|不固定)/.test(text))return null;
 if(matches.some(m=>/^(?:以上|以下|以内|以外|上下|半|多|余)/.test(text.slice(m.index+m[0].length))||new RegExp('^(?:或(?:者)?|到|至|—|-)'+digits+'(?:次|节)').test(text.slice(m.index+m[0].length))))return null;
 if(matches.some(m=>number(m[2])==null)||new Set(matches.map(m=>m[1]+'|'+number(m[2]))).size!==1)return null;
 const match=matches[0];return {unit:match[1],count:number(match[2]),quote:match[0]};
}
const monthWindow=range=>{const match=String(range).match(new RegExp('('+digits+')(?:个)?月'));return match?number(match[1]):null;};
// A future/negative scope carries across commas until an explicit actual-time
// or factual correction resets it. It never disables unrelated later assertions.
const scopeBreak=/[，,。！？；\n]|但是|不过|然而|可是|但/g;
const blockedScope=/(?:从前|以前|过去|去年|原本|本来|如果|假如|要是|计划|打算|准备|想要|希望|以后|今后|将来|未来|明年|明天|下周|下(?:个)?月|不会|不再|并未|从未|未曾|不是|并非|没有|不曾|不打算|不准备|不想|大概|大约|也许|可能)/;
const actualStart=/^(?:(?:而|我(?:们)?|在)\s*)*(?:实际上|事实上|实际|确实|的确|已经|现在|如今|本月|这个月|这[一二两三四五六七八九十\d]*(?:个)?月(?:里|内|期间)?|今年|当晚)/;
function assertionPhrase(text,index){
 const breaks=[...text.matchAll(scopeBreak)],left=breaks.filter(m=>m.index<index).at(-1),right=breaks.find(m=>m.index>=index);
 return text.slice(left?left.index+left[0].length:0,right?.index??text.length);
}
// Newly separated assertions must not borrow another person's rate. Ambiguous
// subjects stay unproven; this is not a general actor or coreference parser.
function clearSubject(text,index){
 const prefix=text.slice(0,index).split(scopeBreak).at(-1).trim();
 return /^(?:我(?:们)?|在|现在|如今|实际上|事实上|实际|已经|确实|的确|本月|这个月|这[一二两三四五六七八九十\d]*(?:个)?月(?:里|内|期间)?|\s)*$/.test(prefix);
}
function asserted(text,index,end=index){
 let blocked=false,start=0,continuingScope=false;
 for(const m of text.matchAll(scopeBreak)){
  if(m.index>=index)break;
  const fragment=text.slice(start,m.index).trim();
  if(actualStart.test(fragment)&&(!continuingScope||/^(?:(?:我(?:们)?|在)\s*)*(?:实际上|事实上|实际|已经)/.test(fragment))){blocked=false;continuingScope=false;}
  if(blockedScope.test(fragment))blocked=true;
  if(/如果|假如|要是/.test(fragment)||/^(?:从)?(?:下(?:个)?月|下周|明天|明年|以后|将来)(?:起|开始)?$/.test(fragment))continuingScope=true;
  start=m.index+m[0].length;
 }
 const phrase=assertionPhrase(text,index).trim(),prefix=text.slice(start,index);
 if(actualStart.test(phrase)&&(!continuingScope||/^(?:(?:我(?:们)?|在)\s*)*(?:实际上|事实上|实际|已经)/.test(phrase)))blocked=false;
 if(blockedScope.test(prefix)||/(?:不|没|未)\s*$/.test(prefix))blocked=true;
 const suffix=text.slice(end).split(/[，,。！？；\n]/)[0];
 if(end>index&&/(?:并非事实|并不是事实|不是真的|只是(?:计划|打算)|是(?:下(?:个)?月|明年|未来).{0,12}(?:计划|打算))/.test(suffix))blocked=true;
 return !blocked;
}
function evidenceParts(e){
 if(typeof e?.quote!=='string')return [];
 // The explicit complete-record format may use semicolons between dates.
 if(new RegExp('^这?'+digits+'(?:个)?月(?:里|内|期间)?(?:的)?(?:全部|完整)(?:上课|课程|活动)记录[：:]').test(e.quote.trim()))return [e];
 return e.quote.split(/[。！？；\n]/).map(quote=>({...e,quote:quote.trim()})).filter(e=>e.quote);
}
export function frequencyProof(basis,evidence,range=''){
 const rule=frequencyRule(basis),months=monthWindow(range);if(!rule)return null;
 for(const e of evidence.flatMap(evidenceParts)){if(typeof e?.quote!=='string'||/^scenes\.\d+\.(?:time|title)$/.test(e.field||''))continue;const text=e.quote;
  const rates=[...text.matchAll(new RegExp(exactRate,'g'))].flatMap(m=>{
   const parsed=frequencyRule(assertionPhrase(text,m.index));
   return parsed&&parsed.quote===m[0]?[{unit:parsed.unit,count:parsed.count,index:m.index,end:m.index+m[0].length}]:[];
  });
  for(const m of text.matchAll(/每(?:个)?(月|周|天)都(?:去|参加|上课)/g))rates.push({unit:m[1],count:1,index:m.index,end:m.index+m[0].length});
  rates.sort((a,b)=>a.index-b.index);
  for(const rate of rates)if((rates.length===1||clearSubject(text,rate.index))&&asserted(text,rate.index,rate.end)){
   const actual=rate.count,ratio=rule.unit===rate.unit?1:rule.unit==='月'&&rate.unit==='周'?4:rule.unit==='月'&&rate.unit==='天'?28:rule.unit==='周'&&rate.unit==='天'?7:null;
   if(actual!=null&&ratio!=null&&(ratio===1?actual!==rule.count:actual*ratio>rule.count))return {kind:'explicit_frequency',rule,observed:{unit:rate.unit,count:actual},expectedCount:rule.count,observedCount:actual*ratio,calculation:ratio===1?`${actual} ≠ ${rule.count}`:`至少 ${actual} × ${ratio} > ${rule.count}`,quote:e.quote,field:e.field};
  }
  if(rule.unit!=='月'||months==null||/(?:大约|约|左右|最多|至少|缺席|不完整)/.test(String(range)))continue;
  const record=text.trim().match(new RegExp('^这?('+digits+')(?:个)?月(?:里|内|期间)?(?:的)?(?:全部|完整)(?:上课|课程|活动)记录[：:]([\\s\\S]+?)[。]?$'));
  if(record&&number(record[1])===months){
   const entries=record[2].replace(/。$/,'').split(/[、，,；;]/).map(x=>x.trim()),dates=entries.map(x=>x.match(/^(\d{4})年(\d{1,2})月(\d{1,2})[日号]$/));
   if(dates.every(Boolean)&&new Set(entries).size===entries.length){
    const stamps=dates.map(x=>Date.UTC(Number(x[1]),Number(x[2])-1,Number(x[3]))),valid=dates.every((x,i)=>{const d=new Date(stamps[i]);return d.getUTCFullYear()===Number(x[1])&&d.getUTCMonth()+1===Number(x[2])&&d.getUTCDate()===Number(x[3]);}),start=new Date(Math.min(...stamps));start.setUTCMonth(start.getUTCMonth()+months);
    if(valid&&new Set(stamps).size===stamps.length&&Math.max(...stamps)<=start.getTime()&&entries.length!==rule.count*months)return {kind:'explicit_complete_record',rule,months,expectedCount:rule.count*months,observedCount:entries.length,calculation:`${rule.count} × ${months} = ${rule.count*months}；正文明确完整记录共 ${entries.length} 次`,quote:e.quote,field:e.field};
   }
  }
  const directs=[...text.matchAll(new RegExp('('+digits+')(?:个)?月(?:里|内|期间)?[，,、：: ]*(?:一共|总共|总计|合计)?(?:上(?:了)?|去(?:了)?|参加(?:了)?)?('+digits+')(?:次|节)(?:课|活动|读书会)?','g'))];
  const totals=[...text.matchAll(new RegExp('(?:一共|总共|合计|总计)(?:去(?:了)?|上(?:了)?|参加(?:了)?)?('+digits+')(?:次|节)','g'))];
  const ordinals=[...text.matchAll(new RegExp('第('+digits+')次(?:上课|参加|去(?:上课|读书会)|活动|课)','g'))];
  // Only an explicit excess proves a single-month conflict; sampled months remain valid.
  for(const direct of directs)if((directs.length===1||clearSubject(text,direct.index))&&number(direct[1])===1&&number(direct[2])>rule.count&&/^(?:$|[，,。！？；、：:\s])/.test(text.slice(direct.index+direct[0].length))&&asserted(text,direct.index))return {kind:'explicit_month_total',rule,months:1,expectedCount:rule.count,observedCount:number(direct[2]),calculation:`1 × ${rule.count} = ${rule.count}；正文明确单月 ${number(direct[2])} 次`,quote:e.quote,field:e.field};
  const counts=[...directs.filter(m=>number(m[1])===months).map(m=>({match:m,actual:number(m[2]),kind:'explicit_window_total'})),...totals.map(m=>({match:m,actual:number(m[1]),kind:'explicit_total'}))];
  if(new RegExp('(?:这|本|在)?'+digits+'(?:个)?月(?:里|内|期间)').test(text)&&monthWindow(text)===months)counts.push(...ordinals.map(m=>({match:m,actual:number(m[1]),kind:'window_ordinal'})));
  for(const {match,actual,kind} of counts){
   if(actual==null||(counts.length>1&&!clearSubject(text,match.index))||!asserted(text,match.index))continue;
   const expected=rule.count*months;
   if(kind==='window_ordinal'?actual>expected:actual!==expected)return {kind,rule,months,expectedCount:expected,observedCount:actual,calculation:`${rule.count} × ${months} = ${expected}；正文明确${kind==='window_ordinal'?'至少':''} ${actual} 次`,quote:e.quote,field:e.field};
  }
 }
 return null;
}
export function provesFrequencyConflict(basis,evidence,range=''){return Boolean(frequencyProof(basis,evidence,range));}
