// Only explicit frequency/totals or an ordinal tied to the observation window.
// Scenes, captions and unlabelled lists are never a complete attendance record.
const digits='[一二两三四五六七八九十\\d]+';
const number=s=>{if(/^\d+$/.test(s))return Number.isSafeInteger(Number(s))?Number(s):null;if(!/^(?:[一二两三四五六七八九]?十[一二三四五六七八九]?|[一二两三四五六七八九])$/.test(s))return null;const units={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};if(s==='十')return 10;if(s.includes('十')){const [a,b]=s.split('十');return (a?units[a]:1)*10+(b?units[b]:0);}return units[s]??null;};
export function frequencyRule(text){const match=String(text).match(new RegExp('每(?:个)?(月|周|天)(?:参加|去|上课|练习)?('+digits+')次'));if(!match||number(match[2])==null||/(?:大约|约|左右|最多|至多|至少|缺席|不固定)/.test(String(text)))return null;return {unit:match[1],count:number(match[2]),quote:match[0]};}
const monthWindow=range=>{const match=String(range).match(new RegExp('('+digits+')(?:个)?月'));return match?number(match[1]):null;};
function asserted(text,index){return !/(?:以前|过去|去年|原本|本来|如果|假如|计划|打算|想要|不是|并非|没有)/.test(text.slice(0,index).split(/[。！？；\n]/).at(-1));}
export function frequencyProof(basis,evidence,range=''){
 const rule=frequencyRule(basis),months=monthWindow(range);if(!rule)return null;
 for(const e of evidence){if(typeof e?.quote!=='string'||/^scenes\.\d+\.(?:time|title)$/.test(e.field||''))continue;const text=e.quote;
  const rate=text.match(new RegExp('每(?:个)?(月|周|天)(?:参加|去|上课|练习)?(?:('+digits+')次|都(?:去|参加|上课))'));
  if(rate&&asserted(text,rate.index)){
   const actual=rate[2]?number(rate[2]):1,ratio=rule.unit===rate[1]?1:rule.unit==='月'&&rate[1]==='周'?4:rule.unit==='月'&&rate[1]==='天'?28:rule.unit==='周'&&rate[1]==='天'?7:null;
   if(actual!=null&&ratio!=null&&(ratio===1?actual!==rule.count:actual*ratio>rule.count))return {kind:'explicit_frequency',rule,observed:{unit:rate[1],count:actual},expectedCount:rule.count,observedCount:actual*ratio,calculation:ratio===1?`${actual} ≠ ${rule.count}`:`至少 ${actual} × ${ratio} > ${rule.count}`,quote:e.quote,field:e.field};
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
  const direct=text.match(new RegExp('('+digits+')(?:个)?月(?:里|内|期间)?[，,、：: ]*(?:一共|总共|总计|合计)?(?:上(?:了)?|去(?:了)?|参加(?:了)?)?('+digits+')(?:次|节)(?:课|活动|读书会)?'));
  const total=text.match(new RegExp('(?:一共|总共|合计|总计)(?:去(?:了)?|上(?:了)?|参加(?:了)?)?('+digits+')(?:次|节)'));
  const ordinal=text.match(new RegExp('第('+digits+')次(?:上课|参加|去(?:上课|读书会)|活动|课)'));
  // A single-month explicit total is bounded by the monthly rule even in a longer observation.
  // Only an excess proves conflict; an unfinished/sampled month is not a deficient total.
  if(direct&&number(direct[1])===1&&number(direct[2])>rule.count&&/^(?:$|[，,。！？；、：:\s])/.test(text.slice(direct.index+direct[0].length))&&asserted(text,direct.index))return {kind:'explicit_month_total',rule,months:1,expectedCount:rule.count,observedCount:number(direct[2]),calculation:`1 × ${rule.count} = ${rule.count}；正文明确单月 ${number(direct[2])} 次`,quote:e.quote,field:e.field};
  let match,actual,kind;
  if(direct&&number(direct[1])===months){match=direct;actual=number(direct[2]);kind='explicit_window_total';}
  else if(total){match=total;actual=number(total[1]);kind='explicit_total';}
  else if(ordinal&&new RegExp('(?:这|本|在)?'+digits+'(?:个)?月(?:里|内|期间)').test(text)&&monthWindow(text)===months){match=ordinal;actual=number(ordinal[1]);kind='window_ordinal';}
  if(!match||actual==null||!asserted(text,match.index))continue;
  const expected=rule.count*months;
  if(kind==='window_ordinal'?actual>expected:actual!==expected)return {kind,rule,months,expectedCount:expected,observedCount:actual,calculation:`${rule.count} × ${months} = ${expected}；正文明确${kind==='window_ordinal'?'至少':''} ${actual} 次`,quote:e.quote,field:e.field};
 }
 return null;
}
export function provesFrequencyConflict(basis,evidence,range=''){return Boolean(frequencyProof(basis,evidence,range));}
