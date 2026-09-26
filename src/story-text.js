// Model display only: decode a bounded set of text formatting; never interpret HTML.
const entities={nbsp:' ',quot:'"',apos:"'",amp:'&',lt:'<',gt:'>',hellip:'…',mdash:'—',ndash:'–',ldquo:'“',rdquo:'”',lsquo:'‘',rsquo:'’'};
export function storyText(value){let text=String(value??'').replace(/^\uFEFF/,'');
 text=text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(whole,key)=>{if(key[0]!=='#')return entities[key.toLowerCase()]??whole;const n=key[1]?.toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));return Number.isInteger(n)&&n>=32&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)&&!(n>=127&&n<=159)&&n!==0xfffd?String.fromCodePoint(n):whole;});
 return text.replace(/<think\s*>[\s\S]*?<\/think\s*>/gi,'').replace(/<br\s*\/?>|&lt;br\s*\/?&gt;|<\/?(?:p|div)\s*>/gi,'\n').replace(/<\/?(?:strong|em|b|i)\s*>/gi,'').replace(/\*\*([^*\n]+)\*\*/g,'$1').replace(/^#{1,6}[ \t]+(?=\S)/gm,'');
}
export function storyParagraphs(value){return storyText(value).split(/\r?\n+/).map(p=>p.trim()).filter(Boolean);}
