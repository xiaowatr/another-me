export const LIFE_STATUS_OPTIONS=['在上学','在工作','一边上学一边工作','暂时没有上学或工作','其他','不想透露'];
export const LIFE_BACKGROUND_FIELDS=['lifeStatus','lifeStatusScope','lifeSituationScope','relatedExperience'];
export function lifeBackgroundEntries(b={}){
 return ['lifeStatus','lifeSituation','relatedExperience'].filter(field=>typeof b[field]==='string'&&b[field].trim()).map(field=>({field,sourceRef:field,actor:'real_user',timeScope:field==='relatedExperience'?'before_this_event':b[field==='lifeStatus'?'lifeStatusScope':'lifeSituationScope']==='now'?'now':'at_fork',text:b[field],status:field==='lifeStatus'&&b[field]==='不想透露'?'undisclosed':'provided'}));
}
export function updateLifeBackground(b,name,value,timeScope){return {...b,[name]:value,...(name==='lifeStatus'?{lifeStatusScope:value?timeScope:''}:name==='lifeSituation'?{lifeSituationScope:value?timeScope:''}:{})};}
export function lifeBackgroundLabels(timeScope){return timeScope==='now'?{status:'你现在的生活是什么状态？',detail:'愿意再说具体一点吗？'}:{status:'那时，你的生活是什么状态？',detail:'愿意再说具体一点吗？'};}
export function lifeSituationPlaceholder(status){return status==='在上学'?'例如读大二、准备考研，学的是设计。':status==='在工作'?'例如做平面设计，刚入职，工作比较忙。':status==='一边上学一边工作'?'例如白天工作，晚上读在职研究生。':status==='暂时没有上学或工作'?'例如正在找工作、休息，或照顾家人。':'说说你的生活状态，不想填也可以。';}
