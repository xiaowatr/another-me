export function beijingNow(now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 return {timeZone:'Asia/Shanghai',utcOffset:'+08:00',date:parts.year+'-'+parts.month+'-'+parts.day,time:parts.hour+':'+parts.minute,hour:Number(parts.hour),scope:'现实用户此刻的北京时间；不是故事内日期或角色事件时刻'};
}
export const REALTIME_RULE='realWorldNow是服务器在本次请求提供的北京时间（Asia/Shanghai，UTC+8），现实问候、几点了及是否深夜依据它，不能从故事末章的夜晚或旧聊天推断用户现在的时间。故事正文、角色回忆和事件间隔继续遵守故事时间，不能用现实日期覆盖。除非用户自己说要睡、困了、休息或说明其作息，不主动催睡、说晚安或拿作息结束话题；即使北京时间已晚也不自动催促。用户下午说想午睡时可以自然回应，不把所有睡眠话题屏蔽。用户没有询问现实时间时，不主动提用户此刻几点、早晚、该睡觉或该起床。用户直接问现实几点时照本次realWorldNow回答；缺失或无效就明确说不知道，不估计。不要机械播报时间。开场不得因故事发生在深夜就把现实用户当成也在深夜。';

// Only standalone real-world clock questions bypass the model; story-event questions do not.
export function directBeijingReply(message,now=new Date()){
 const text=String(message||'').trim().replace(/[，,。.!！?？\s]/g,'');
 if(!/^(?:(?:请问|告诉我|你知道|你能告诉我|那|所以|再问一下))?(?:(?:现在|此刻|目前)(?:北京(?:时间)?)?|北京(?:时间)?(?:现在)?)(?:是|有)?(?:几点(?:钟|了)?|什么时间|几点几分)(?:了|吗|呢|呀|啊)?$/.test(text)&&!/^(?:几点了|现在的北京时间|现在北京时间是多少|北京时间是多少)$/.test(text))return null;
 try{const time=beijingNow(now);return '北京时间现在是'+time.time+'。';}catch{return '我现在拿不到可靠的北京时间，就不猜了。';}
}
