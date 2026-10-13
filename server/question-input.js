import {supplementState,supplementSources,supplementaryContext} from '../src/supplementary.js';
import {questionSelectionState} from './question-policy.js';
import {questionTime} from '../src/question-context.js';
import {lifeBackgroundEntries} from '../src/life-background.js';
import {KEY_QUESTION_BY_ID} from '../src/critical-background.js';
// Raw sources and provenance stay intact; other blocks refer to them instead of repeating text.
export function questionInput(background,criticalUnknowns){
 const state=supplementState(background),record=supplementaryContext(background).settingRecord,selection=questionSelectionState(background);
 const {shown,answerContexts,confirmations,reusedAnswers,...limits}=selection;
 const sources=supplementSources(background),sourceFields=new Set(sources.map(x=>x.id));
 return {timeAnchor:questionTime(background),sources,hypotheticalDirection:background.hypotheticalDirection,
  backgroundMetadata:Object.fromEntries(Object.entries(background).filter(([key])=>!sourceFields.has(key)&&!['supplementary','historyReuse'].includes(key))),
  lifeBackground:lifeBackgroundEntries(background).map(({text,...entry})=>entry),
  selectionState:{...limits,shown,reusedAnswers:reusedAnswers.map(({text,selected,sourceContext,...item})=>({...item,sourceRef:item.id}))},
  settingRecord:{criticalBackground:criticalUnknowns||record.criticalBackground,creativeSpace:record.creativeSpace,unknownPolicy:record.unknownPolicy},
  answers:Object.fromEntries(Object.entries(state.answers).map(([id,{text,...a}])=>[id,{...a,sourceRef:id}])),answerContexts:state.answerScopes||{},
  confirmations:state.confirmations.map((_,i)=>({sourceRef:'confirmation:'+i})),confirmationContexts:state.confirmationContexts||[],temporaryQuestionSlots:Object.keys(KEY_QUESTION_BY_ID)};
}
