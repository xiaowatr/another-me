import {ACTIVE_QUESTION_BANK} from '../src/question-bank.js';
import {questionTitle} from '../src/question-context.js';
// Use the same field name in ordinary question inputs and outputs; never mutate the saved bank.
export function modelQuestionBank(){return ACTIVE_QUESTION_BANK.map(({id,question,kind,options,group,when,skip,purpose,personalDetail,answerKind})=>({id,questionText:question,kind,...(options?.length?{options}:{}),group,when,skip,purpose,...(personalDetail?{personalDetail}:{}),answerKind}));}
export function resolveQuestionWording(question,meta,background){
 if(['single','multi'].includes(question.kind))return {questionText:questionTitle(question,null,background),wordingSource:'bank',wordingFallback:'choice_options'};
 const keys=['questionText','question'].filter(k=>meta[k]!=null);
 const texts=keys.map(k=>typeof meta[k]==='string'?meta[k].trim():'');
 const polluted=texts.some(t=>/:(?:contentReference|cite)\[|\[oaicite:|```|<\/?[a-z][^>]*>|[\u0000-\u0008\u000b\u000c\u000e-\u001f]/i.test(t));
 const invalid=polluted||texts.some(t=>!t||t.length>180),conflict=!invalid&&texts.length===2&&texts[0]!==texts[1];
 const usable=texts.length>0&&!invalid&&!conflict;
 return {questionText:questionTitle(question,usable?{questionText:texts[0]}:null,background),wordingSource:usable?keys[0]:'bank',wordingFallback:usable?null:conflict?'conflict':polluted?'format_pollution':invalid?'invalid':'missing'};
}
