const KEY='another-me.pending-story.v1';
export function pendingStory(){try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;}}
export function clearPendingStory(id){try{if(pendingStory()?.taskId===id)localStorage.removeItem(KEY);}catch{}}
const save=value=>{try{localStorage.setItem(KEY,JSON.stringify(value));}catch{throw new Error('暂时无法保存草稿与恢复信息，尚未提交生成。请先备份文字。');}};
const wait=signal=>new Promise((resolve,reject)=>{const done=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);resolve();},abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(signal.reason);};const timer=setTimeout(done,1500);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});});
export function createStoryClient(request){return {
 async get(input,signal,trace,onSetting){
  let task=pendingStory(),created=false;const start=performance.now();
  if(task&&JSON.stringify(task.input)!==JSON.stringify(input)){const e=new Error('上一份内容尚有待恢复的结果，请先恢复或取消。');e.category='task_input_changed';throw e;}
  if(!task){const status=await request('/api/status',undefined,signal);task={taskId:trace||crypto.randomUUID(),instanceId:status.instanceId,input,submitted:false,startedAt:new Date().toISOString()};save(task);created=true;}
  if(task.result){if(task.result.kind==='clarification')clearPendingStory(task.taskId);return {...task.result,taskId:task.taskId};}
  try{
   let state;
   if(!task.submitted){task.submitted=true;save(task);try{state=await request('/api/story',{taskId:task.taskId,instanceId:task.instanceId,input},signal,task.taskId);}catch(e){if(['capacity','busy'].includes(e.category)){task.submitted=false;save(task);}throw e;}}
   else state=await request('/api/story/tasks/'+task.taskId,undefined,signal,task.taskId);
   const showSetting=()=>{if(state.status==='running'&&state.settingNote?.length)onSetting?.(state.settingNote);};showSetting();
   while(state.status==='running'){if(performance.now()-start>115000){const e=new Error('连接等待较久，草稿已保留。可点击“恢复生成结果”查看原任务，无需重新生成。');e.category='network';throw e;}await wait(signal);state=await request('/api/story/tasks/'+task.taskId,undefined,signal,task.taskId);showSetting();}
   if(state.status==='succeeded'){task.result=state.result;if(state.result.kind==='clarification')clearPendingStory(task.taskId);else save(task);return {...state.result,taskId:task.taskId,clientTiming:{clientTraceId:task.taskId,requestId:state.result.requestId||task.taskId,startedAt:task.startedAt,responseReceivedMs:Math.max(0,Date.now()-Date.parse(task.startedAt)),recoveryWaitMs:Math.round(performance.now()-start),recovered:!created}};}
   clearPendingStory(task.taskId);const e=new Error(state.error?.error||'这次生成未完成，填写内容已保留。');Object.assign(e,state.error,{message:state.error?.error||e.message});throw e;
  }catch(e){if(['network','timeout'].includes(e.category))e.message='连接暂时中断，草稿已保留。请点击“恢复生成结果”查看原任务，无需重新生成。';e.requestId||=task.taskId;e.timing={clientTraceId:task.taskId,requestId:e.requestId,startedAt:task.startedAt,completeMs:Math.max(0,Date.now()-Date.parse(task.startedAt)),errorCategory:e.category||'unknown',aborted:Boolean(signal?.aborted)};throw e;}
 },async cancel(){const task=pendingStory();if(!task)return;if(task.submitted)try{await request('/api/story/tasks/'+task.taskId+'/cancel',{},undefined,task.taskId);}catch(e){if(!['task_missing','task_expired'].includes(e.category))throw e;}clearPendingStory(task.taskId);},ack:clearPendingStory};}
