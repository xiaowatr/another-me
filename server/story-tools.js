const str={type:'string',minLength:1,maxLength:2000};
const chapter={type:'object',properties:{time:{...str,maxLength:60},title:{...str,maxLength:150},text:str},required:['time','title','text'],additionalProperties:false};
export function storyTools(messages){let payload={};try{payload=JSON.parse(messages.at(-1)?.content||'{}');}catch{}
 const story={type:'function',function:{name:'submit_story',description:'提交完整故事：chapter1、chapter2、chapter3必填，固定三章，chapter4只能省略或为null；程序组装章节。不得截断、用空正文占位或夹带创作说明。',parameters:{type:'object',properties:{kind:{type:'string',enum:['story']},title:str,synopsis:{...str,maxLength:180,description:'简短概括本次平行人生，不对照两条人生；如使用我，指平行自己。'},identity:str,intro:str,character:str,opening:{...str,description:'接续最后一章最终状态，写给现实自己的开场消息。'},chapter1:{...chapter,description:"第一章完整正文，后面仍必须填写第二章和第三章。"},chapter2:{...chapter,description:"第二章完整正文，与本次选择相关的后续行动。不能省略。"},chapter3:{...chapter,description:"第三章完整正文，观察范围内的后续片段；opening接续故事最终状态。不能省略。"},chapter4:{type:'null'}},required:['kind','title','identity','intro','character','opening','chapter1','chapter2','chapter3'],additionalProperties:false}}};
 return payload.canClarify?[story,{type:'function',function:{name:'ask_clarification',description:'仅询问影响人物、事件或改变方向的关键歧义，用自然中文，不展示内部字段。',parameters:{type:'object',properties:{kind:{type:'string',enum:['clarification']},question:str},required:['kind','question'],additionalProperties:false}}}]:[story];
}

// Partial repair uses exactly the corresponding submit_story property schemas.
export function fieldRepairTools(fields){
 if(!Array.isArray(fields)||!fields.length||new Set(fields).size!==fields.length||fields.some(f=>!['intro','character','opening'].includes(f)))throw Error('Invalid repair fields');
 const full=storyTools([])[0].function.parameters;
 return [{type:'function',function:{name:'submit_story',description:'只提交指定字段的局部修复，不提交或改写其他字段。',parameters:{type:'object',properties:Object.fromEntries(['kind',...fields].map(f=>[f,full.properties[f]])),required:['kind',...fields],additionalProperties:false}}}];
}
