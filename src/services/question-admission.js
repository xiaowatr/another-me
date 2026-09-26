const taskNames={memory:'上一段聊天的记忆整理',chat:'上一条聊天回复',story:'上一份故事生成',questions:'上一组补充问题'};
function pause(ms,signal){return new Promise((resolve,reject)=>{const stop=()=>{clearTimeout(timer);signal?.removeEventListener('abort',stop);reject(new DOMException('已停止等待','AbortError'));};const timer=setTimeout(()=>{signal?.removeEventListener('abort',stop);resolve();},ms);signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)stop();});}
// Transport recovery reattaches the same owner/input cached task; model retries live on the server.
export async function planWhenReady(request,background,signal,onWait=()=>{},options={}){
 const now=options.now||Date.now,sleep=options.sleep||pause,deadline=now()+(options.waitMs??45000);let waits=0;
 async function recover(path,body){for(let attempt=1;attempt<=3;attempt++){signal?.throwIfAborted();try{return await request(path,body,signal);}catch(e){signal?.throwIfAborted();if(attempt===3||!['network','timeout'].includes(e.category))throw e;onWait(`连接暂时中断，正在接回补充问题（${attempt+1}/3）…`);await sleep(attempt*1000,signal);}}}
 for(;;){signal?.throwIfAborted();const status=await recover('/api/availability',null);
  if(status.available){onWait('正在读你写下的这些…');try{return await recover('/api/questions',{background});}catch(e){if(e.category!=='busy'||!e.retryableBeforeModel)throw e;}}
  const remaining=deadline-now();if(remaining<=0){const e=new Error('上一项后台任务仍在处理，补充内容已保留。请稍后再提交，不用重新填写。');e.category='busy';throw e;}
  onWait(`${taskNames[status.task]||'后台任务'}还在处理，正在等待，结束后会自动继续。`);
  await sleep(Math.min(remaining,1000*2**Math.min(waits++,3)),signal);
 }
}
