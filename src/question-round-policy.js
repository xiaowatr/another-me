import {supplementState} from './supplementary.js';
import {unfinishedQuestionIds} from './question-progress.js';

export function shouldFinishQuestionGroup(state){
 if(state.plan?.conflict)return false;
 return Boolean(state.scenario||state.plan?.stop||state.shown.length>=8||state.plan?.questionOrigin!=='literal_user_request');
}

// Do not spend another selection/review cycle deciding to stop a completed
// optional group. Literal multi-page requests and scenario analysis keep their paths.
export function completedOptionalQuestionPlan(background){
 const state=supplementState(background),ids=state.pages?.[state.page]||[];
 if(state.scenario||state.plan?.conflict||state.plan?.questionOrigin==='literal_user_request'||state.page!==state.pages.length-1||!ids.length||unfinishedQuestionIds(state,ids).length)return null;
 return {...state.plan,questions:[],covered:state.plan?.covered||[],criticalUnknowns:state.criticalUnknowns||state.plan?.criticalUnknowns||[],conflict:null,expectations:state.plan?.expectations||{mustKeep:[],respondTo:[],free:[],unknown:[]},stop:true,optionalGroupComplete:true,planDiagnostics:{outcome:'optional_group_complete',stage:'local_round_limit',attempts:[],stages:{}}};
}
