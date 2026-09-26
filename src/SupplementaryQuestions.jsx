import React,{useEffect,useRef,useState} from 'react';
import {QUESTION_BY_ID} from './question-bank.js';
import {supplementState,saveSupplement,answerText} from './supplementary.js';
import {experience} from './services';
const isUnknown=text=>/^(?:说不清|不确定|不愿透露|都不太符合|还没定|还没想好)/.test(text);
const fresh=()=>({selected:[],text:'',skipped:false});
export default function SupplementaryQuestions({background,onChange,onClose,onGenerate}){
 const [state,setState]=useState(()=>supplementState(background)),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmation,setConfirmation]=useState(''),[progress,setProgress]=useState('正在准备补充问题…');
 const current=useRef(state),base=useRef(background),revision=useRef(0),request=useRef(null),pending=useRef(null),dialog=useRef(null);
 function store(s){current.current=s;setState(s);base.current=saveSupplement(base.current,s);onChange(base.current);return base.current;}
 function invalidate(){revision.current++;request.current?.abort();request.current=null;pending.current=null;setBusy(false);}
 function edit(s){invalidate();setError('');store({...s,plan:s.plan?.conflict?s.plan:null});}
 async function plan(s){invalidate();const version=revision.current,controller=new AbortController();request.current=controller;const b=store(s);setBusy(true);setProgress('正在准备补充问题…');setError('');
  try{const task=experience.planQuestions(b,controller.signal,text=>{if(version===revision.current)setProgress(text);});pending.current=task;const result=await task;if(version!==revision.current)return;const ids=result.questions.map(q=>q.id);store({...current.current,plan:result,questionMeta:{...current.current.questionMeta,...Object.fromEntries(result.questions.map(q=>[q.id,q]))},shown:[...new Set([...current.current.shown,...ids])],pages:ids.length?[...current.current.pages,ids]:current.current.pages,page:current.current.pages.length});}
  catch(e){if(version===revision.current)setError(e.message||'补充问题暂时没有整理好，已答内容已保留，可以直接生成。');}
  finally{if(version===revision.current){pending.current=null;setBusy(false);}}
 }
 useEffect(()=>{dialog.current.showModal();if(!current.current.plan&&(!current.current.pages.length||current.current.page>=current.current.pages.length))plan(current.current);return()=>{revision.current++;request.current?.abort();};},[]);
 const ids=state.pages[state.page]||[],conflict=state.plan?.conflict;
 function finishPage(){const answers={...current.current.answers};for(const id of ids){if(!answerText(answers[id]))answers[id]={...fresh(),skipped:true};}return {...current.current,answers};}
 async function generate(){const s=finishPage();if(s.plan?.conflict)return;const task=pending.current,version=++revision.current;setBusy(true);store(s);if(task){try{const result=await task;if(version!==revision.current)return;if(result.conflict){store({...current.current,plan:result});setBusy(false);return;}}catch{if(version!==revision.current)return;}}if(version!==revision.current)return;pending.current=null;setBusy(false);onGenerate(store(current.current));}
 function changeAnswer(id,a){edit({...current.current,answerScopes:{...current.current.answerScopes,[id]:{realityOutcome:base.current.realityOutcome,hypotheticalDirection:base.current.hypotheticalDirection}},answers:{...current.current.answers,[id]:a}});}
 return <dialog ref={dialog} className="supplement-dialog" aria-label="生成前补充问题" onCancel={e=>{e.preventDefault();invalidate();onClose();}}><header><h2>{conflict?'先确认这处信息':'再补几笔，让这封信更像你'}</h2><button type="button" className="text-button" onClick={()=>{invalidate();onClose();}}>返回修改</button></header>
 <p className="small">{conflict?"这处会影响故事方向，请先确认或返回修改。":`可以只答想说的，也可以直接生成。已展示 ${state.shown.length} / 8 题。`}</p>
 {conflict?<section><p>{conflict.question}</p>{conflict.evidence.map((e,i)=><blockquote key={i}>{e.text}</blockquote>)}{state.confirmations.length+Number(base.current.coreConfirmAttempts||0)>=2?<p role="alert">这处冲突仍未明确，请返回修改原文。已填内容会保留。</p>:<><label className="field">你的确认<textarea value={confirmation} maxLength={500} onChange={e=>{invalidate();setConfirmation(e.target.value);}}/></label><button type="button" className="primary" disabled={busy||!confirmation.trim()} onClick={()=>{plan({...current.current,confirmations:[...current.current.confirmations,confirmation.trim()]});setConfirmation('');}}>确认并继续</button></>}</section>:<>
 {ids.map(id=>{const q=QUESTION_BY_ID[id],a=state.answers[id]||fresh();const future=(state.questionMeta?.[id]||state.plan?.questions.find(x=>x.id===id))?.tense==='future';const title=future?q.question.replace(/^那时，/,'开始前，').replace(/^那会儿，你已经接触过这件事吗？$/,'到现在为止，你接触过这件事吗？').replace(/^那件事发生前/,'在设想的那件事发生前'):q.question;
 return <section className="supplement-question" key={id}><h3>{title}</h3>{q.kind!=='text'&&<div className="question-options">{[...q.options,'说不清／不愿透露'].map(option=><button type="button" key={option} aria-pressed={a.selected.includes(option)} onClick={()=>{let selected=a.selected.includes(option)?a.selected.filter(x=>x!==option):q.kind==='single'||isUnknown(option)||a.selected.some(isUnknown)?[option]:a.selected.length<2?[...a.selected,option]:a.selected;changeAnswer(id,{...a,selected,skipped:false,...(isUnknown(option)?{text:''}:{})});}}>{option}</button>)}</div>}
 <label className="field">{q.kind==='text'?'一句话就好，也可以跳过':'自己说（可直接输入，也可补充选项）'}<textarea maxLength={500} rows={2} value={a.text} onChange={e=>changeAnswer(id,{...a,text:e.target.value,selected:a.selected.filter(x=>!isUnknown(x)),skipped:false})}/></label><button type="button" className="text-button" aria-pressed={a.skipped} onClick={()=>changeAnswer(id,{...fresh(),skipped:true})}>{a.skipped?'已跳过':'跳过这一题'}</button></section>;})}
 {!ids.length&&!busy&&state.plan&&<p>已有信息可以开始写了，你也可以再补一句。</p>}
 <p className="small">时间选“刚开始的几周”时按三周安排；选“交给故事选”时默认观察两个月。明确写出的起止时间优先。</p><label className="field">再补一句（选填）<textarea rows={2} maxLength={500} value={state.extra} onChange={e=>edit({...current.current,extra:e.target.value})}/></label>
 <div className="am-followup-actions">{state.page>0&&<button type="button" className="text-button" onClick={()=>{invalidate();store({...current.current,page:state.page-1});}}>上一组</button>}{state.page<state.pages.length-1&&<button type="button" className="text-button" onClick={()=>{invalidate();store({...current.current,page:state.page+1});}}>查看下一组已填答案</button>}{(ids.length>0||!state.plan)&&<button type="button" className="primary" disabled={busy} onClick={()=>plan(finishPage())}>{busy?'正在准备补充问题…':'提交补充，看看是否还需回答'}</button>}<button type="button" className="text-button" onClick={generate}>直接生成（保留已答内容）</button></div></>}
 {busy&&<p role="status">{progress}</p>}{error&&<p role="alert">{error}</p>}
 </dialog>;
}
