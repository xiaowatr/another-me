// Curated public context, not runtime search or individual biographical evidence.
export const ERA_CARDS=[{
 id:'cn-school-2020-spring',title:'2020年春季：中小学延期开学期间的学习支持',
 start:'2020-02-12',end:'2020-06-30',regions:['中国大陆'],educationScope:['小学','初中','高中'],
 sourceTitle:'教育部、工业和信息化部：中小学延期开学期间“停课不停学”有关工作安排',
 url:'https://www.moe.gov.cn/srcsite/A06/s3321/202002/t20200212_420435.html',published:'2020-02-12',checked:'2026-09-23',
 facts:['2020年2月12日发布的通知为中小学延期开学期间的学习提供安排。','国家中小学网络云平台计划于2月17日开通，提供小学一年级至普通高中三年级资源，供各地选择使用。','各地各校应结合条件实施，不能假设所有学校统一要求教师录课。'],
 limits:'仅可用于2020年春季中国大陆中小学情境；不证明任何个人的所在地、学历、工作资格或录用结果，也不提供招聘数量。2月12日以前的角色不能提前知道此通知。'
}];
const mainlandCities=['北京','上海','广州','深圳','杭州','南京','成都','武汉','重庆','天津','西安'];
export function selectEra(background,coordinate){
 const text=background.hypotheticalDirection || background.alternative || '';
 const location=coordinate.locationAtFork || '';
 const exactDescription=coordinate.locationKind==='description' && mainlandCities.some(c=>location===c || location===c+'市');
 const knownMainland=exactDescription || coordinate.locationKind==='city' && (mainlandCities.some(c=>location.includes(c)) || location.includes('中国大陆'));
 return coordinate.forkYear===2020 && knownMainland && /小学|初中|高中|中小学/.test(text) && /教师|老师|教书|任教|教学/.test(text)?ERA_CARDS:[];
}
