import {supplementState,supplementKey} from '../src/supplementary.js';
import {normalizeScenarioAnalysis,scenarioKey} from '../src/scenario-context.js';
import {generationSetting} from '../src/effective-setting.js';

// Organize existing evidence; do not infer facts or parse new free-text constraints.
export function generationInput(c){
 const b=c.original,p=c.personalization,state=supplementState(b),sources=[];
 const add=(id,text,scope,extra={})=>{if(typeof text==='string'&&(text.trim()||extra.selected?.length))sources.push({id,text,scope,...extra});};
 const ordinary=(p.answers||[]).filter(a=>!a.answerContext||(a.answerContext.realityOutcome===b.realityOutcome&&a.answerContext.hypotheticalDirection===b.hypotheticalDirection));
 add('realityOutcome',b.realityOutcome,'现实事件与结果的对照，不搬成平行角色已经发生的结果');
 add('hypotheticalDirection',b.hypotheticalDirection,'用户指定的平行变化；愿望与条件仍按原句理解');
 for(const id of ['birthYear','forkAge','locationText','gender','mbti','lifeSituation','choiceReason','details'])add(id,b[id],id==='details'?'未分类的补充原话；逐句区分事实、限制、愿望和未知，不将整段当事实':'用户对应表单原话，不外推经历或身份');
 for(const a of ordinary)add(a.id,a.text||'','本次普通回答；愿望、行为倾向、限制与经历须按原话区分',{selected:a.selected||[]});
 for(const [i,text]of (p.confirmations||[]).entries())add('confirmation:'+i,text,'本次冲突确认；只修正对应内容，不覆盖无关事实');
 add('extra',p.extra,'本次补充要求，按原话理解');
 const latest=p.latestConfirmation||{question:'',answer:'',skipped:false};
 if(!latest.skipped)add('followupAnswer',latest.answer,'最新确认回答，明确纠正优先');
 const refs=id=>sources.some(s=>s.id===id)?[id]:[];
 const scopedIds=new Set(ordinary.map(a=>a.id));
 const gaps=(p.settingRecord?.criticalBackground||[]).map(g=>{
  const answer=g.answer,answerId=answer?.questionId||answer?.sourceId;
  const active=answerId&&sources.some(s=>s.id===answerId&&[...(s.selected||[]),s.text].filter(Boolean).join('；').includes(answer.text));
  return {key:g.key,questionId:g.questionId||null,missingInformation:g.missingInformation,useInStory:g.useInStory,question:g.questionText||null,status:g.status==='answered'&&!active?'unconfirmed':g.status,sourceRef:g.sourceId,evidence:g.evidence,...(active?{answerRef:answerId,answerQuote:answer.text}:{})};
 });
 const skipped=(p.skipped||[]).filter(id=>!state.answerScopes?.[id]||(state.answerScopes[id].realityOutcome===b.realityOutcome&&state.answerScopes[id].hypotheticalDirection===b.hypotheticalDirection)).map(id=>({id,status:'skipped',question:state.questionMeta?.[id]?.questionText||null}));
 const g=generationSetting(c),t=g.temporal;
 const start=t.start?{year:t.start.estimated?null:t.start.year,month:t.start.month,...(t.start.day?{day:t.start.day}:{}),sourceRef:t.start.field||null,estimated:Boolean(t.start.estimated)}:null;
 let window=t.window?{months:t.window.months,...(t.window.weeks?{weeks:t.window.weeks}:{}),anchor:t.window.anchor,start:t.window.start,end:t.window.end,precision:t.window.precision,sourceRefs:[...new Set((t.window.sources||[]).map(s=>s.field.replace(/^supplementary\./,'')))]}:null;
 if(window&&window.sourceRefs.some(id=>!sources.some(s=>s.id===id)))window=null;
 if(window&&(t.start?.estimated||window.precision==='unknown-month'))window={...window,start:t.start?.estimated?null:window.start,end:null,calendarBoundsKnown:false};
 const sc=state.scenario,analysis=sc&&sc.scopeKey===supplementKey(b)&&!sc.skipped&&sc.analysis?.key===scenarioKey(sc)?normalizeScenarioAnalysis(sc.analysis,sc):null;
 const behavior=(p.behaviorReferences||[]).map((r,i)=>({...r,source:{id:sc?.id,evidence:analysis?.considerations[i]?.evidence,conditionEvidence:analysis?.considerations[i]?.conditionEvidence}})).filter(r=>r.source.evidence);
 const expressionRefs=sources.filter(s=>s.text.trim()&&(['realityOutcome','hypotheticalDirection','details','choiceReason','extra','followupAnswer'].includes(s.id)||s.id.startsWith('confirmation:')||scopedIds.has(s.id))).map(s=>s.id);
 return {title:'本次设定与约束',version:2,sources,
  reality:{eventReferenceRefs:refs('realityOutcome'),providedBackgroundRefs:['birthYear','forkAge','locationText','gender','lifeSituation','choiceReason','details'].flatMap(refs),meaning:'这里的原话仍有事实、愿望与限制之别；程序不作完整语义判定'},
  parallel:{roleGender:c.roleGender,changeRefs:refs('hypotheticalDirection'),operation:c.operation,eventFacts:c.facts,retained:c.retained,priorityRefs:[...refs('followupAnswer'),...sources.filter(s=>s.id.startsWith('confirmation:')).map(s=>s.id)]},
  constraints:{observation:{start,window,rawRange:c.timeRange,sourceRefs:refs('hypotheticalDirection')},frequencyAndOtherLimitRefs:['hypotheticalDirection','details',...ordinary.map(a=>a.id),'extra',...sources.filter(s=>s.id.startsWith('confirmation:')).map(s=>s.id),'followupAnswer'].flatMap(refs),totalCount:null,totalCountPolicy:'当前没有已验证的结构化频率及完整周期字段，不从自由文本强算总数；直接遵守来源原句'},
  unknownBackground:{critical:gaps,skipped,latestConfirmation:{question:latest.question,skipped:latest.skipped,answerRefs:latest.skipped?[]:refs('followupAnswer')},choiceReasonKnown:refs('choiceReason').length>0},
  behaviorAndLanguage:{ordinaryAnswers:ordinary.filter(a=>scopedIds.has(a.id)).map(a=>({sourceRef:a.id,question:a.question,purpose:a.purpose})),scenarioBehavior:behavior,expressionSourceRefs:expressionRefs,mbti:g.style.mbti},
  fixedDisplay:fixedStoryIdentity(c)};
}
export function fixedStoryIdentity(c){
 const location=c.coordinates.locationAtFork;
 return {identity:['另一个自己',...(location?['当时所在地或环境：'+location]:[])].join(' · '),basis:location?['产品本人主角定义','locationText']:['产品本人主角定义']};
}
export function fillStoryIdentity(story,c){return {...story,identity:fixedStoryIdentity(c).identity};}
