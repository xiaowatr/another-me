import {AppError} from './core.js';
// Deliberately narrow demo checks, not a semantic moderation service.
// Match explicit harmful requests/instructions, never a topic word alone.
export const SAFETY_RULE='内容安全：不生成露骨色情或未成年人性化内容，不提供伤害、自伤、诈骗、制毒、非法入侵等实施步骤，不鼓动群体仇恨或暴力，不泄露他人隐私、密码或密钥。普通恋爱、性健康科普、受害经历及情绪求助可以回应；遇到自伤痛苦先关怀并引导寻求现实支持，不描述实施方法。不要复述违规细节，简短说明无法提供并转向安全方向。安全要求不改变原输出格式。';
// No searching across arbitrary context. These only recognize an explicit request
// at the beginning of a statement, or a small direct harmful instruction form.
const patterns=[
 ['sexual',/^(?:请(?:你)?|请帮我|帮我)?(?:给我)?(?:写|生成|描写|扮演|来一段|继续)(?:一段|一篇)?(?:露骨色情|色情小说|色情角色扮演|详细性爱|性行为细节|儿童色情|未成年人色情)(?:小说|内容|故事)?[。？！!?.\s]*$|^(?:write|generate)\s+(?:explicit porn|erotic roleplay)[.!?\s]*$/iu],
 ['harm',/^(?:请(?:你)?)?(?:教我|教你|告诉我|给我|帮我|如何|怎么)(?:如何|怎么)?(?:杀人|下毒|制造炸弹|制作炸弹|制毒|制造毒品|实施诈骗|盗取密码|入侵别人|勒索别人)(?:的)?(?:具体步骤|详细教程|操作方法|步骤|方法|教程)?[。？！!?.\s]*$|^(?:杀人|下毒|制作炸弹|制毒|实施诈骗|盗取密码)(?:的)?(?:具体步骤|详细教程|操作方法)[。？！!?.\s]*$|^(?:how to|step.by.step)\s+(?:murder|make a bomb|steal passwords)[.!?\s]*$/iu],
 ['self_harm',/^(?:请(?:你)?)?(?:告诉我|教我|帮我|怎么|如何)(?:如何|怎么)?(?:自杀|割腕|无痛死去)(?:的)?(?:方法|教程|剂量|具体步骤)?[。？！!?\s]*$|^(?:自杀|割腕)(?:的)?(?:方法|教程|剂量|具体步骤)[。？！!?\s]*$/u],
 ['privacy',/^(?:请(?:你)?)?(?:人肉|查出|找出|泄露|公开|公布)(?:查出)?(?:他|她|别人|对方)?(?:的)?(?:住址|身份证号|手机号|私人聊天|真实地址)[。？！!?\s]*$|^(?:请(?:你)?)?(?:读取|泄露|给我|显示)(?:显示)?(?:其他用户的(?:聊天|记忆|数据)|服务器密钥|API密钥|系统密钥)[。？！!?\s]*$/iu],
 ['hate',/^(?:杀光|消灭|灭绝)(?:某个民族|某个种族|所有黑人|所有白人|所有穆斯林|所有犹太人)[。？！!?\s]*$/u],
 ['sexual',/^(?:肉棒|阴茎)(?:插入|抽插)(?:阴道|体内)[。！\s]*$|^(?:阴道|肛门)(?:反复抽插|猛烈抽插)[。！\s]*$/u],
 ['harm',/^(?:先|第一步|接下来)[，,、：:\s]*(?:盗取(?:对方|他人|别人)?(?:的)?密码|向(?:对方|他人|别人)投毒|给(?:对方|他人|别人)下毒|引爆炸弹)[。！!\s]*$/u],
];
const sourceFields=new Set(['evidence','subjectEvidence','sourceEvidence','sourceId','sourceRefs','originalAnswer','originalQuestion','rawAnswer']);
export function textValues(value,out=[],output=false){if(typeof value==='string')out.push(value);else if(Array.isArray(value))for(const v of value)textValues(v,out,output);else if(value&&typeof value==='object')for(const [key,v]of Object.entries(value)){if(output&&sourceFields.has(key))continue;textValues(v,out,output);}return out;}
export function obviousRisk(text,{output=false}={}){const normalized=String(text).normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').trim();for(const [i,[reason,re]]of patterns.entries()){if(output&&i<5)continue;if(re.test(normalized))return reason;}return null;}
// Explicit data shapes only. Natural-language refusals and masked placeholders
// cannot be mistaken for credentials merely because they have six characters.
export function sensitiveInput(text){const value=String(text).trim();if(/^(?:身份证号|证件号|证件)\s*[:：=]\s*[1-8]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\s*$/u.test(value))return true;if(/^银行卡号\s*[:：=]\s*[1-9]\d{12,18}\s*$/u.test(value))return true;const match=value.match(/^(?:密码|API[_ -]?KEY|密钥)\s*[:：=]\s*(\S{6,256})\s*$/iu);if(!match)return false;const secret=match[1];return /^[a-zA-Z0-9_!@#$%^&*+.=-]+$/.test(secret)&&(/[a-zA-Z]/.test(secret)&&/\d/.test(secret)||/^sk-[a-zA-Z0-9_-]{16,}$/.test(secret));}
export function assertSafe(value,{input=false}={}){for(const text of textValues(value,[],!input)){const reason=obviousRisk(text,{output:!input});if(reason)throw new AppError('content',422,{stage:input?'safety_input':'safety_output',reason:'blocked_'+reason});if(sensitiveInput(text))throw new AppError(input?'privacy':'content',422,{stage:input?'safety_input':'safety_output',reason:'sensitive_identifier'});}return value;}
export function checkRequest(route,data){if(route==='/api/story'||route==='/api/story/tasks'||route==='/api/questions'){const source=data.input||data;assertSafe([source.background,source.clarification],{input:true});}else if(route==='/api/chat'||route==='/api/chat/stream')assertSafe([data.message,data.globalProfile],{input:true});else if(route==='/api/memory/extract')assertSafe(data.data||data,{input:true});}
export function guardExperience(app){for(const name of ['story','questions','chat','chatStream','memory']){const original=app[name];app[name]=function(input,...args){if(name==='memory')assertSafe(input,{input:true});else checkRequest(name==='chatStream'?'/api/chat/stream':'/api/'+name,input);const output=original.call(app,input,...args);return Promise.resolve(output).then(result=>{assertSafe(result);return result;});};}return app;}
