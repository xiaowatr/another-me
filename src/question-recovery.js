// Failure is not evidence that personalization is complete. Keep ordinary answers; omit unverified analysis.
export function optionalQuestionFallback(state={}){return {questions:[],covered:[],conflict:state.plan?.conflict||null,expectations:{mustKeep:[],respondTo:[],free:[],unknown:[]},stop:true,scenarioAnalysis:null,optionalAnalysisUnavailable:true};}
export function withoutOptionalAnalysis(state){return {...state,plan:optionalQuestionFallback(state),...(state.scenario?{scenario:{...state.scenario,analysis:null}}:{})};}
