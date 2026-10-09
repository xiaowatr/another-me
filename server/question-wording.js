import {QUESTION_BANK} from '../src/question-bank.js';
import {questionTitle} from '../src/question-context.js';
// Use the same field name in ordinary question inputs and outputs; never mutate the saved bank.
export function modelQuestionBank(){return QUESTION_BANK.filter(q=>!['G12','G14'].includes(q.id)).map(({question,...q})=>({...q,questionText:question}));}
export function resolveQuestionWording(question,meta,background){
 const keys=['questionText','question'].filter(k=>meta[k]!=null);
 const texts=keys.map(k=>typeof meta[k]==='string'?meta[k].trim():'');
 const invalid=texts.some(t=>!t||t.length>180),conflict=!invalid&&texts.length===2&&texts[0]!==texts[1];
 const usable=texts.length>0&&!invalid&&!conflict;
 return {questionText:questionTitle(question,usable?{questionText:texts[0]}:null,background),wordingSource:usable?keys[0]:'bank',wordingFallback:usable?null:conflict?'conflict':invalid?'invalid':'missing'};
}
