import { MBTI_TYPES,activeBackground } from '../src/background.js';
﻿import { coordinateError,coordinates } from '../src/context.js';
import { jsonrepair } from 'jsonrepair';
export class AppError extends Error {
  constructor(category, status = 400, diagnostic = null) { super(category); this.category = category; this.status = status; this.diagnostic=diagnostic; }
}
export const errorMessages = {
  background_conflict: '这次故事有些内容与设定不一致，没能生成成功。你填写的内容还在，可以重试。',
  stopped: '本轮回复已停止，未展示内容不会进入后续对话。',
  configuration: '服务配置有误，请检查本地密钥、国内/国际站和模型配置后重启。',
  balance: 'MiniMax 账户余额不足，请在对应站点核对余额后重试。',
  rate_limit: '请求过于频繁，请稍后手动重试。',
  network: '暂时无法连接模型服务，请检查网络后重试。',
  timeout: '模型回复超时，请稍后手动重试。此次请求可能已产生用量。',
  upstream: '模型服务暂时不可用，请稍后手动重试。',
  invalid_response: '这次没能生成成功，你填写的内容还在。可以重试。',
  content: '本次内容无法由模型处理，请调整输入后重试。',
  input: '请检查输入内容；必填内容不能为空，且不能超过长度限制。',
  session: '当前故事会话已失效，请返回重新生成。',
  busy: '已有请求处理中，请等待完成。',
  memory_full: '本轮已保存较多纠正信息。请将最新信息整理到背景中，重新生成一个故事。',
  local_storage: '本地请求记录无法写入，已停止调用。请检查项目文件夹权限。',
  forbidden: '请求来源不受支持，请在本机页面中操作。',
};
export function classify(status, body) {
  const code = Number(body?.base_resp?.status_code ?? body?.error?.code);
  if (code === 1008 || status === 402) return 'balance';
  if ([1004, 2049, 2013, 1039].includes(code) || [401, 403, 404].includes(status)) return 'configuration';
  if (code === 1001) return 'timeout';
  if ([1002, 1041, 2045, 2056].includes(code) || status === 429) return 'rate_limit';
  if ([1026, 1027].includes(code)) return 'content';
  return status === 400 ? 'configuration' : 'upstream';
}
export function cleanContent(content) {
  if (typeof content !== 'string') throw new AppError('invalid_response',502,{stage:'content',reason:'missing_body'});
  const text = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (/<\/?think>/i.test(text)) throw new AppError('invalid_response',502,{stage:'content',reason:'unclosed_thinking'});
  return text;
}
function str(value, max) { return typeof value === 'string' && value.trim().length > 0 && value.length <= max; }
export function parseResult(content, task, diagnostic = {}) {
  let data;
  try { data = decodeJson(content,diagnostic); }
  catch(e) { throw new AppError('invalid_response', 502, e.diagnostic || {stage:'parse',reason:'json_syntax'}); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new AppError('invalid_response', 502,{stage:'schema',reason:'object_required'});
  if (task === 'chat') {
    if (!str(data.reply, 2500) || !['none', 'reality', 'fiction'].includes(data.updateType)) throw new AppError('invalid_response', 502);
    return { reply: data.reply, updateType: data.updateType };
  }
  if (data.kind === 'clarification' && str(data.question, 300)) return { kind: 'clarification', question: data.question };
  const flatKeys=[1,2,3].flatMap(i=>['time','title','text'].map(k=>'scene_'+i+'_'+k));
  const hasFlat=flatKeys.some(k=>Object.hasOwn(data,k));
  if(hasFlat){
    if(Object.hasOwn(data,'scenes')||!flatKeys.every(k=>Object.hasOwn(data,k)))throw new AppError('invalid_response',502,{stage:'schema',reason:'ambiguous_or_missing_chapters'});
    data={...data,scenes:[1,2,3].map(i=>Object.fromEntries(['time','title','text'].map(k=>[k,data['scene_'+i+'_'+k]])))};
    diagnostic.chapterFormat='flat_fields';
  }else if(typeof data.scenes==='string'){
    if(data.scenes.length>20000)throw new AppError('invalid_response',502,{stage:'schema',reason:'chapter_size'});
    try{data={...data,scenes:JSON.parse(data.scenes)};diagnostic.chapterFormat='encoded_array';}catch{throw new AppError('invalid_response',502,{stage:'parse',reason:'invalid_encoded_chapters'});}
  }

  if ((data.kind !== undefined && data.kind !== 'story') || !['title', 'identity', 'intro', 'character', 'opening'].every(k => str(data[k], 2000)) || !Array.isArray(data.scenes) || data.scenes.length !== 3 || !data.scenes.every(s => str(s.time, 60) && str(s.title, 150) && str(s.text, 2000))) throw new AppError('invalid_response', 502,{stage:'schema',reason:'story_fields'});
  return { kind: 'story', title: data.title, ...(typeof data.synopsis==='string'?{synopsis:data.synopsis.slice(0,180)}:{}), identity: data.identity, intro: data.intro, character: data.character, opening: data.opening, scenes: data.scenes.map(({ time, title, text }) => ({ time, title, text })) };
}
export function validateBackground(b) {
  if(b && 'realityOutcome' in b){
    if(!['realityOutcome','hypotheticalDirection'].every(k=>str(b[k],k==='forkTime'?80:1500)) || typeof b.details!=='string' || b.details.length>1500) throw new AppError('input');
    if(b.choiceReason && (typeof b.choiceReason!=='string'||b.choiceReason.length>1500))throw new AppError('input');
    if(b.gender && !['女','男','非二元','不透露'].includes(b.gender))throw new AppError('input');
    if(b.mbti && b.mbti!=='unknown' && !MBTI_TYPES.includes(b.mbti))throw new AppError('input');
    if(coordinateError(b))throw new AppError('input');
    if(b.inputVersion==='3' && !['eventContext','originalWish'].every(k=>str(b[k],1500)))throw new AppError('input');
    if(!['3','4','5','6'].includes(b.inputVersion) && !b.forkTime?.trim() && !coordinates(b).forkYear)throw new AppError('input');
    if(b.inputVersion==='6')return activeBackground(b);
    return Object.fromEntries(['gender','followupKey','followupQuestion','followupAnswer','followupSkipped','mbti','inputVersion','eventContext','originalWish',...(typeof b.locationText==='string'?['locationText']:[]),'birthYear','forkAge','forkYear','cityMode','city','cityType','why','feelings','realityOutcome','hypotheticalDirection','forkTime','keep','details','choice','age','reason','alternative'].map(k=>[k,typeof b[k]==='string'?b[k].trim().slice(0,1500):'']));
  }
  if (!b || !['choice','age','reason','alternative','keep'].every(k => str(b[k], k === 'age' ? 80 : 1500)) || typeof b.details !== 'string' || b.details.length > 1500) throw new AppError('input');
  return Object.fromEntries(['choice','age','reason','alternative','keep','details'].map(k => [k,b[k].trim()]));
}
export function loadConfig(env) {
  const key = (env.MINIMAX_API_KEY || '').trim();
  const site = env.MINIMAX_SITE || 'cn';
  const base = (env.MINIMAX_BASE_URL || (site === 'cn' ? 'https://api.minimax.cn/v1' : 'https://api.minimax.io/v1')).replace(/\/$/, '');
  const model = env.MINIMAX_MODEL || 'MiniMax-M2.5';
  const allowed = { cn: ['https://api.minimax.cn/v1','https://api.minimaxi.com/v1'], intl: ['https://api.minimax.io/v1'] };
  const valid = allowed[site]?.includes(base) && /^MiniMax-[\w.-]+$/.test(model);
  return { key, site, base, model, mode: key ? valid ? 'real' : 'configuration' : 'demo' };
}

// 仅记录预先允许的字段类型与长度，不记录模型原文或字段值。
export function responseShape(body) {
  const choice = body?.choices?.[0];
  const tools=choice?.message?.tool_calls;
  const content = Array.isArray(tools)&&tools.length===1&&['submit_story','ask_clarification'].includes(tools[0]?.function?.name)?tools[0].function.arguments:choice?.message?.content;
  const shape = { finish: ['stop','length','content_filter','tool_calls'].includes(choice?.finish_reason) ? choice.finish_reason : 'unknown', contentType: typeof content, contentLength: typeof content === 'string' ? content.length : null };
  try {
    const data = JSON.parse(cleanContent(content).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
    shape.json = true;
    shape.fields = Object.fromEntries(['kind','title','identity','intro','character','opening','question','reply','updateType'].map(k => [k, {type:typeof data?.[k],length:typeof data?.[k] === 'string' ? data[k].length : null}]));
    shape.sceneType=Array.isArray(data?.scenes)?'array':typeof data?.scenes;
    shape.flatChapterFields=[1,2,3].map(i=>Object.fromEntries(['time','title','text'].map(k=>{const v=data?.['scene_'+i+'_'+k];return [k,{type:typeof v,length:typeof v==='string'?v.length:null}]})));
    shape.sceneCount = Array.isArray(data?.scenes) ? data.scenes.length : null;
    shape.sceneFields=Array.isArray(data?.scenes)?data.scenes.slice(0,4).map(s=>Object.fromEntries(['time','title','text'].map(k=>[k,{type:typeof s?.[k],length:typeof s?.[k]==='string'?s[k].length:null}]))):null;
  } catch { shape.json = false; }
  return shape;
}

export function completeEnvelope(text){
 const stack=[];let quote=null,escape=false;
 for(const c of text){if(quote){if(escape){escape=false;continue;}if(c==='\\'){escape=true;continue;}if(c===quote)quote=null;continue;}
 if(c==='"' || c==="'"){quote=c;continue;}if(c==='{'||c==='[')stack.push(c);else if(c==='}'||c===']'){if(stack.pop()!==(c==='}'?'{':'['))return false;}}
 return !quote && stack.length===0;
}
function decodeJson(content,diagnostic){
 const text=cleanContent(content).replace(/^﻿/,'').replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 try{const data=JSON.parse(text);diagnostic.parseMode='strict';return data;}catch{}
 if(!text.startsWith('{') || !text.endsWith('}'))throw new AppError('invalid_response',502,{stage:'parse',reason:'json_envelope'});
 if(text.length>20000 || !completeEnvelope(text))throw new AppError('invalid_response',502,{stage:'parse',reason:'incomplete_structure'});
 try{const data=JSON.parse(jsonrepair(text));diagnostic.parseMode='syntax_repair';return data;}
 catch{throw new AppError('invalid_response',502,{stage:'parse',reason:'json_syntax'});}
}
