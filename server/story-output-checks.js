import {roleGender} from '../src/input-anchors.js';
import {supplementSources} from '../src/supplementary.js';
// High-confidence output defects only; this is not a complete semantic reviewer.
export function storyOutputIssues(story,background){
 const fields=['title','synopsis','identity','intro','character','opening'].map(field=>({field,text:story[field]}));
 for(const [i,scene] of (story.scenes||[]).entries())for(const key of ['time','title','text'])fields.push({field:`scenes.${i}.${key}`,text:scene[key]});
 const sources=supplementSources(background).map(s=>s.text);
 const gender=roleGender(background),issues=[];
 const workKnown=/(?:工作|上班|任职|职员|创业|接单|实习)/.test(background.lifeSituation||'')||sources.some(t=>/(?:我|自己)(?:当时|现在|一直|原来)?(?:在[^，。；]{0,12}(?:工作|上班|任职)|是[^，。；]{0,8}(?:老师|教师|工程师|职员|设计师)|(?:工作|上班|实习|加班))/.test(t));
 const knownSiblings=new Set(sources.flatMap(t=>siblingClaims(t)));
 if(inventedOpeningInteraction(story.opening))issues.push({field:'opening',reason:'invented_opening_interaction'});
 for(const {field,text} of fields){if(typeof text!=='string')continue;
  const narrativeText=text.replace(/[“「『"][^”」』"]*[”」』"]/g,'');
  if(!workKnown&&/(?:我(?:还是|仍然|会|每周[一二三四五六日天]|下周[一二三四五六日天]|周[一二三四五六日天])*[^，。；！？]{0,12}从公司(?:那边)?|(?:我|下周[一二三四五六日天]|周[一二三四五六日天])(?:[，, ]|刚好|正好|今天|明天|不用|不|要|得){0,10}(?:加班|下班))/.test(narrativeText))issues.push({field,reason:'unprovided_protagonist_work'});
  if(!gender&&['intro','character','identity'].includes(field)&&/^(?:这一次|这次|现在|当时|另一个自己)?[，, ]*[她他](?=按|报|走|去|选|决定|留|离|把|在|是|没|不)/.test(narrativeText.trim()))issues.push({field,reason:'unprovided_protagonist_gender'});
  if(siblingClaims(text).some(k=>!knownSiblings.has(k)))issues.push({field,reason:'unprovided_family_member'});
  if(/没(?:有)?说[“"]([^”"。！？]{1,12})[”"](?:却|就|又|还)(?:说|说了)[“"]\1[”"]/.test(text))issues.push({field,reason:'contradictory_repeated_phrase'});
  const paragraphs=text.split(/\n\s*\n/).map(t=>t.trim()).filter(t=>t.length>=50);if(new Set(paragraphs).size<paragraphs.length)issues.push({field,reason:'duplicated_story_paragraph'});
  // Require an authoring/instruction context, not ordinary dialogue about gender or writing.
  const internal=/(?:这里|此处|本段|本文)[^。！？\n]{0,20}(?:用|采用|改用)(?:第[一二三]人(?:称)?|中性(?:称呼|描述))[^。！？\n]{0,24}(?:不指代|不代表|避免|性别)/.test(text)
   ||/(?:不指代|不暗示|不标注|不指定)(?:主角|用户|角色)(?:的)?性别/.test(text)
   ||/(?:根据|遵循|按照)(?:系统|开发者)(?:提示词|提示|指令|要求)[^。！？\n]{0,35}(?:生成|描写|输出|省略|避免)/.test(text)
   ||/(?:effectiveSetting|roleGender|rewriteFeedback|behaviorReferences)\s*(?:为|是|为空|=|：|:)/.test(text)
   ||/(?:主角|角色|用户)(?:的)?性别(?:未提供|未填写|未知|不详|不透露)[^。！？\n]{0,20}(?:所以|因此|故|不应|避免)/.test(text);
  if(internal){issues.push({field,reason:'internal_instruction_in_story'});continue;}
  if(gender)continue;
  for(const clause of text.split(/[。！？；\n]/)){
   // Bind role claims to the protagonist. Mentioning another singer or hearing a section is valid.
   const narrative=clause.replace(/[“"][^”"]*(?:[”"]|$)/g,'');
   const ownRole=/(?:我|自己)(?:被)?(?:分到|分进|分在|安排到|安排在|编入|加入|担任|唱的?是|负责)(?:了)?(?:合唱团的?|团里的?)?(女[高中低]音?|男[高中低]音?)(?:声部|部)?/.exec(narrative);
   if(ownRole&&!/^(?:声部|部)?(?:的)?(?:伴奏|排练|指挥|录音|谱子)/.test(narrative.slice(ownRole.index+ownRole[0].length))){const role=ownRole[1];const grounded=sources.some(s=>new RegExp('(?:我|自己)(?:原来|之前|当时|现在|一直|本来|已经)?(?:是|唱|唱的?是|负责|在|分到|分在|分进|被分到|加入|担任)(?:了)?(?:合唱团的?|团里的?)?'+role).test(s));if(!grounded)issues.push({field,reason:'unsupported_gendered_role'});}
   const ownIdentity=/(?:我|主角|另一个我)(?:是|作为)(?:一名|一个|个)?(?:男生|女生|男孩|女孩|男性|女性)|我(?:这个|这位)(?:姑娘|小伙子|男孩|女孩)/.test(narrative);
   const metadata=['identity','intro','character'].includes(field)&&/^(?:\d+岁[，、, ]*)?(?:男生|女生|男孩|女孩|男性|女性)(?:[，。、, ]|$)/.test(clause.trim());
   const addressed=/(?:冲|对|向|朝)我(?:喊|说|叫)(?:道|着)?[：:]?[“"](?:小伙子|姑娘|男孩|女孩|先生|女士)[，,、！! ]/.test(clause);
   if((ownIdentity||metadata||addressed)&&!sources.some(s=>/(?:我|自己)(?:是|作为)(?:一名|一个|个)?(?:男生|女生|男孩|女孩|男性|女性)/.test(s)))issues.push({field,reason:'unprovided_protagonist_gender'});
  }
 }
 return issues;
}
export const STORY_OUTPUT_RULE='叙述字段只写故事本身，不能夹带创作说明、规则执行说明、占位文字或自我审核。遇到未提供的信息，直接选择不依赖它的叙述，不写一句解释自己如何遵守要求。性别留空时，人物行动与分组也不能擅自补出性别化身份；未提供声部就写跟着大家练习或具体音域困难，用户明确给出的声部可以保留，声部不用于推断性别。检查只在提交前完成，检查过程不写进任何故事字段。';

// Direct completed interactions addressed to the real user, not proposals or quoted scene dialogue.
export function inventedOpeningInteraction(text=''){
 const direct=String(text).replace(/[“「『"][^”」』"]*[”」』"]/g,'');
 return direct.split(/[。！？；\n]/).some(clause=>{
  const prior=/(?:听你|你)(?:刚才|最近|之前|先前)?问的(?:那些|这些|几个|那几个|这几个)问题/.exec(clause);
  if(prior&&!/(?:如果|假如|要是|以后|下次|没有|还没|没听|并未)[^，,。！？]{0,12}$/.test(clause.slice(0,prior.index)))return true;
  if(/(?:如果|假如|要是|下次|改天|以后|下个周末|打算|准备|想|可以|要不要|还没|没有|没(?:教|带|陪)|没曾|从没|并未|不曾)/.test(clause))return false;
  return /(?:我|上次|昨天|前天|那天|这个周末|这周末)[^，。！？]{0,12}(?:教|带|陪)你[^，。！？]{0,20}(?:过|的那|的这)/.test(clause)
   ||/(?:你还记得|还记得吗)[^，。！？]{0,16}(?:我们|咱俩|咱们)/.test(clause)
   ||/(?:我们|咱俩|咱们)(?:上次|昨天|前天|那天|这个周末)[^，。！？]{0,12}(?:一起|一块)(?:去|做|上|烤|吃|玩)/.test(clause);
 });
}

// Explicit own-sibling claims only, without treating a friend's sibling as the user's.
export function siblingClaims(text=''){
 const clean=String(text).replace(/[“「『"][^”」』"]*[”」』"]/g,'');const found=[];
 for(const m of clean.matchAll(/(?:我(?:的|有(?:一个|一位|个)?)?|家里的?)(哥哥|姐姐|弟弟|妹妹)|(?:^|[。！？；\n])\s*(哥哥|姐姐|弟弟|妹妹)(?=给我|对我|问我|叫我|陪我)/g)){
  const before=clean.slice(Math.max(0,m.index-10),m.index);if(/(?:朋友|同事|她|他|对方)(?:的)?$/.test(before)||/(?:没有|没|不是|独生)[^。！？]{0,4}$/.test(before))continue;found.push(m[1]||m[2]);
 }return found;
}
