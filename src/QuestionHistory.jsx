import React from 'react';
import {questionHistory} from './question-history.js';
export default function QuestionHistory({background}){
 const {rows,recorded}=questionHistory(background);
 return <details className="question-history"><summary>生成前的追问与回答{rows.length>0?`（${rows.length}）`:''}</summary>{rows.length?<ol>{rows.map(r=><li key={r.id}><p><span className="small">{r.kind} · </span>{r.question}</p>{r.kind==='历史复用'&&<p className="small">{r.applicable?'已核对适用于本次':'来源保留，本次未应用'}</p>}{r.origin&&<p className="small">原节点：{r.origin.node.forkAge||'未填'}岁 · {r.origin.timeScope}</p>}{r.skipped&&<p className="small">已跳过{r.text||r.selected.length?'（以下是跳过前保留的填写内容，不作为有效回答）':''}</p>}{r.selected.length>0&&<p>所选：{r.selected.join('；')}</p>}{r.text&&<p>自己输入：{r.text}</p>}{!r.skipped&&!r.text&&!r.selected.length&&<p className="small">没有保存回答</p>}</li>)}</ol>:<p className="small">{recorded?'本次没有展示追问。':'这篇故事没有可用的追问记录。'}</p>}</details>;
}
