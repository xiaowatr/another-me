async function request(path, body) {
  let response;
  try { response = await fetch(path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(100000) }); }
  catch { throw new Error('本地服务连接中断或请求超时。输入已保留，请确认服务开启后重试。'); }
  let data;
  try { data = await response.json(); } catch { throw new Error('本地服务返回异常，请重新启动项目后重试。'); }
  if (!response.ok) throw new Error(data.error || '请求失败，请手动重试。');
  return data;
}
export const experience = {
  restore: (snapshot,previousSessionId) => request('/api/session/restore',{snapshot,previousSessionId}),
  status: () => request('/api/status'),
  getStory: (input) => request('/api/story', input),
  reply: (input) => request('/api/chat', input),
};

export async function streamReply(input,{signal,onEvent}) {
  const response=await fetch('/api/chat/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal});
  if(!response.ok)throw new Error('请求失败，输入已保留，请重试。');
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',done=false;
  try{while(true){const value=await reader.read();if(value.done)break;buffer+=decoder.decode(value.value,{stream:true});let n;while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n);buffer=buffer.slice(n+1);if(!line.trim())continue;const event=JSON.parse(line);if(event.type==='error')throw new Error(event.error);if(event.type==='done')done=true;onEvent(event);}}if(!done)throw new Error('回复中断，已展示的文字保留。可以手动重试。');}finally{reader.releaseLock();}
}
export async function confirmSeen(input){
 const response=await fetch('/api/chat/seen',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw new Error('已显示内容未能同步，请停止并检查本地服务。');
}
