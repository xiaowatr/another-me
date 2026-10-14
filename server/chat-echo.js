import {AppError} from './core.js';

const MIN_ECHO_CHARS=12;
const REWRITE_ATTEMPTS=2;
const MAX_REWRITE_CALLS=2;
const TIME_ANCHOR=/(?:今天|今晚|今早|昨天|昨晚|明天|明晚|早上|上午|中午|下午|傍晚|晚上|夜里|半夜|凌晨|周[一二三四五六日天1-7]|星期[一二三四五六日天1-7]|每(?:天|晚|周|月|年)|\d+(?:年|月|日|号|点|时|分|秒|天|周|个月|岁|次))/gu;

const normalized=text=>String(text||'').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');

function longestCommonRun(a,b){
 if(!a||!b)return 0;
 let previous=new Uint16Array(b.length+1),best=0;
 for(let i=1;i<=a.length;i++){
  const current=new Uint16Array(b.length+1);
  for(let j=1;j<=b.length;j++)if(a[i-1]===b[j-1]){current[j]=previous[j-1]+1;if(current[j]>best)best=current[j];}
  previous=current;
 }
 return best;
}

export function directEchoMatch(sentence,source){
 const reply=normalized(sentence),user=normalized(source);
 if(reply.length<MIN_ECHO_CHARS||user.length<MIN_ECHO_CHARS)return false;
 const common=longestCommonRun(reply,user);
 return common>=MIN_ECHO_CHARS&&common/reply.length>=0.68;
}

export function splitChatSentences(reply){
 return String(reply||'').match(/[^。！？!?\n]+[。！？!?]?|\n+/g)||[];
}

export function directEchoes(reply,userTexts){
 const sources=userTexts.filter(x=>typeof x==='string'&&normalized(x).length>=MIN_ECHO_CHARS);
 return splitChatSentences(reply).map((text,index)=>({text,index,source:sources.find(source=>directEchoMatch(text,source))})).filter(x=>x.source);
}

export function protectedRewriteAnchors(sentence){
 return [...new Set(String(sentence||'').match(TIME_ANCHOR)||[])];
}

export function chatEchoRewriteMessages({sentence,currentMessage,source,previous,next,retryReason=null}){
 const anchors=protectedRewriteAnchors(sentence);
 return [
  {role:'system',content:'你只修复一条角色聊天句子。只输出可直接替换原句的新句子，不解释、不加标签、不引用原句。保留原句要回应的意思、已知事实、说话人、时间、频率和数字；mustPreserveAnchors中的词必须原样保留，不能新增相冲突的时间。换成角色自己的自然回应，并加入真实态度或信息推进。不得直接复述现实用户原话，也不要重复相邻句已经表达的意思；不新增人物、经历、承诺、诊断或提问。相邻句只用于衔接，不能改写。'},
  {role:'user',content:JSON.stringify({sentenceToRewrite:sentence,directlyCopiedFrom:source,currentUserMessage:currentMessage,mustPreserveAnchors:anchors,previousSentence:previous||null,nextSentence:next||null,...(retryReason?{previousAttemptRejectedBecause:retryReason}: {})})}
 ];
}

function withEnding(candidate,original){
 const ending=String(original).match(/[。！？!?]+\s*$/)?.[0]?.trim();
 return ending&&!/[。！？!?]\s*$/.test(candidate)?candidate+ending:candidate;
}

function echoFallback(index){
 return index%2===0?'我在认真听。':'这件事我们可以慢慢说。';
}

export async function rewriteDirectEchoes(caller,{reply,currentMessage,history=[],signal,parentRequestId=null}){
 const userTexts=[currentMessage,...history.filter(x=>x?.role==='user').slice(-3).map(x=>x.content)];
 const parts=splitChatSentences(reply),matches=directEchoes(reply,userTexts);
 if(!matches.length)return {reply,rewrites:0,requestIds:[]};
 const requestIds=[];let rewriteCalls=0,fallbacks=0;
 for(const match of matches){
  const required=protectedRewriteAnchors(match.text);let replacement='',retryReason=null;
  for(let attempt=1;attempt<=REWRITE_ATTEMPTS&&rewriteCalls<MAX_REWRITE_CALLS;attempt++){
   rewriteCalls++;
   let streamed='';
   const response=await caller.call('chat',chatEchoRewriteMessages({sentence:match.text,currentMessage,source:match.source,previous:parts[match.index-1],next:parts[match.index+1],retryReason}),{
    chatEnvelope:true,plainChatReply:true,requireStructuredChat:false,chatRewrite:'direct_echo',chatAttempt:attempt,parentRequestId,signal,
    onText:text=>{streamed+=text;},validateResult:()=>{}
   });
   requestIds.push(response.requestId||null);parentRequestId=response.requestId||parentRequestId;
   const candidate=withEnding((response.result?.reply||streamed).trim(),match.text),candidateAnchors=protectedRewriteAnchors(candidate);
   if(!candidate||candidate.length>800)retryReason='回复为空或过长';
   else if(userTexts.some(source=>directEchoMatch(candidate,source)))retryReason='仍然直接复述了用户原话';
   else if(required.some(anchor=>!candidate.includes(anchor))||candidateAnchors.some(anchor=>!required.includes(anchor)))retryReason='时间、频率或数字锚点发生变化';
   else{replacement=candidate;break;}
  }
  if(!replacement){replacement=echoFallback(match.index);fallbacks++;}
  parts[match.index]=replacement;
 }
 const rewritten=parts.join('');
 if(directEchoes(rewritten,userTexts).length)throw new AppError('invalid_response',502,{stage:'business',reason:'chat_echo_unresolved'});
 return {reply:rewritten,rewrites:matches.length,requestIds,fallbacks};
}
