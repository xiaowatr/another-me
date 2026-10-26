import {validateSchema} from './schema-validation.js';
export const internalTimelineEnabled=setting=>setting?.constraints?.internalTimeline?.version===2;
const known=n=>Number.isInteger(n);
function schedule(setting){
 const s=setting?.constraints?.narrativeTime?.activitySequence||setting?.constraints?.activityPlan;if(!s?.occurrences?.length)return [];
 const months=[...new Set(s.occurrences.map(x=>x.year+'-'+x.month))];
 return s.occurrences.map(x=>({activity:x.ordinal,period:x.relativeMonth||months.indexOf(x.year+'-'+x.month)+1}));
}
function periods(setting){
 const grid=schedule(setting),months=setting?.constraints?.observation?.window?.months;
 return grid.length?[...new Set(grid.map(x=>x.period))]:known(months)&&months>0&&months<=12?Array.from({length:months},(_,i)=>i+1):[];
}
// A few event anchors assist generation. They are not paragraph indexes or proof
// that the model's prose is correct; annotation errors never reject a story.
export function internalTimeSchema(setting){
 return {type:'object',description:'仅供服务端的关键事件时间锚点；每章最多三个，不按空行逐段对应，不填具体日期。',properties:{events:{type:'array',minItems:1,maxItems:3,items:{type:'object',properties:{mode:{enum:['scene','recall','plan','overview']},relativeToLetter:{enum:['before','at','after','unknown']},period:{enum:[null,...periods(setting)],description:'已知观察期的第几个月，从1起；没有明确月份范围则null。'},activity:{enum:[null,...schedule(setting).map(x=>x.activity)],description:'只引用输入已有活动编号，从1起；未提供则null。'}},required:['mode','relativeToLetter','period','activity'],additionalProperties:false}}},required:['events'],additionalProperties:false};
}
export function extractInternalTimeline(wire){return ['chapter1','chapter2','chapter3'].map(k=>wire[k]?.internalTime??null);}
export function withoutInternalTime(story){
 const {internalTimeline,internalTime,...rest}=story;
 return {...rest,...(Array.isArray(rest.scenes)?{scenes:rest.scenes.map(({internalTime,internalTimeline,...scene})=>scene)}:{})};
}
export function internalTimelineIssues(timeline,story,setting){
 if(!internalTimelineEnabled(setting)||timeline==null)return [];
 const out=[],add=(i,code,event=null)=>out.push({field:'scenes.'+i+'.text',reason:'internal_timeline_diagnostic',proof:{kind:'internal_timeline',code,chapter:i+1,...(event==null?{}:{event:event+1})}});
 if(!Array.isArray(timeline)||timeline.length!==3){add(0,'chapter_map');return out;}
 const grid=schedule(setting),schema=internalTimeSchema(setting);
 for(let i=0;i<3;i++){
  const map=timeline[i];
  if(map==null){add(i,'annotation_missing');continue;}
  if(validateSchema(schema,map).length){add(i,'annotation_shape');continue;}
  for(const [j,p] of map.events.entries()){
   if(known(p.activity)&&known(p.period)&&grid.find(x=>x.activity===p.activity)?.period!==p.period)add(i,'activity_period',j);
   if(setting.constraints.narrativeTime?.narrationAnchor&&p.mode!=='plan'&&p.relativeToLetter==='after')add(i,'completed_after_letter',j);
   if(p.mode==='plan'&&p.relativeToLetter==='before')add(i,'plan_before_letter',j);
  }
 }
 return out.slice(0,8);
}
