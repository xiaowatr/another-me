// Deliberately narrow, local check. Explicit night classes/remote or private practice are allowed.
export function dailyLifeIssue(text,background={}){
 const supplied=Object.values(background).filter(v=>typeof v==='string').join('。');
 for(const sentence of String(text||'').split(/[。！？\n]/)){
  if(!/(?:后半夜|凌晨[一二三四五六1-6](?:点|时))[^。！？]{0,28}(?:就|再|然后)?(?:去|赶去|赶到)[^。！？]{0,12}(?:上|上一节|参加)[^。！？]{0,10}(?:舞蹈|现代舞|芭蕾|瑜伽|钢琴)课/.test(sentence))continue;
  if(/没能|没有|赶不上|无法|没法|不能|不可能|已经关门/.test(sentence))continue;
  if(/(?:深夜|凌晨|通宵|夜间|24小时).{0,12}(?:专场|课程|排练|预约|授课)|线上|网课|录播|在家|自己练/.test(sentence+'。'+supplied))continue;
  return 'unsupported_overnight_class';
 }
 return null;
}
