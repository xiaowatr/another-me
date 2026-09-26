import {questionTime,questionTitle} from './question-context.js';
import {SCENARIO_BY_ID} from './scenario-bank.js';
import {scenarioReferences} from './scenario-context.js';
import {QUESTION_BY_ID as ORDINARY_BY_ID} from './question-bank.js';
const QUESTION_BY_ID={...ORDINARY_BY_ID,...SCENARIO_BY_ID};
export const unknownAnswer=text=>/^(?:我也?不(?:知道|清楚|确定)|不知道|不清楚|不确定|说不清|没想好|还没想好|随便|都可以|不想回答|跳过|说不清／不愿透露)[。！!？?\s]*$/.test(String(text||'').trim());
export function finishSupplementPage(state,ids){ids=ids.filter(id=>!SCENARIO_BY_ID[id]);const answers={...state.answers};for(const id of ids){const a=answers[id]||{selected:[],text:'',skipped:false};if(!answerText(a)||unknownAnswer(answerText(a)))answers[id]={...a,skipped:true};}return {...state,answers};}
const baseFields=['realityOutcome','hypotheticalDirection','birthYear','forkAge','locationText','gender','mbti','lifeSituation','choiceReason','details','followupAnswer'];
export function supplementKey(b){const text=JSON.stringify(baseFields.map(k=>b[k]||''));let a=2166136261,c=5381;for(const x of text){a=Math.imul(a^x.charCodeAt(0),16777619);c=Math.imul(c,33)^x.charCodeAt(0);}return (a>>>0).toString(16)+(c>>>0).toString(16);}
const blank=()=>({shown:[],answers:{},pages:[],page:0,questionMeta:{},confirmations:[],extra:'',plan:null,scenario:null,recentScenarios:[]});
function envelope(b){try{const x=JSON.parse(b.supplementary||'{}');return x&&Array.isArray(x.contexts)?x:{contexts:[]};}catch{return {contexts:[]};}}
export function supplementState(b){const contexts=envelope(b).contexts,exact=contexts.find(x=>x.key===supplementKey(b));if(exact)return exact.state;return {...blank(),recentScenarios:contexts[0]?.state?.recentScenarios||[]};}
export function saveSupplement(b,state){const key=supplementKey(b),old=envelope(b);return {...b,supplementary:JSON.stringify({contexts:[{key,state},...old.contexts.filter(x=>x.key!==key)].slice(0,3)})};}
export function answerText(a){if(!a||a.skipped)return '';return [...(a.selected||[]).filter(x=>x!=='自己定起止时间'),a.text||''].filter(Boolean).join('；');}
export function supplementSources(b){const s=supplementState(b);return [...baseFields.map(id=>({id,text:b[id]||''})),...Object.entries(s.answers).filter(([id,a])=>ORDINARY_BY_ID[id]&&answerText(a)).map(([id,a])=>({id,text:answerText(a)})),...(s.confirmations||[]).map((text,i)=>({id:'confirmation:'+i,text})),{id:'extra',text:s.extra||''}].filter(x=>x.text);}
export function supplementaryContext(b){const s=supplementState(b);return {behaviorReferences:scenarioReferences(s.scenario,supplementKey(b)),answers:Object.entries(s.answers).filter(([id,a])=>ORDINARY_BY_ID[id]&&answerText(a)).map(([id,a])=>({id,question:questionTitle(QUESTION_BY_ID[id],s.questionMeta?.[id],b),purpose:QUESTION_BY_ID[id].purpose,answerContext:s.answerScopes?.[id]||null,tense:questionTime(b).tense,selected:a.selected||[],text:a.text||'',meaning:'仅按原话理解；手写纠正优先于被纠正的选项，不确定保持未知；若answerContext与当前故事已不相干，则保留原文但不应用到当前剧情'})),skipped:Object.keys(s.answers).filter(id=>s.answers[id].skipped),extra:s.extra||'',confirmations:s.confirmations||[],expectations:safeExpectations(s,b)};}
export function validateSupplement(b){
 if(!b.supplementary)return;
 if(typeof b.supplementary!=='string'||b.supplementary.length>65000)throw Error('supplement_input');
 const e=JSON.parse(b.supplementary);if(!Array.isArray(e.contexts)||e.contexts.length>3)throw Error('supplement_input');
 for(const {key,state:s} of e.contexts){if(typeof key!=='string'||key.length>32||!s||!Array.isArray(s.shown)||s.shown.length>8||new Set(s.shown).size!==s.shown.length||s.shown.some(id=>!QUESTION_BY_ID[id])||!s.answers||typeof s.answers!=='object'||Object.keys(s.answers).some(id=>!s.shown.includes(id))||!Array.isArray(s.confirmations)||s.confirmations.length>2||s.confirmations.some(t=>typeof t!=='string'||t.length>500)||typeof s.extra!=='string'||s.extra.length>500)throw Error('supplement_input');
  for(const [id,a] of Object.entries(s.answers)){const q=QUESTION_BY_ID[id];if(SCENARIO_BY_ID[id]||!a||!Array.isArray(a.selected)||a.selected.length>(q.kind==='multi'?2:q.kind==='single'?1:0)||a.selected.some(v=>!q.options.includes(v)&&v!=='说不清／不愿透露')||typeof a.text!=='string'||a.text.length>500||typeof a.skipped!=='boolean')throw Error('supplement_input');}
  if(s.questionMeta&&Object.values(s.questionMeta).some(q=>q.questionText!=null&&(typeof q.questionText!=='string'||q.questionText.length>180)))throw Error('supplement_input');
  if(s.scenario!=null){const q=s.scenario;if(!SCENARIO_BY_ID[q.id]||!s.shown.includes(q.id)||typeof q.answer!=='string'||q.answer.length>500||typeof q.skipped!=='boolean'||typeof q.scopeKey!=='string')throw Error('supplement_input');}
  if(s.recentScenarios!=null&&(!Array.isArray(s.recentScenarios)||s.recentScenarios.length>5||s.recentScenarios.some(x=>!SCENARIO_BY_ID[x.id])))throw Error('supplement_input');
  if(!Array.isArray(s.pages)||s.pages.length>8||s.pages.some(p=>!Array.isArray(p)||p.length>3||p.some(id=>!s.shown.includes(id)))||!Number.isInteger(s.page)||s.page<0||s.page>s.pages.length)throw Error('supplement_input');
  if(s.plan!=null&&(!Array.isArray(s.plan.questions)||s.plan.questions.length>3||s.plan.questions.some(q=>!q||!QUESTION_BY_ID[q.id])||(s.plan.conflict&&(!Array.isArray(s.plan.conflict.evidence)||typeof s.plan.conflict.question!=='string'||s.plan.conflict.evidence.some(e=>typeof e?.text!=='string')))))throw Error('supplement_input');
 }
}

function safeExpectations(s,b){if(!s.plan?.expectations)return null;const sources=new Map(supplementSources(b).map(x=>[x.id,x.text]));return {mustKeep:(s.plan.expectations.mustKeep||[]).filter(x=>sources.get(x.sourceId)?.includes(x.text)),respondTo:(s.plan.expectations.respondTo||[]).filter(x=>sources.get(x.sourceId)?.includes(x.text)),free:[],unknown:[]};}
