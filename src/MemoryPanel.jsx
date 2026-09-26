import React,{useState} from 'react';
import {sameMemory,candidateHasUserSource} from './memory-review';
const names={reality:'现实信息',preference:'态度与偏好',fiction:'角色经历或计划'};
export default function MemoryPanel({messages=[],memories,candidates,onCandidates,onMemories,onSaved=()=>{},onConfirm,disabled}){
 const [editing,setEditing]=useState(null),[text,setText]=useState(''),[error,setError]=useState('');
 const source=m=><details className="memory-source"><summary>查看来源</summary><p>{m.sourceText||'此前保存的内容'}</p></details>;
 return <section className="memory-panel">{error&&<p role="alert">{error}</p>}
 {candidates.length>0&&<section><h3>待保存内容</h3>{candidates.map(c=><article className="memory-item" key={c.id}>
 {c.requiresConfirmation&&c.confirmationKind==='add'&&<p>请核对这条新增记忆，确认后保存。</p>}{c.confirmationKind==='revoke'&&<p>确认后将撤销所选记忆。</p>}{c.requiresConfirmation&&c.confirmationKind!=='add'&&<label>请选择要修改的记忆，并核对内容<select value={c.confirmTargetId||''} onChange={e=>onCandidates(candidates.map(x=>x.id===c.id?{...x,confirmTargetId:e.target.value,expectedText:memories.find(m=>m.id===e.target.value)?.text,operations:undefined}:x))}><option value="">请选择要更新的记忆</option>{memories.filter(m=>m.type!=='fiction').map(m=><option key={m.id} value={m.id}>{m.text}</option>)}</select></label>}<label>{names[c.type]||'此前留下的内容'}<textarea disabled={disabled} value={c.text} onChange={e=>onCandidates(candidates.map(x=>x.id===c.id?{...x,text:e.target.value,operations:undefined}:x))}/></label>
 {!c.type&&<label>保存为<select value={c.type||''} onChange={e=>onCandidates(candidates.map(x=>x.id===c.id?{...x,type:e.target.value}:x))}><option value="">请选择</option>{c.sourceRole!=='assistant'&&<><option value="reality">现实信息</option><option value="preference">态度与偏好</option></>}<option value="fiction">角色经历或计划</option></select></label>}
 <div className="memory-actions"><button disabled={disabled} className="text-button memory-delete" onClick={()=>onCandidates(candidates.filter(x=>x.id!==c.id))}>删除</button></div>{source(c)}</article>)}
 <button className="text-button" disabled={disabled||candidates.some(c=>!c.text.trim()||!c.type||(c.requiresConfirmation&&c.confirmationKind!=='add'&&!c.confirmTargetId))} onClick={()=>{try{const result=onConfirm?.(candidates.map(c=>c.id));if(!result?.okay){setError('未能保存，请保留页面后重试。');return;}setError('');onSaved();}catch{setError('请确认要替换的记忆；内容有变化时请重新核对。');}}}>保存这些内容</button></section>}
 {['user',...(memories.some(m=>m.type==='fiction')?['fiction']:[])].map(group=><section key={group}><h3>{group==='user'?'关于你的记忆':'Ta的经历与计划'}</h3>{memories.filter(m=>group==='user'?m.type!=='fiction':m.type==='fiction').map(m=><article className="memory-item" key={m.id}>
 <span className="tag">{m.timeState==='past'?'过去经历':names[m.type]}</span>
 {editing===m.id?<label>修改记忆<textarea value={text} maxLength={1000} onChange={e=>setText(e.target.value)}/></label>:<p className="memory-body">{m.text}</p>}
 <div className="memory-actions" aria-label="记忆操作">
 {editing===m.id?<><button className="text-button" disabled={disabled||!text.trim()} onClick={()=>{const result=onMemories(memories.map(x=>x.id===m.id?{...x,text:text.trim()}:x));if(!result?.okay){setError('未能保存，请重试。');return;}setEditing(null);onSaved();}}>保存</button><button className="text-button" onClick={()=>setEditing(null)}>取消</button></>:<button className="text-button" disabled={disabled} onClick={()=>{setEditing(m.id);setText(m.text);}}>编辑</button>}
 <button className="text-button memory-delete" disabled={disabled} onClick={()=>onMemories(memories.filter(x=>x.id!==m.id))}>删除</button>
 </div>{source(m)}</article>)}</section>)}
 {!memories.length&&<p className="small">目前还没有保存为记忆的个人事实。聊天回顾与已保存记忆是两回事。结束聊天时会整理你明确说过的事实、偏好和过去经历。</p>}
 </section>;
}
