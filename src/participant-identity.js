// Shared participant contract; never infer the user's name from a story character.
export const PARTICIPANT_RULES='在故事开场与聊天中，模型扮演parallelCharacter（选择另一条路的自己），对话对象始终是realUser（屏幕前的现实自己）。故事里的朋友、同事等属于thirdPersons，不是对话对象；不能直接拿第三人的名字称呼用户。开场与后续聊天都遵守此定义。用户消息中的“我”指realUser，“你”通常指parallelCharacter；角色正文中的“我”指parallelCharacter，“你”指realUser。用户说“我是现实里没去的你”是在确认两条人生的自己，不是在介绍另一位朋友。身份纠正优先修正指代关系，不能改成用户拥有某位朋友或把角色经历倒灌给用户。';
export function participantIdentity(){return {assistant:{id:'parallelCharacter',pronoun:'我',meaning:'助手扮演选择另一条路的自己'},user:{id:'realUser',pronoun:'你',meaning:'屏幕前的现实自己，不是故事里的朋友或同事'},thirdPersons:{meaning:'故事中的朋友、同事等第三人，不能用其姓名称呼现实用户'},storyVoice:'故事正文和开场的第一人称属于平行角色；用户消息中的第一人称属于现实用户'};}
export function isIdentityCorrection(text){return /(?:你说错|不是我|不是你|我说的是)/.test(text||'')||/我不是[^。！？\n，,]{1,40}[，,；;]\s*我是/.test(text||'')||/我是(?:现实(?:中|里|里的)?|屏幕前)[^。！？\n]{0,80}(?:你|自己)/.test(text||'');}
const relation=/(?:朋友|同事|同学|邻居|亲戚|表哥|表弟|父亲|母亲)/;
export function inventedRelationship(text,evidence,source){return isIdentityCorrection(source)&&relation.test(text||'')&&!relation.test(evidence||'');}
// Only remove an explicit opening vocative anchored as a third person in input.
// This does not rewrite story scenes or claim general name/entity recognition.
export function safeOpeningAddress(opening,background={}){
 const value=String(opening||''),m=/^\s*([^，,：:！!。\n]{1,20})[，,：:]\s*(?=我|你|今天|最近|刚)/.exec(value);
 if(!m)return value;
 const address=m[1].trim(),source=[background.realityOutcome,background.hypotheticalDirection,background.details].filter(Boolean).join('。');
 const parts=source.split(/朋友|同事|同学|邻居|亲戚/).slice(1);
 if(!parts.some(p=>p.replace(/^(?:名叫|叫做|叫|是)?[“「\s]*/,'').startsWith(address)))return value;
 return value.slice(m[0].length).trim()||'我在这里，你想从哪件事聊起？';
}
