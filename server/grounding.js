import {coordinates} from '../src/context.js';
﻿import { AppError } from './core.js';
// Conservative guard for common claims about the real past. It is not a semantic verifier.
export function checkStoryGrounding(story,background){
 const source=JSON.stringify(background);
 const fields=[...['title','identity','intro','character','opening'].map(key=>({field:key,text:story[key]})),...(story.scenes||[]).flatMap((s,i)=>['time','title','text'].map(key=>({field:`scenes.${i}.${key}`,text:s[key]})))].filter(f=>typeof f.text==='string');
 const text=fields.map(f=>f.text).join('。');
 const unsupported=[
  {claim:/(?:^|[。！？；\n])\s*(?:(?:我|我们|你|咱们)(?:还|在|的|记得|想起)?(?:小时候|童年|从小|儿时)|(?:小时候|儿时|从小)(?=[，,]|我|我们|就|便|经常|常|爱|喜欢|和|跟|住|在|学|被|父|家|放|是)|童年(?:时|的时候|里)[，,]?(?:我|我们|就|和|在))/,provided:/小时候|童年|从小|儿时/},
  {claim:/(?:不是|是|读的|原来的)[^。！？，]{0,10}专业|本科毕业|大专毕业/,provided:/专业|本科|大专|大学|升学/},
  {claim:/应届生|应届毕业/,provided:/应届生|应届毕业/},
  {claim:/私企时期|原来的私企|以前在私企/,provided:/私企/},
  {claim:/老家(?:是|在)|家乡(?:是|在)|出生在|长大(?:的|在)/,provided:/老家|家乡|出生地|长大/},
  {claim:/求职市场[^。]{0,15}(?:动荡|萎缩|低迷)|招聘(?:名额|数量)[^。]{0,10}(?:下降|增加|减少)/,provided:/$a/}
 ];
 const fromBirth=coordinates(background).forkAge===0||/从出生|出生时/.test(background.hypotheticalDirection||'');
 const failed=unsupported.findIndex((rule,i)=>rule.claim.test(text)&&!rule.provided.test(source)&&!(fromBirth&&i<5&&!/现实中|你(?:小时候|从小)|我们小时候/.test(text)));
 if(failed>=0)throw new AppError('background_conflict',422,{stage:'business',reason:['unprovided_childhood','unprovided_education','unprovided_graduation','unprovided_employer','unprovided_hometown','unsourced_trend'][failed],field:fields.find(f=>unsupported[failed].claim.test(f.text))?.field});
 return story;
}

export function checkChatGrounding(text,background,memories=[]){
 const provided=JSON.stringify({background,memories:memories.filter(m=>m.type==='reality')});
 // A city of upbringing alone does not license a shared childhood scene.
 if(!(coordinates(background).forkAge===0||/从出生|出生时/.test(background.hypotheticalDirection||'')) && /那些[^。！？]{0,70}(?:玩耍|上学|放学)[^。！？]{0,30}(?:日子|时候)|小时候[^。！？]{0,60}(?:一起|常去|玩耍)/.test(text) && !/童年|小时候|儿时|玩耍/.test(provided))throw new AppError('background_conflict',422);
 if(/已保存到记忆|要记住这件事吗|已存入记忆/.test(text))throw new AppError('invalid_response',502);
 return text;
}
