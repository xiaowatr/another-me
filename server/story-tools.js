import {internalTimelineEnabled,internalTimeSchema} from './internal-timeline.js';
import {storyRequestInput} from './story-request.js';
const str={type:'string',minLength:1,maxLength:2000};
const briefIntro={...str,maxLength:100,description:'用一至两句第一人称话概括三章正文的主线与发展；语义边界以核心约束为准'};
const chapter={type:'object',properties:{time:{...str,maxLength:60},title:{...str,maxLength:150},text:str},required:['time','title','text'],additionalProperties:false};
export function storyTools(messages){const payload=storyRequestInput(messages);
 const body=payload.generationStage==='body';
 const story={type:'function',function:{name:'submit_story',description:'提交故事字段',parameters:{type:'object',properties:{kind:{type:'string',enum:['story']},title:str,identity:str,chapter1:{...chapter,description:"第1章正文"},chapter2:{...chapter,description:"第2章正文"},chapter3:{...chapter,description:"第3章正文"},chapter4:{type:'null'},synopsis:{...str,maxLength:180,description:'人生概括'},intro:str,character:str,opening:{...str,description:'开场消息'}},required:['kind','title','identity','chapter1','chapter2','chapter3','intro','character','opening'],additionalProperties:false}}};
 if(body){const p=story.function.parameters;for(const k of ['opening','character','synopsis'])delete p.properties[k];p.required=p.required.filter(k=>!['opening','character','synopsis'].includes(k));p.properties.intro=briefIntro;for(const k of ['chapter1','chapter2','chapter3']){p.properties[k]={...p.properties[k],properties:{title:chapter.properties.title,text:chapter.properties.text},required:['title','text']};}}
 if(body&&internalTimelineEnabled(payload.effectiveSetting)){for(const k of ['chapter1','chapter2','chapter3']){const p=story.function.parameters.properties[k];p.properties={internalTime:internalTimeSchema(payload.effectiveSetting),...p.properties};// Optional assistance must not become a prerequisite for valid prose.
}}
 return payload.canClarify?[story,{type:'function',function:{name:'ask_clarification',description:'提交澄清问题',parameters:{type:'object',properties:{kind:{type:'string',enum:['clarification']},question:str},required:['kind','question'],additionalProperties:false}}}]:[story];
}

// Partial repair uses exactly the corresponding submit_story property schemas.
export function fieldRepairTools(fields,messages=[]){
 const body=f=>/^chapter[1-3]\.text$/.test(f);
 if(!Array.isArray(fields)||!fields.length||new Set(fields).size!==fields.length||fields.some(f=>!['intro','character','opening'].includes(f)&&!body(f))||fields.filter(body).length>1)throw Error('Invalid repair fields');
 const full=storyTools([])[0].function.parameters;if(storyRequestInput(messages).effectiveSetting?.version>=5)full.properties.intro=briefIntro;
 const properties={kind:full.properties.kind};
 for(const f of fields){if(body(f)){properties[f.slice(0,8)]={type:'object',properties:{text:str},required:['text'],additionalProperties:false};}else properties[f]=full.properties[f];}
 return [{type:'function',function:{name:'submit_story',description:'仅提交指定字段；其余内容原样保留',parameters:{type:'object',properties,required:Object.keys(properties),additionalProperties:false}}}];
}
