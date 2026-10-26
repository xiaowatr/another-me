// Product identities are fixed; they are not missing user background.
export const STORY_PARTICIPANTS={protagonist:'real_user',narrator:'alternate_self',recipient:'real_user',relationship:'fictional_correspondence',priorContact:'not_assumed'};
export function unsupportedQuestionReason(text){
 const s=String(text||'');
 if(/(?:主角|主人公).{0,12}(?:谁|哪[个位])|(?:谁|哪[个位]).{0,12}(?:主角|主人公)/.test(s))return 'fixed_protagonist';
 if(/(?:信|来信|回信).{0,18}(?:写给谁|给谁写)|收信[人者].{0,8}(?:谁|哪[个位])/.test(s))return 'fixed_recipient';
 if(/另一个(?:自己|我)|平行(?:世界|人生)?[里中]?(?:的)?(?:自己|我)/.test(s)&&/(?:平时|以前|过去|之前|一直|通常).{0,12}(?:交流|沟通|相处|联系|来往|聊天|见面)/.test(s))return 'imagined_prior_contact';
 return null;
}
export const retiredCriticalGap=g=>g?.blocksStory==='actor_or_choice'||Boolean(unsupportedQuestionReason(g?.questionText));
// Reading old drafts retires obsolete questions without fabricating an answer or deleting evidence.
export function retireUnsupportedQuestions(state){
 const rejected=new Set((state.criticalUnknowns||state.plan?.criticalUnknowns||[]).filter(retiredCriticalGap).map(g=>g.questionId).filter(Boolean));
 for(const [id,q] of Object.entries(state.questionMeta||{}))if(unsupportedQuestionReason(q.displayedQuestionText||q.questionText))rejected.add(id);
 const conflict=state.plan?.conflict,retired=conflict&&(conflict.kind==='critical_background'||unsupportedQuestionReason(conflict.question));
 if(!retired&&!rejected.size)return state;
 const pages=(state.pages||[]).map(ids=>ids.filter(id=>!rejected.has(id)));
 const questions=(state.plan?.questions||[]).filter(q=>!rejected.has(q.id)&&!unsupportedQuestionReason(q.questionText));
 return {...state,pages,...(state.plan?{plan:{...state.plan,questions,...(retired?{conflict:null}:{}),stop:questions.length===0}}:{}),uiReady:!pages[state.page]?.length&&!questions.length};
}
