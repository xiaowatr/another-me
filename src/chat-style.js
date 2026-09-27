import {supplementaryContext} from './supplementary.js';
// Preserve evidence and scope; do not infer intent or personality with keyword switches.
export function chatStyle(background={},context={},message='',history=[]){
 const p=supplementaryContext(background);
 const sources=[
  ...(context.preferences||[]).filter(m=>m.sourceRole!=='assistant').map(m=>({source:'confirmedPreference',text:m.text})),
  ...['realityOutcome','hypotheticalDirection','choiceReason','lifeSituation','details'].filter(k=>background[k]).map(k=>({source:k,text:background[k]})),
  ...(!background.followupSkipped&&background.followupAnswer?[{source:'clarification',text:background.followupAnswer}]:[]),
  ...p.answers.map(a=>({source:'ordinaryAnswer:'+a.id,question:a.question,answerContext:a.answerContext,selected:a.selected,text:a.text})),
  ...(p.extra?[{source:'supplementExtra',text:p.extra}]:[]),
  ...p.confirmations.map(text=>({source:'confirmation',text})),
  ...history.filter(m=>m.role==='user').map(m=>({source:'recentUser',text:m.content})).slice(-8),
  {source:'currentUser',text:message}
 ];
 return {communicationSources:sources,mbtiHint:/^[IE][NS][FT][JP]$/.test(background.mbti||'')?background.mbti:null,
 scope:'逐条按完整语境理解交流意愿和表达证据；来源包含事实、偏好、引语，不意味着每项都是对角色的要求。最新明确要求优先，引用别人的话不当本人指令；普通回答保留适用背景。点选不等于用户措辞，MBTI不推断人格或覆盖原话。',
 priority:'本轮明确意愿＞仍适用的已确认偏好和原话＞表达示范。先辨明这句话在问谁的什么、想听什么，再回应；不要按关键词选择语气或道歉对象。'};
}
