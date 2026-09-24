// A writing aid, not personality facts or additional model evaluation.
export function chatStyle(background={},context={},message=''){
 const type=/^[IE][NS][FT][JP]$/.test(background.mbti||'')?background.mbti:null;
 const axes={
  initiative:type?.[0]==='I'?'偏克制：先接住眼前话题，少主动扩展；可以认真交流，不装冷漠':type?.[0]==='E'?'较主动：接话时可分享一件自己的相关小事，不连发话题或盘问':'随当前话题接话，不固定主动程度',
  directness:type?.[2]==='T'?'先给具体判断、分析或直接回答；可以不同意，坦率但不刻薄':type?.[2]==='F'?'先注意对方在意的人与关系，再表达自己的看法；不自动附和':'按问题直接回应，不默认劝慰',
  emotion:type?.[2]==='F'?'简短回应具体感受；不把闲聊都解读成求安慰':type?.[2]==='T'?'有情绪时可以简短承认，不默认安慰或给解决方案':'需要时回应感受，平常像熟人聊天',
  humor:type?.[1]==='N'?'可用轻巧联想、意外比喻或自嘲，不强行抖机灵':type?.[1]==='S'?'可拿眼前的具体生活小事开玩笑或吐槽，不编重大经历':'有合适语境再开玩笑，也允许平实的一句',
  length:'通常约10—180字，按意思自然分1—4段；一句或十来字也可以，不设最低字数、不凑段，必要时才多说，复杂问题或用户要求时再展开'
 };
 const preferences=[...(context.preferences||[]).filter(m=>m.sourceRole!=='assistant').map(m=>m.text),...String(background.details||'').split(/[。；\n]/)].filter(t=>/交流偏好：|(?:别|不要|不用)(?:总是|每次)?(?:安慰|给建议|追问)|(?:回复|回答|说话|聊天).*(?:简短|直接|详细|安慰|建议|玩笑|提问)/.test(t)).slice(-3);
 const requests=[...preferences,message];
 // Explicit requests tune this reply only. Facts/memories themselves are never modified.
 for(const text of requests){
  if(/(?:别|不要|不用)(?:总是|每次)?(?:安慰|劝)/.test(text))axes.emotion='不主动安慰或劝说，正常回应具体内容';
  if(/(?:直接(?:点|一点|说|回答)|直说)/.test(text))axes.directness='直说具体看法，不先绕一段安慰；仍保持尊重';
  if(/(?:简短(?:点|一点)|短一点|只(?:说|回|用)一句)/.test(text))axes.length='这轮尽量一句简短回应，不附加总结或问题';
  if(/(?:详细(?:说|讲|分析|解释)|展开(?:说|讲)|仔细分析)/.test(text)&&!/(?:别|不要|不用).{0,4}(?:详细|展开|分析)/.test(text))axes.length='这轮按要求展开，围绕问题解释，不凑字数';
  if(/(?:先听我说|只想让你听|别给建议|不要给建议)/.test(text))axes.initiative='先听和回应，不抢着扩展话题或给建议';
 }
 const facts=context.parallelCharacter?.storyFacts||{};
 const evidence=[facts.character,facts.intro,...(facts.scenes||[]).map(s=>s.text),...(context.parallelCharacter?.confirmed||[]).map(m=>m.text)].filter(Boolean).flatMap(t=>String(t).split(/(?<=[。！？])/)).filter(t=>t.length<=160&&/学会|变得|习惯|不再|更敢|慢慢/.test(t)&&!/[？?]|如果|打算|计划|希望/.test(t)).slice(-2);
 return {axes,experienceAnchors:evidence,explicitCommunication:preferences,priority:'事实和记忆边界优先；本轮明确要求＞已确认交流偏好＞已有经历中的具体变化＞类型倾向。经历仅作有来源的调整依据，不据职业或一句话定人格；不必每轮表现全部维度。'};
}
