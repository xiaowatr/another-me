import {SCENARIO_BY_ID} from './scenario-bank.js';
export const BEHAVIOR={
 focus:{autonomy:'保留自主决定的空间',connection:'在意联系与陪伴',pace:'在意各自的节奏',cost:'在意实际投入与承受条件',quality:'在意完成质量',opportunity:'在意机会与时机',enjoyment:'在意过程是否愉快',privacy:'在意个人边界',fairness:'在意双方需要与公平',learning:'在意学习与尝试',familiarity:'在意熟悉感',feedback:'在意外部反馈'},
 condition:{shared:'当决定会影响双方时',unclear:'当期待或背景尚不清楚时',limited:'当时间或资源有限时',rare:'当相聚或机会难得时',ordinary:'在日常、机会可再安排时',ready:'当已达到基本准备要求时',unready:'当认为准备仍不足时',costKnown:'在了解实际代价后',interestChanged:'当兴趣发生变化时',differentPace:'当双方节奏不同时',ownPreference:'当对方建议与自己的意愿不同时',reversible:'当可以小步试错时',noCondition:'仅限这次假设回答，未表达可泛化的适用条件'},
 approach:{ask:'先询问对方想法或澄清期待',understand:'先了解背景和原因',compare:'比较条件与实际代价再决定',negotiate:'协商双方都能接受的安排',separate:'允许各自安排，同时保留联系',accompany:'优先照顾相处和陪伴',try:'先小步尝试再调整',prepare:'先补足准备再推进',act:'在基本条件具备时先行动',adjust:'改变方法或安排继续探索',pause:'暂缓，留出重新判断的空间',decline:'说明不同意愿并表达边界',persist:'在表达的条件下继续投入',reserve:'给个人兴趣保留固定空间',share:'表达感受或主动分享',seekHelp:'寻求交流或帮助',independent:'先独立处理',balance:'兼顾不同需要，不直接做单一取舍'}
};
export const scenarioKey=s=>JSON.stringify([s?.id||'',s?.answer||'',Boolean(s?.skipped),s?.scopeKey||'']);
export function normalizeScenarioAnalysis(raw,s){
 if(!s||s.skipped||!s.answer?.trim()||!SCENARIO_BY_ID[s.id])return null;
 if(!raw||raw.id!==s.id||!Array.isArray(raw.considerations))return null;
 const considerations=raw.considerations.slice(0,4).filter(c=>c&&BEHAVIOR.focus[c.focus]&&BEHAVIOR.condition[c.condition]&&BEHAVIOR.approach[c.approach]&&typeof c.evidence==='string'&&c.evidence.trim()&&s.answer.includes(c.evidence)&&typeof c.conditionEvidence==='string'&&(c.condition==='noCondition'?c.conditionEvidence==='':c.conditionEvidence.trim()&&s.answer.includes(c.conditionEvidence))&&c.explicit===true);
 return {key:scenarioKey(s),id:s.id,perspective:SCENARIO_BY_ID[s.id].perspective,considerations:considerations.map(c=>({focus:c.focus,condition:c.condition,approach:c.approach,evidence:c.evidence,conditionEvidence:c.conditionEvidence,explicit:true})),unknown:Array.isArray(raw.unknown)?raw.unknown.filter(v=>typeof v==='string').map(v=>v.slice(0,160)).slice(0,4):[]};
}
export function scenarioReferences(s,scopeKey){
 if(!s||s.scopeKey!==scopeKey||s.skipped||s.analysis?.key!==scenarioKey(s))return [];
 const a=normalizeScenarioAnalysis(s.analysis,s);return (a?.considerations||[]).map(c=>({consideration:BEHAVIOR.focus[c.focus],condition:BEHAVIOR.condition[c.condition],approach:BEHAVIOR.approach[c.approach],scope:a.perspective==='advice'?'仅体现向他人回应时的考虑，不代表本人会选择同样道路':'仅为特定假设下的行为参考，不是现实经历或固定人格',application:'只能体现于本次原始人生主题，不搬用问答事件，不覆盖明确设定'}));
}
export const SCENARIO_HISTORY_KEY='another-me.scenario-history.v1';
export function readScenarioHistory(storage){try{return JSON.parse(storage.getItem(SCENARIO_HISTORY_KEY)||'[]').filter(x=>SCENARIO_BY_ID[x.id]&&typeof x.at==='number').slice(-5);}catch{return [];}}
export function rememberScenario(storage,id,key){try{const old=readScenarioHistory(storage);if(old.some(x=>x.id===id&&x.key===key))return;storage.setItem(SCENARIO_HISTORY_KEY,JSON.stringify([...old,{id,group:SCENARIO_BY_ID[id].group,at:Date.now(),key}].slice(-5)));}catch{/* Optional rotation history never blocks filling. */}}
