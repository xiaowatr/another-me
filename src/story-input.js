import {hardQuestion} from './input-anchors.js';
﻿// Small, deterministic optional prompts. No model request and no future-life planning.
const rules=[
 {id:'missing-event',match:/^(?:那时|那时候|当时|那年|那次|以前|后悔|不知道)[。！…\s]*$/,known:/$a/,question:'当时具体发生了什么事？',options:['说不清']},
 {id:'relationship-feeling',match:/(拒绝|没答应|没有答应|婉拒).{0,18}(追求|表白|他|她)|(?:追求|表白).{0,20}(拒绝|没答应|没有答应)/,known:/喜欢|心动|没有.{0,6}感觉|没感觉|不喜欢|害怕|担心|犹豫|舍不得|说不清|没想清/,question:'当时，你对这个人是什么感觉？',options:['有些心动','还没有想清楚','没有恋爱的感觉']},
 {id:'opportunity-condition',match:/(没能|没有机会|没去成|没能去|放弃).{0,15}(学习|学舞蹈|留学|读书|工作|报考)|(?:学习|留学|读书|工作|报考).{0,15}(没去成|放弃)/,known:/因为|由于|没钱|费用|经济|家人|照顾|身体|成绩|分数|没有录取|不敢|担心|不喜欢|以.{1,12}为由/,question:'当时，主要是什么让这件事没能继续？',options:['条件或机会不允许','自己还拿不定主意','有别的事更需要顾及']},
 {id:'move-feeling',match:/(留在|没有离开|没离开|没搬|没有搬)/,known:/因为|喜欢|舍不得|担心|害怕|照顾|家人|费用|工作|说不清/,question:'当时留下来，对你最重要的是什么？',options:['熟悉的人与生活','当时的现实条件','还没有想好要不要离开']}
];
export function optionalFollowup(b){
 try{const hard=hardQuestion(b);if(hard)return hard;if(b.followupKey || b.followupAnswer || b.followupSkipped || !b.realityOutcome?.trim() || !b.hypotheticalDirection?.trim())return null;
 if(/未来|尚未|还未/.test(b.hypotheticalDirection+' '+b.realityOutcome)||/(?:最后|最终)(?:我)?(?:没有|没|并未)出发/.test(b.realityOutcome))return null;
 const text=[b.realityOutcome,b.choiceReason,b.details,b.feelings,b.why,b.reason].filter(Boolean).join(' ');
 const rule=rules.find(r=>r.match.test(text)&&!r.known.test(text));return rule?{id:rule.id,question:rule.question,options:[...new Set([...rule.options,'说不清'])]}:null;
 }catch{return null;}
}
export function savedFollowup(b){const r=rules.find(r=>r.id===b.followupKey);const text=[b.realityOutcome,b.details,b.feelings,b.why,b.reason].filter(Boolean).join(' ');return r && r.match.test(text) && (b.followupAnswer || !r.known.test(text))?{...r,options:[...new Set([...r.options,'说不清'])]}:null;}
// Classify only explicit linguistic markers. Unmarked supplements remain unclassified.
export function timelineInput(b){
 const result={atFork:{eventAndMotivation:[],reportedSpeech:[],feelings:[]},imagined:{direction:b.hypotheticalDirection ?? b.alternative ?? '',explicitPremises:[],considerations:[]},realityLater:[],unclassifiedSupplement:[]};
 const add=(text,fromEvent)=>{for(const clause of (text||'').split(/(?<=[。！？；\n])|(?=现实(?:中)?(?:后来|之后|最终))|(?=(?:这次|这条平行人生|在平行人生里))/).map(s=>s.trim()).filter(Boolean)){
  if(/^(?:而|但|不过)?现实(?:中)?(?:后来|之后|最终)|^(?:现实后续|现实里后来)/.test(clause))result.realityLater.push(clause);
  else if(/(?:如果|假如|要是|倘若|假设).{1,100}(?:可能|会|想|希望|愿意)/.test(clause))result.imagined.considerations.push(clause);
  else if(/^(?:这次|这条平行人生|在平行人生里|希望这次|假设|只写|仅写|只看|不设定|不要改|不改变)/.test(clause))result.imagined.explicitPremises.push(clause);
  else if(/^(?:当时)?(?:他|她|对方)(?:说|曾说|答应|承诺)/.test(clause))result.atFork.reportedSpeech.push(clause);
  else (fromEvent?result.atFork.eventAndMotivation:result.unclassifiedSupplement).push(clause);
 }};
 add(b.realityOutcome ?? b.choice,true);add(b.details,false);
 if(!b.followupSkipped && b.followupAnswer && b.followupAnswer!=='说不清' && (b.followupKey==='model' || savedFollowup(b)))result.atFork.feelings.push({question:b.followupQuestion || '',answer:b.followupAnswer});
 if(b.choiceReason?.trim())result.atFork.eventAndMotivation.push(b.choiceReason.trim());
 return result;
}
export function archiveName(life){
 if(life.name?.trim())return life.name.trim();
 if(life.story?.title?.trim()&&!/平行世界的另一种可能|未命名/.test(life.story.title))return life.story.title.trim();
 const b=life.background||{};const when=b.forkAge?b.forkAge+'岁，':b.forkYear?b.forkYear+'年，':'';
 const direction=(b.hypotheticalDirection||b.alternative||'').replace(/^(如果|假如)(当时|那时)?[，,]?/,'').replace(/^(这次|我想|想看看)/,'').trim();
 return direction?(when+direction).slice(0,36):life.story?.title || '未命名的故事';
}
