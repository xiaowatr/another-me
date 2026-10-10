// Small contextual text-question slots, sharing the existing pages/answers/eight-question budget.
export const KEY_QUESTION_BY_ID=Object.fromEntries(Array.from({length:8},(_,i)=>{const id='K'+(i+1);return [id,{id,question:'请补充这次选择所需的这处背景。',kind:'text',options:[],group:'critical:'+id,purpose:'仅澄清本次故事的关键背景；未答保持未知'}];}));
const bounded=(s,n)=>typeof s==='string'&&s.trim()&&s.length<=n;
export function validCriticalGap(g){return g&&/^[a-z][a-z0-9_-]{0,47}$/.test(g.key||'')&&bounded(g.missingInformation,200)&&bounded(g.whyMissing,200)&&bounded(g.useInStory,240)&&bounded(g.sourceId,80)&&bounded(g.evidence,500)&&(!g.questionText||bounded(g.questionText,180))&&(!g.questionId||KEY_QUESTION_BY_ID[g.questionId]||/^[A-Z][0-9]{2}$/.test(g.questionId))&&(!g.blocksStory||g.blocksStory==='actor_or_choice');}
export function mergeCriticalGaps(existing,incoming,sources){
 const map=new Map(sources.map(x=>[x.id,String(x.text)])),items=new Map();
 for(const g of [...(Array.isArray(existing)?existing:[]),...(Array.isArray(incoming)?incoming:[])]){
  if(!validCriticalGap(g)||!map.get(g.sourceId)?.includes(g.evidence))continue;
  const old=items.get(g.key);if(!old&&items.size>=8)continue;
  const resolution=g.resolvedBy&&bounded(g.resolvedBy.evidence,500)&&map.get(g.resolvedBy.sourceId)?.includes(g.resolvedBy.evidence)?{sourceId:g.resolvedBy.sourceId,evidence:g.resolvedBy.evidence}:undefined;
  const next={key:g.key,missingInformation:g.missingInformation,whyMissing:g.whyMissing,useInStory:g.useInStory,sourceId:g.sourceId,evidence:g.evidence,...(g.questionText?{questionText:g.questionText}:{}),...(g.questionId?{questionId:g.questionId}:{}),...(g.blocksStory?{blocksStory:g.blocksStory}:{})};
  if(old?.questionId){next.questionId=old.questionId;next.questionText=old.questionText;}
  if(resolution)next.resolvedBy=resolution;else if(old?.resolvedBy&&map.get(old.resolvedBy.sourceId)?.includes(old.resolvedBy.evidence))next.resolvedBy=old.resolvedBy;items.set(g.key,next);
 }return [...items.values()];
}
export function criticalGapStatus(g,state,answerText,isUnknown){
 const a=g.questionId&&state.answers?.[g.questionId],text=answerText(a);
 if(a?.skipped||isUnknown(text))return {...g,status:'skipped',asked:Boolean(state.shown?.includes(g.questionId)),answer:null};
 if(text)return {...g,status:'answered',asked:true,answer:{questionId:g.questionId,text,selected:a.selected||[],answerContext:state.answerScopes?.[g.questionId]||null}};
 const confirmed=(state.confirmationContexts||[]).find(x=>x.gapKeys?.includes(g.key)&&x.question===g.questionText),index=confirmed?.sourceIndex;
 if(confirmed&&Number.isInteger(index)&&state.confirmations?.[index]?.trim()&&!isUnknown(state.confirmations[index]))return {...g,status:'answered',asked:true,answer:{sourceId:'confirmation:'+index,text:state.confirmations[index]}};
 if(g.resolvedBy)return {...g,status:'unconfirmed',asked:Boolean(state.shown?.includes(g.questionId)),answer:null};
 return {...g,status:state.plan?.optionalAnalysisUnavailable?'analysis_unavailable':state.skippedRemaining?'skipped':state.shown?.includes(g.questionId)?'unanswered':'unasked',asked:Boolean(state.shown?.includes(g.questionId)),answer:null};
}
export function settingRecord(background,state,sources,answerText,isUnknown){
 const gaps=mergeCriticalGaps(state.criticalUnknowns?.length?state.criticalUnknowns:state.plan?.criticalUnknowns,[],sources).map(g=>criticalGapStatus(g,state,answerText,isUnknown));
 return {factsAndConstraints:sources.filter(s=>!['hypotheticalDirection','mbti'].includes(s.id)).map(s=>({sourceId:s.id,text:s.text,scope:'用户原话证据；结合原句区分现实、约束与愿望，不把全文都视为已发生'})),parallelAssumption:{sourceId:'hypotheticalDirection',text:background.hypotheticalDirection||'',scope:'用户指定改变，只在平行线中成立'},criticalBackground:gaps,creativeSpace:['由明确假设支持的普通场景、动作与现场对话；未确认的原课程、原老师或中断经历保持未知；不新增家人参与、家庭构成、关键身份或重大背景'],unknownPolicy:'关键背景未得到明确答案时保持未知，使用不依赖它的情节；跳过、分析失败或问题结束都不是创作许可。answered仅表示有原话回答，仍须按其实际含义理解，不能把含糊回答视为确定事实。'};
}
