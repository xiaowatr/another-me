import {ACTIVE_QUESTION_BANK,QUESTION_BANK} from '../src/question-bank.js';
import {KEY_QUESTION_BY_ID} from '../src/critical-background.js';
import {SCENARIO_BY_ID} from '../src/scenario-bank.js';
import {AppError,decodeJson} from './core.js';
import {strictJson} from './structured-story.js';
import {validateSchema} from './schema-validation.js';
export const QUESTION_TOOL_NAME='submit_questions';
export const ordinaryQuestionIds=()=>[...ACTIVE_QUESTION_BANK.map(q=>q.id),...Object.keys(KEY_QUESTION_BY_ID)];
const legacyIds=()=>[...QUESTION_BANK.map(q=>q.id),...Object.keys(KEY_QUESTION_BY_ID)];
const str={type:'string'},bool={enum:[true,false]};
const row=(properties,required=[])=>({type:'object',properties,required,additionalProperties:true});
const list=(items,maxItems)=>({type:'array',items,maxItems});
const nullable=value=>({anyOf:[{type:'null'},value]});
const safeId=value=>typeof value==='string'&&/^(?:[A-Z]{1,4}\d{1,3}(?:[-_][A-Z0-9]{1,8})?)$/.test(value)?value:'[invalid]';
export function questionIdError(value,field,stage='review'){
 return new AppError('invalid_response',502,{stage:'question_validation',reason:'question_'+stage+'_question_id',questionIdIssue:{field,receivedId:safeId(value),kind:typeof value!=='string'?'invalid_type':SCENARIO_BY_ID[value]?'scenario_in_ordinary':'unknown_or_disallowed_id'}});
}
// Runtime compatibility still recognizes retired ordinary IDs, which normalization removes.
// Outgoing tool enums contain only active IDs. No title guessing or alias-to-ID mapping.
export function assertQuestionIds(raw,stage='selection',{activeOnly=false}={}){
 const ordinary=new Set(activeOnly?ordinaryQuestionIds():legacyIds()),scenario=new Set(Object.keys(SCENARIO_BY_ID));
 for(const [field,allowed] of [['questions',ordinary],['covered',ordinary],['scenarioCandidates',scenario]])for(const [i,item] of (Array.isArray(raw?.[field])?raw[field]:[]).entries())if(!allowed.has(item?.id))throw questionIdError(item?.id,field+'.'+i+'.id',stage);
 for(const [i,gap]of (Array.isArray(raw?.criticalUnknowns)?raw.criticalUnknowns:[]).entries())if(gap?.questionId&&!ordinary.has(gap.questionId))throw questionIdError(gap.questionId,'criticalUnknowns.'+i+'.questionId',stage);
 if(raw?.scenarioAnalysis?.id&&!scenario.has(raw.scenarioAnalysis.id))throw questionIdError(raw.scenarioAnalysis.id,'scenarioAnalysis.id',stage);
 return raw;
}
export function questionTools(stage='selection',{hasScenarioCandidate=true}={}){
 const id={type:'string',enum:ordinaryQuestionIds()},sid={type:'string',enum:Object.keys(SCENARIO_BY_ID)},quote=row({sourceId:str,evidence:str},['sourceId','evidence']);
 const assessment=row({id,reason:str,questionText:str,question:str,tense:{enum:['original','future']},informationGain:{enum:[0,1,2,3]},missingInformation:str,useInStory:str,excludedOptions:list(row({option:str,sourceId:str,evidence:str},['option','sourceId','evidence']),20)},['id','reason','informationGain','missingInformation','useInStory']);
 const properties={stop:bool,questions:list(assessment,6),covered:list(row({id,sourceId:str,evidence:str},['id','sourceId','evidence']),ordinaryQuestionIds().length),conflict:nullable(row({question:str,evidence:list(row({sourceId:str,text:str},['sourceId','text']),2)},['question','evidence'])),criticalUnknowns:list(row({key:str,missingInformation:str,whyMissing:str,useInStory:str,sourceId:str,evidence:str,questionText:str,questionId:{enum:[...ordinaryQuestionIds(),null,'']},kind:{enum:['address_preference']},person:str,resolvedBy:quote},['key','missingInformation','whyMissing','useInStory','sourceId','evidence']),4)};
 if(stage==='review')Object.assign(properties,{keepScenario:hasScenarioCandidate?bool:{enum:[false]},changeSubject:{enum:['self','other','mixed','unknown']},evidence:str});
 else Object.assign(properties,{scenarioCandidates:list(row({id:sid,relevance:{enum:[0,1,2]},information:{enum:[0,1,2]},ease:{enum:[0,1,2]},reason:str},['id','relevance','information','ease','reason']),3),scenarioAnalysis:nullable(row({id:sid,considerations:{type:'array'},unknown:{type:'array'}},['id'])),expectations:row({mustKeep:{type:'array'},respondTo:{type:'array'},free:{type:'array'},unknown:{type:'array'}})});
 return [{type:'function',function:{name:QUESTION_TOOL_NAME,description:stage==='review'?'提交独立复核结果；questions只使用枚举中的普通题号，情景候选只通过keepScenario保留，不放入questions。':'提交初选结果；questions只使用枚举中的普通题号，情景题放scenarioCandidates；不自造或猜测题号。',parameters:row(properties,stage==='review'?['questions','covered','stop',...(hasScenarioCandidate?['keepScenario']:[]),'changeSubject','evidence']:['questions','covered'])}}];
}
// Keep one schema for the JSON wire instruction and the unchanged receiver.
export function questionJsonMessages(messages,tools){
 return [...messages,{role:'system',content:'本次兼容JSON文本通道。不要调用工具，只输出submit_questions对应的一个完整JSON对象；原始资料和所有语义规则不变。JSON schema：'+JSON.stringify(tools[0].function.parameters)}];
}
export function receiveQuestionResult(content,tools,stage,diagnostic={}){
 try{strictJson(content);}catch(e){if(e.message.startsWith('duplicate_field:'))throw new AppError('invalid_response',502,{stage:'schema',reason:'duplicate_field'});}
 const data=decodeJson(content,diagnostic);assertQuestionIds(data,stage,{activeOnly:true});
 const schema=tools[0].function.parameters,repairs=[];
 const scalar=(object,key,path,allowed)=>{const value=object?.[key];if(typeof value!=='string')return;const exact=allowed.find(v=>String(v)===value);if(exact!==undefined){object[key]=exact;repairs.push({field:path,operation:'normalize_exact_enum_scalar'});}};
 scalar(data,'stop','/stop',[true,false]);scalar(data,'keepScenario','/keepScenario',[true,false]);
 if(Array.isArray(data?.questions))data.questions.forEach((q,i)=>scalar(q,'informationGain','/questions/'+i+'/informationGain',[0,1,2,3]));
 if(Array.isArray(data?.scenarioCandidates))data.scenarioCandidates.forEach((q,i)=>{for(const key of ['relevance','information','ease'])scalar(q,key,'/scenarioCandidates/'+i+'/'+key,[0,1,2]);});
 if(stage==='review'&&data&&typeof data==='object'&&!Object.hasOwn(data,'keepScenario')&&!schema.required.includes('keepScenario')&&schema.properties.keepScenario.enum.length===1&&schema.properties.keepScenario.enum[0]===false){data.keepScenario=false;repairs.push({field:'/keepScenario',operation:'default_inapplicable_false'});}
 return {data,errors:validateSchema(schema,data),repairs};
}
