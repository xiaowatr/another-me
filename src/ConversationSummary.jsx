import React from 'react';
export default function ConversationSummary({rows=[]}){
 if(!rows.length)return null;
 return <section className="memory-panel"><h3>聊天总结</h3><p className="small">按发言顺序整理，包括状态、心情、问题与纠正。语气描述是当时的观察，不代表固定性格；较晚的纠正以较晚发言为准。</p>{rows.map((row,i)=><article className="memory-item" key={row.sourceId}><span className="tag">第 {i+1} 条 · {row.mode==='summary'?'归纳':'原话摘录 · 待归纳'}</span><p className="memory-body">{row.text}</p>{row.mode==='summary'&&<details className="memory-source"><summary>查看原话</summary><p>{row.sourceText}</p></details>}</article>)}</section>;
}
