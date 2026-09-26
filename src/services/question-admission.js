const taskNames={memory:'上一段聊天的记忆整理',chat:'上一条聊天回复',story:'上一份故事生成',questions:'上一组补充问题'};
function pause(ms,signal){return new Promise((resolve,reject)=>{const stop=()=>{clearTimeout(timer);signal?.removeEventListener('abort',stop);reject(new DOMException('已停止等待','AbortError'));};const timer=setTimeout(()=>{signal?.removeEventListener('abort',stop);resolve();},ms);signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)stop();});}
// Only readiness checks are repeated; uncertain/model failures are never resubmitted.
export async function planWhenReady(request,background,signal,onWait=()=>{},options={}){
 const now=options.now||Date.now,sleep=options.sleep||pause,deadline=now()+(options.waitMs??45000);let waits=0;
 for(;;){signal?.throwIfAborted();const status=await request('/api/availability',null,signal);
  if(status.available){onWait('正在理解你的补充…');try{return await request('/api/questions',{background},signal);}catch(e){if(e.category!=='busy'||!e.retryableBeforeModel)throw e;}}
  const remaining=deadline-now();if(remaining<=0){const e=new Error('上一项后台任务仍在处理，补充内容已保留。请稍后再提交，不用重新填写。');e.category='busy';throw e;}
  onWait(`${taskNames[status.task]||'后台任务'}还在处理，正在等待，结束后会自动继续。`);
  await sleep(Math.min(remaining,1000*2**Math.min(waits++,3)),signal);
 }
}
