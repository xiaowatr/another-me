import {storyOutputIssues} from './story-output-checks.js';
import {openingAddresseeConflict} from '../src/participant-identity.js';
import {settingIssues} from '../src/effective-setting.js';
import {checkStoryGrounding} from './grounding.js';
import {reviewStory} from '../src/fact-frame.js';
import {frequencyProof,frequencyRule} from './frequency-proof.js';
// Keep existing program checks and direct count proofs. No model reports or scores.
export function hardStoryIssues(story,background,c){
 const issues=[...(story.scenes?.length===3?[]:[{field:'scenes',reason:'chapter_count',actualCount:story.scenes?.length,minCount:3,maxCount:3}]),...storyOutputIssues(story,background),...settingIssues(story,c)];
 if(openingAddresseeConflict(story.opening,background))issues.push({field:'opening',reason:'opening_addressee_conflict'});
 try{checkStoryGrounding(story,background,c.temporal);}catch(e){issues.push(e.diagnostic||{reason:e.category});}
 for(const issue of reviewStory(story,background,[],{strictTime:true}).issues)issues.push({field:issue.field,reason:issue.reasons[0]});
 const b=c.originalInput||c.original||background;
 const latest=c.personalization?.latestConfirmation?.answer||'';
 let sources=[...['realityOutcome','hypotheticalDirection','details','choiceReason','lifeSituation'].map(k=>b[k]),...(c.personalization?.answers||[]).map(a=>[...(a.selected||[]),a.text||''].join('；')),...(c.personalization?.confirmations||[]),c.personalization?.extra,latest].filter(x=>typeof x==='string');
 if(frequencyRule(latest))sources=[latest];
 sources=sources.flatMap(text=>text.split(/[。；，,]/));
 // Multiple different rules may concern different activities; do not guess which is binding.
 if(new Set(sources.map(frequencyRule).filter(Boolean).map(r=>r.unit+'|'+r.count)).size>1)sources=[];
 const fields=['title','synopsis','identity','intro','character','opening'].map(field=>({field,text:story[field]}));
 for(const [i,s]of story.scenes.entries())for(const key of ['time','title','text'])fields.push({field:'scenes.'+i+'.'+key,text:s[key]});
 for(const source of sources){const rule=frequencyRule(source);if(!rule)continue;
  const evidence=fields.flatMap(({field,text})=>typeof text==='string'?text.split(/[。！？；\n]/).map(quote=>({field,quote:quote.trim()})).filter(e=>e.quote&&e.quote.length<=500&&!/(?:如果|假如|打算|计划|以后|从前|以前|去年|过去)/.test(e.quote)&&!/[“”「」『』"]/.test(e.quote)):[]);
  for(const field of new Set(evidence.map(e=>e.field))){const proof=frequencyProof(source,evidence.filter(e=>e.field===field),c.timeRange);if(proof)issues.push({field:proof.field,reason:'frequency_conflict',proof});}
 }
 return [...new Map(issues.map(x=>[x.field+'|'+x.reason,x])).values()];
}
