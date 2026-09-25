import React from 'react';
const descriptions={invalid_response:'提取结果未通过格式或内容检查，尚未保存为记忆。',network:'连接中断，暂时无法确认原整理请求的结果。',timeout:'等待结果超时，暂时无法确认原整理请求的结果。',task_expired:'服务实例已变化，原整理任务需要恢复处理。',task_missing:'暂时找不到原整理任务。',task_input_changed:'本次内容与原整理任务不一致，已停止写入。',capacity:'服务暂时繁忙，本次整理未完成。',busy:'上一项请求尚未结束。',balance:'模型服务报告余额不足。',configuration:'模型服务配置异常。',output_limit:'提取输出达到长度限制，结果不完整。',memory_processing:'本机接收或保存结果时未能完成，需要结合日志确认原因。'};
const safeId=value=>/^[a-f0-9-]{36}$/i.test(value||'')?value:null;
export default function MemoryFailureDetails({meta}){
 if(meta?.review?.status!=='failed')return null;
 const job=meta.memoryJob,requestId=safeId(job?.requestId),batchId=safeId(job?.id);
 return <details className="small"><summary>查看记忆整理失败详情</summary><p>{descriptions[job?.error]||'本次整理未完成，现有记录不足以确定原因。'}</p>{requestId&&<p>请求编号：<code>{requestId}</code></p>}{batchId&&<p>整理批次：<code>{batchId}</code></p>}<p>这些编号可用于查找日志。展开详情不会重新调用模型。</p></details>;
}
