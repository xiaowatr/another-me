import {consistencyProofGrounded} from './story-consistency.js';
import {generationInput} from './generation-input.js';
import {ageProofIsGrounded} from './age-facts.js';
import {updateStoryRequestInput} from './story-request.js';
import {storyTools} from './story-tools.js';
import {RETRY_RULE} from './generation-rules.js';
// Only schema diagnostics with an identified field, or an existing direct count proof.
// Other hard checks still retry; lacking local evidence means no content feedback.
export function schemaRetryFeedback(error,messages){
 const d=error.diagnostic;
 if(error.category!=='invalid_response'||d?.stage!=='schema'||d.reason!=='structured_schema'||typeof d.field!=='string'||!/^\/(?:[A-Za-z0-9_~-]+\/)*[A-Za-z0-9_~-]+$/.test(d.field))return null;
 let schema=storyTools(messages)[0].function.parameters;
 for(const part of d.field.slice(1).split('/').map(s=>s.replace(/~1/g,'/').replace(/~0/g,'~'))){schema=schema.type==='array'&&/^\d+$/.test(part)?schema.items:schema.properties?.[part];if(!schema)return null;}
 const {description,...requirement}=schema;
 return {instruction:RETRY_RULE,issues:[{kind:'format',field:d.field,requirement}]};
}
export function hardRetryFeedback(issues,c){
 const items=[];
 for(const x of issues){const p=x.proof;
  if(x.reason==='age_fact_conflict'&&ageProofIsGrounded(p,c.originalInput||c.original||{})){items.push({kind:'confirmed_conflict',field:x.field.replace(/^scenes\.([0-2])\.text$/,(_,i)=>`chapter${Number(i)+1}.text`),inputBasis:{sourceFields:p.sourceFields,expectedAges:p.expectedAges,anchorYear:p.anchorYear,calculation:p.calculation},conflictQuote:p.quote});if(items.length===2)break;continue;}
  if(['narration_anchor_conflict','course_completion_conflict'].includes(x.reason)&&consistencyProofGrounded(p,generationInput(c))){items.push({kind:'confirmed_conflict',field:x.field.replace(/^scenes\.([0-2])\.text$/,(_,i)=>`chapter${Number(i)+1}.text`),inputBasis:{conditionQuote:p.rule.quote,calculation:p.calculation},conflictQuote:p.quote,...(p.bodyQuote?{bodyEvidence:{field:p.bodyField,quote:p.bodyQuote}}:{})});if(items.length===2)break;continue;}
  if(x.reason==='internal_timeline_conflict'||x.reason==='internal_timeline_diagnostic')continue;
  if(x.reason==='calendar_ordinal_conflict'&&p?.kind==='calendar_ordinal'&&p.rule?.quote&&p.quote&&p.rangeQuote){
   const raw=[c.originalInput,c.original].filter(Boolean).some(b=>Object.values(b).some(v=>typeof v==='string'&&v.includes(p.rule.quote)))||(c.personalization?.confirmations||[]).some(t=>t.includes(p.rule.quote));
   if(raw&&!items.some(i=>i.conflictQuote===p.quote))items.push({kind:'confirmed_conflict',field:x.field.replace(/^scenes\.([0-2])\.text$/,(_,i)=>`chapter${Number(i)+1}.text`),inputBasis:{frequencyQuote:p.rule.quote,calendarQuote:p.rangeQuote,totalQuote:p.totalQuote,calculation:p.calculation},conflictQuote:p.quote});
   if(items.length===2)break;continue;
  }
  if(x.reason==='narration_cutoff_conflict'&&p?.kind==='narration_cutoff'&&p.rule?.quote&&p.quote&&p.anchorQuote){
   const raw=[c.originalInput,c.original].filter(Boolean).some(b=>Object.values(b).some(v=>typeof v==='string'&&v.includes(p.rule.quote)))||(c.personalization?.confirmations||[]).some(t=>t.includes(p.rule.quote))||c.personalization?.extra?.includes(p.rule.quote)||c.personalization?.latestConfirmation?.answer?.includes(p.rule.quote);
   if(raw&&!items.some(i=>i.conflictQuote===p.quote))items.push({kind:'confirmed_conflict',field:x.field.replace(/^scenes\.([0-2])\.text$/,(_,i)=>`chapter${Number(i)+1}.text`),inputBasis:{narrationQuote:p.rule.quote,calculation:p.calculation},anchorQuote:p.anchorQuote,conflictQuote:p.quote});
   if(items.length===2)break;continue;
  }
  if(x.reason!=='frequency_conflict'||!p?.rule?.quote||!p.quote||!p.calculation||!['explicit_frequency','explicit_month_total','explicit_complete_record','explicit_window_total','explicit_total','window_ordinal'].includes(p.kind))continue;
  const raw=[c.originalInput,c.original].filter(Boolean).some(b=>Object.values(b).some(v=>typeof v==='string'&&v.includes(p.rule.quote)))||(c.personalization?.answers||[]).some(a=>[...(a.selected||[]),a.text||''].join('；').includes(p.rule.quote))||(c.personalization?.confirmations||[]).some(t=>t.includes(p.rule.quote))||c.personalization?.extra?.includes(p.rule.quote)||c.personalization?.latestConfirmation?.answer?.includes(p.rule.quote);
  if(!raw||items.some(i=>i.conflictQuote===p.quote))continue;
  items.push({kind:'confirmed_conflict',field:x.field.replace(/^scenes\.([0-2])\.(time|title|text)$/,(_,index,key)=>`chapter${Number(index)+1}.${key}`),inputBasis:{frequencyQuote:p.rule.quote,observationQuote:c.timeRange||null,calculation:p.calculation},conflictQuote:p.quote});if(items.length===2)break;
 }
 return items.length?{instruction:RETRY_RULE,issues:items}:null;
}
export function withRetryFeedback(messages,feedback){
 if(!feedback)return messages;
 return updateStoryRequestInput(messages,input=>({...input,retryFeedback:feedback}));
}
