import {readHistoryReuse,activeReuseEntries} from './history-reuse-data.js';
import {supplementState} from './supplementary.js';
import {QUESTION_BY_ID as bank} from './question-bank.js';
import {KEY_QUESTION_BY_ID} from './critical-background.js';
import {SCENARIO_BY_ID} from './scenario-bank.js';
import {questionTitle} from './question-context.js';
const questions={...bank,...KEY_QUESTION_BY_ID,...SCENARIO_BY_ID};
export function questionHistory(background={}){
 const s=supplementState(background),rows=[];
 for(const id of s.shown||[]){const q=questions[id];if(!q)continue;const a=q.scenario?s.scenario?.id===id?{text:s.scenario.answer,skipped:s.scenario.skipped}:null:s.answers?.[id];
 rows.push({id,question:questionTitle(q,id==='G08'&&!s.questionMeta?.[id]?.answerKind?{...s.questionMeta?.[id],questionText:s.questionMeta?.[id]?.questionText||'哪个小习惯，最好也留在另一个你身上？'}:s.questionMeta?.[id],background),kind:q.scenario?'假设情景':'追问',timeScope:q.scenario?s.scenario?.timeScope:s.answerScopes?.[id]?.timeScope,selected:a?.selected||[],text:a?.text||'',skipped:Boolean(a?.skipped),answered:Boolean(a)});}
 for(const [i,text] of (s.confirmations||[]).entries())rows.push({id:'confirmation:'+i,question:s.confirmationContexts?.find(c=>c.sourceIndex===i)?.question||'补充确认（原题未保存）',kind:'确认',selected:[],text,skipped:false,answered:true});
 if(background.followupQuestion&&(background.followupAnswer||background.followupSkipped)&&!rows.some(r=>r.question===background.followupQuestion&&r.text===background.followupAnswer))rows.push({id:'followup',question:background.followupQuestion,kind:'确认',selected:[],text:background.followupAnswer||'',skipped:Boolean(background.followupSkipped),answered:true});
 if(s.extra)rows.push({id:'extra',question:'其他补充',kind:'补充',selected:[],text:s.extra,skipped:false,answered:true});
 for(const e of readHistoryReuse(background).entries)rows.push({id:e.sourceId,question:e.question,kind:'历史复用',applicable:activeReuseEntries(background).some(a=>a.sourceId===e.sourceId),selected:e.selected||[],text:e.text,skipped:false,answered:true,origin:{lifeId:e.lifeId,node:e.sourceNode,timeScope:e.sourceTime}});
 return {rows,recorded:Boolean(s.plan||rows.length||s.uiReady)};
}
