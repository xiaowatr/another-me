import {SCENARIO_BY_ID} from './scenario-bank.js';
export function questionAnswer(state,id){return SCENARIO_BY_ID[id]?{selected:[],text:state.scenario?.answer||'',skipped:Boolean(state.scenario?.skipped)}:state.answers[id]||{selected:[],text:'',skipped:false};}
export function unfinishedQuestionIds(state,ids){return ids.filter(id=>{const a=questionAnswer(state,id);return !a.skipped&&!a.text.trim()&&!a.selected.length;});}
