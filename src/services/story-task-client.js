import {STORY_MAX_MODEL_CALLS} from '../story-budget.js';
const OP='another-me.story-operation.v1';
export function resetStoryOperation(){try{localStorage.removeItem(OP);}catch{}}
const operation=()=>{try{return JSON.parse(localStorage.getItem(OP)||'null');}catch{return null;}};
const remember=value=>localStorage.setItem(OP,JSON.stringify(value));
const signature=input=>JSON.stringify(Object.fromEntries(Object.entries(input.background||{}).filter(([k])=>!k.startsWith('followup'))));
const KEY='another-me.pending-story.v1';
export function pendingStory(){try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;}}
export function clearPendingStory(id){try{if(pendingStory()?.taskId===id)localStorage.removeItem(KEY);}catch{}}
const save=value=>{try{localStorage.setItem(KEY,JSON.stringify(value));}catch{throw new Error('暂时无法保存草稿与恢复信息，尚未提交生成。请先备份文字。');}};
const wait=signal=>new Promise((resolve,reject)=>{const done=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);resolve();},abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(signal.reason);};const timer=setTimeout(done,1500);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});});
export function createStoryClient(request,{pause=wait}={}){return {
 async get(input,signal,trace,onSetting,onRecover=()=>{}){
  let task=pendingStory(),created=false;const start=performance.now();
  if(task&&JSON.stringify(task.input)!==JSON.stringify(input)){const e=new Error('上一份内容尚有待恢复的结果，请先恢复或取消。');e.category='task_input_changed';throw e;}
  if(!task){const status=await request('/api/status',undefined,signal);const previous=operation();if(previous?.instanceId&&previous.instanceId!==status.instanceId){resetStoryOperation();throw Object.assign(new Error('服务已重新启动，旧任务关联已解除，草稿仍保留。请再次点击生成。'),{category:'task_expired'});}const parent=previous&&['clarification','failed'].includes(previous.status)&&(previous.status==='clarification'||previous.signature===signature(input))?previous:null;if(parent&&(parent.exhausted||parent.cumulativeCallCount>=STORY_MAX_MODEL_CALLS))throw Object.assign(new Error('这次生成已达到尝试上限，填写内容已保留。'),{category:'retry_exhausted'});task={taskId:trace||crypto.randomUUID(),parentTaskId:parent?.taskId||null,continuation:parent?(parent.status==='clarification'?'clarification':'rewrite'):null,instanceId:status.instanceId,input,submitted:false,startedAt:new Date().toISOString()};save(task);created=true;}
  if(task.result){if(task.result.kind==='clarification')clearPendingStory(task.taskId);return {...task.result,taskId:task.taskId};}
  let reconnects=0;
  const transient=e=>['network','timeout'].includes(e.category)&&!signal?.aborted;
  const getState=async(initialFailure=null)=>{let error=initialFailure;while(true){
   if(error){if(!transient(error)||reconnects>=2)throw error;reconnects++;onRecover(true);await pause(signal);}
   try{const state=await request('/api/story/tasks/'+task.taskId,undefined,signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000),task.taskId);onRecover(false);return state;}catch(e){error=e;}
  }};
  try{
   let state;
   if(!task.submitted){task.submitted=true;save(task);try{state=await request('/api/story',{taskId:task.taskId,instanceId:task.instanceId,parentTaskId:task.parentTaskId,continuation:task.continuation,input},signal,task.taskId);}catch(e){if(['capacity','busy'].includes(e.category)){task.submitted=false;save(task);throw e;}if(transient(e))state=await getState(e);else{e.submissionRejected=true;throw e;}}}
   else state=await getState();
   const showSetting=()=>{if(state.status==='running'&&state.settingNote?.length)onSetting?.(state.settingNote);};showSetting();
   while(state.status==='running'){if(performance.now()-start>115000){const e=new Error('连接等待较久，草稿已保留。可点击“恢复生成结果”查看原任务，无需重新生成。');e.category='network';throw e;}await pause(signal);state=await getState();showSetting();}
   if(state.status==='succeeded'){remember({taskId:task.taskId,instanceId:task.instanceId,signature:signature(input),status:state.result.kind==='clarification'?'clarification':'succeeded',rewriteCount:state.rewriteCount||0,cumulativeCallCount:state.cumulativeCallCount});task.result=state.result;if(state.result.kind==='clarification')clearPendingStory(task.taskId);else save(task);return {...state.result,taskId:task.taskId,clientTiming:{clientTraceId:task.taskId,requestId:state.result.requestId||task.taskId,startedAt:task.startedAt,responseReceivedMs:Math.max(0,Date.now()-Date.parse(task.startedAt)),recoveryWaitMs:Math.round(performance.now()-start),recovered:!created}};}
   remember({taskId:task.taskId,instanceId:task.instanceId,signature:signature(input),status:'failed',rewriteCount:state.rewriteCount||0,cumulativeCallCount:state.cumulativeCallCount});clearPendingStory(task.taskId);const e=new Error(state.error?.error||'这次生成未完成，填写内容已保留。');Object.assign(e,state.error,{terminal:state.status==='failed',rewriteCount:state.rewriteCount||0,cumulativeCallCount:state.cumulativeCallCount,message:state.error?.error||e.message});throw e;
  }catch(e){if(e.submissionRejected&&['task_missing','task_expired'].includes(e.category)){clearPendingStory(task.taskId);resetStoryOperation();e.message='旧任务关联已失效，本次尚未开始生成。草稿仍保留，请再次点击生成。';}else if(e.submissionRejected&&e.category==='retry_exhausted'){clearPendingStory(task.taskId);const previous=operation();remember({...previous,taskId:previous?.taskId||task.parentTaskId,instanceId:task.instanceId,signature:signature(input),status:'failed',exhausted:true});}else if(e.category==='task_missing'){e.message='暂时找不到原任务，无法确认它的结果。草稿仍保留，请取消原任务关联后再决定是否重新生成。';}if(!e.terminal&&['network','timeout'].includes(e.category))e.message='连接暂时中断，草稿已保留。请点击“恢复生成结果”查看原任务，无需重新生成。';e.requestId||=task.taskId;e.timing={clientTraceId:task.taskId,requestId:e.requestId,startedAt:task.startedAt,completeMs:Math.max(0,Date.now()-Date.parse(task.startedAt)),errorCategory:e.category||'unknown',aborted:Boolean(signal?.aborted)};throw e;}
 },async cancel(){const task=pendingStory();if(!task)return;if(task.submitted)try{await request('/api/story/tasks/'+task.taskId+'/cancel',{},undefined,task.taskId);}catch(e){if(!['task_missing','task_expired'].includes(e.category))throw e;}clearPendingStory(task.taskId);resetStoryOperation();},ack:id=>{clearPendingStory(id);resetStoryOperation();}};}
