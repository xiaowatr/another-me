import React from 'react';
export default function ConversationSummary({rows=[]}){
 if(!rows.length)return null;
 const pending=rows.filter(row=>row.mode!=='summary').length;
 return <details className="conversation-recap"><summary>聊天回顾 · {rows.length} 条{pending?`（${pending} 条待归纳）`:''}</summary><p className="small">这里保留聊天内容；已保存、可供后续聊天参考的个人事实在上方“关于你的记忆”。</p><ol>{rows.map(row=><li key={row.sourceId}><p>{row.text}</p>{row.mode==='summary'?<details><summary>原话</summary><p>{row.sourceText}</p></details>:<small>原话已保存，尚未完成归纳</small>}</li>)}</ol></details>;
}
