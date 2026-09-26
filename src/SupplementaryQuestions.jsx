import {questionTitle} from './question-context.js';
import React,{useEffect,useRef,useState} from 'react';
import {QUESTION_BY_ID as ORDINARY_BY_ID} from './question-bank.js';
import {SCENARIO_BY_ID} from './scenario-bank.js';
import {scenarioKey,readScenarioHistory,rememberScenario} from './scenario-context.js';
import {supplementState,supplementKey,saveSupplement,answerText,unknownAnswer,finishSupplementPage} from './supplementary.js';
import {experience} from './services';
const QUESTION_BY_ID={...ORDINARY_BY_ID,...SCENARIO_BY_ID};
const fresh=()=>({selected:[],text:'',skipped:false});
const isUnknown=t=>/^(?:说不清|不确定|不愿透露|都不太符合|还没定|还没想好)/.test(t);
const InkWait=()=> <span className="ink-wait"><span aria-hidden="true" className="ink-dots"><i/><i/><i/></span>正在读你写下的这些…</span>;
export default function SupplementaryQuestions({background,onChange,onClose,onGenerate}){
 const [state,setState]=useState(()=>({...supplementState(background),recentScenarios:readScenarioHistory(localStorage)})),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmation,setConfirmation]=useState(''),[progress,setProgress]=useState(''),[analysisFailed,setAnalysisFailed]=useState(false);
 const current=useRef(state),base=useRef(background),revision=useRef(0),pending=useRef(null),request=useRef(null),dialog=useRef(null),group=useRef(null),generating=useRef(false);
 function store(s){current.current=s;setState(s);base.current=saveSupplement(base.current,s);onChange(base.current);return base.current;}
 function invalidate(){revision.current++;request.current?.abort();request.current=null;pending.current=null;generating.current=false;setBusy(false);}
 function edit(s){if(s.scenario)s={...s,scenario:{...s.scenario,analysis:null}};invalidate();setError('');setAnalysisFailed(false);store({...s,plan:s.plan?.conflict?s.plan:s.plan?{...s.plan,expectations:null}:null});}
 function applyPlan(result,analysisOnly=false){const s=current.current;let scenario=s.scenario;const picked=result.questions.find(q=>SCENARIO_BY_ID[q.id]);if(picked&&!scenario){scenario={id:picked.id,answer:'',skipped:false,scopeKey:supplementKey(base.current),analysis:null};rememberScenario(localStorage,picked.id,scenario.scopeKey);}
  if(scenario&&result.scenarioAnalysis)scenario={...scenario,analysis:result.scenarioAnalysis};
  const ids=analysisOnly?[]:result.questions.map(q=>q.id);const exists=ids.length&&s.pages.some(p=>JSON.stringify(p)===JSON.stringify(ids));
  store({...s,scenario,plan:result,questionMeta:{...s.questionMeta,...Object.fromEntries(result.questions.map(q=>[q.id,q]))},shown:[...new Set([...s.shown,...ids])],pages:ids.length&&!exists?[...s.pages,ids]:s.pages,page:ids.length&&!exists?s.pages.length:Math.max(0,Math.min(s.page,s.pages.length-1))});
 }
 async function plan(s,analysisOnly=false){if(pending.current||(generating.current&&!analysisOnly))return null;invalidate();generating.current=analysisOnly;const version=revision.current,c=new AbortController();request.current=c;setBusy(true);setError('');setProgress('正在读你写下的这些…');const b=store(s);
  try{const task=experience.planQuestions(b,c.signal,t=>{if(version===revision.current)setProgress(t);});pending.current=task;const result=await task;if(version!==revision.current)return null;applyPlan(result,analysisOnly);return {result,version};}
  catch(e){if(version===revision.current){setError(e.message||'暂时没能读完，答案已经保留，可以直接生成。');if(analysisOnly)setAnalysisFailed(true);}return null;}
  finally{if(version===revision.current){pending.current=null;setBusy(false);generating.current=false;}}
 }
 useEffect(()=>{dialog.current.showModal();if(!current.current.plan&&(!current.current.pages.length||current.current.page>=current.current.pages.length))plan(current.current);return()=>{revision.current++;request.current?.abort();};},[]);
 useEffect(()=>{const y=window.scrollY,x=window.scrollX,body=document.body,old=body.getAttribute('style');Object.assign(body.style,{position:'fixed',top:-y+'px',left:-x+'px',width:'100%',overflow:'hidden'});const vv=window.visualViewport;const fit=()=>{dialog.current?.style.setProperty('--supplement-height',(vv?.height||window.innerHeight)+'px');dialog.current?.style.setProperty('--supplement-top',(vv?.offsetTop||0)+'px');};fit();vv?.addEventListener('resize',fit);vv?.addEventListener('scroll',fit);window.addEventListener('resize',fit);return()=>{vv?.removeEventListener('resize',fit);vv?.removeEventListener('scroll',fit);window.removeEventListener('resize',fit);if(old===null)body.removeAttribute('style');else body.setAttribute('style',old);window.scrollTo(x,y);};},[]);
 useEffect(()=>{group.current?.scrollTo({top:0});},[state.page,state.pages.length]);
 const ids=(state.pages[state.page]||[]).filter(id=>!['G12','G14'].includes(id)&&QUESTION_BY_ID[id]),conflict=state.plan?.conflict;
 function finish(all=false){const s=finishSupplementPage(current.current,all?current.current.shown:ids),q=s.scenario;if(q&&(!q.answer.trim()||unknownAnswer(q.answer)))s.scenario={...q,skipped:true,analysis:null};return s;}
 async function generate(){if(generating.current)return;generating.current=true;let s=finish(true);if(s.plan?.conflict){generating.current=false;return;}const task=pending.current,version=++revision.current;setBusy(true);store(s);
  if(task){try{const result=await task;if(version!==revision.current)return;if(result.conflict){store({...current.current,plan:result});setBusy(false);generating.current=false;return;}if(s.scenario&&result.scenarioAnalysis)store({...current.current,scenario:{...s.scenario,analysis:result.scenarioAnalysis}});}catch{if(version!==revision.current)return;}}
  if(version!==revision.current)return;pending.current=null;s=current.current;const q=s.scenario;
  if(q&&!q.skipped&&q.answer.trim()&&q.analysis?.key!==scenarioKey(q)&&!analysisFailed){generating.current=false;const out=await plan(s,true);if(!out||out.version!==revision.current)return;if(out.result.conflict)return;if(!current.current.scenario?.analysis){setAnalysisFailed(true);setError('这次情景回答暂时没能提炼。原答已保留，你可以跳过分析直接生成，情景原文不会放进故事。');return;}}
  generating.current=true;setBusy(false);onGenerate(store(current.current));
 }
 function changeAnswer(id,a){if(SCENARIO_BY_ID[id]){edit({...current.current,scenario:{...current.current.scenario,answer:a.text,skipped:a.skipped,analysis:null}});return;}edit({...current.current,answerScopes:{...current.current.answerScopes,[id]:{realityOutcome:base.current.realityOutcome,hypotheticalDirection:base.current.hypotheticalDirection}},answers:{...current.current.answers,[id]:a}});}
 function move(page){invalidate();store({...current.current,page});}
 const canContinue=!state.scenario&&!state.plan?.stop&&state.shown.length<8&&ids.length>0&&ids.some(id=>answerText(finish().answers[id]));
 return <dialog ref={dialog} className="supplement-dialog" aria-label="生成前补充问题" onCancel={e=>{e.preventDefault();invalidate();onClose();}}><header><h2>{conflict?'先确认这处信息':'再补几笔，让这封信更像你'}</h2><button type="button" className="text-button" onClick={()=>{invalidate();onClose();}}>返回修改</button></header>
 <div className="supplement-scroll" ref={group}>{conflict?<section><p>{conflict.question}</p>{conflict.evidence.map((e,i)=><blockquote key={i}>{e.text}</blockquote>)}{state.confirmations.length+Number(base.current.coreConfirmAttempts||0)>=2?<p role="alert">请返回修改原文，已填内容会保留。</p>:<><label className="field">你的确认<textarea value={confirmation} maxLength={500} onChange={e=>{invalidate();setConfirmation(e.target.value);}}/></label><button type="button" className="primary" disabled={busy||!confirmation.trim()} onClick={()=>{plan({...current.current,confirmations:[...current.current.confirmations,confirmation.trim()]});setConfirmation('');}}>确认并继续</button></>}</section>:<>
 {ids.map(id=>{const q=QUESTION_BY_ID[id],a=q.scenario?{...fresh(),text:state.scenario?.answer||'',skipped:Boolean(state.scenario?.skipped)}:state.answers[id]||fresh();const title=questionTitle(q,state.questionMeta?.[id],background);
 return <section className="supplement-question" key={id}>{q.scenario&&<p className="small">假设情景 · {id} · 与真实经历无关。一句话也可以，也可以跳过。</p>}<h3>{title}</h3>{q.kind!=='text'&&<div className="question-options">{[...q.options,'说不清／不愿透露'].map(option=><button type="button" key={option} aria-pressed={a.selected.includes(option)} onClick={()=>{const selected=a.selected.includes(option)?a.selected.filter(x=>x!==option):q.kind==='single'||isUnknown(option)||a.selected.some(isUnknown)?[option]:a.selected.length<2?[...a.selected,option]:a.selected;changeAnswer(id,{...a,selected,skipped:false,...(isUnknown(option)?{text:''}:{})});}}><span className="option-ink" aria-hidden="true"/><span className="option-check" aria-hidden="true">✓</span><span>{option}</span></button>)}</div>}
 <label className="field">{q.scenario?'在这个假设里，你会怎么回应？':q.kind==='text'?'一句话就好，也可以跳过':'自己说（可直接输入，也可补充选项）'}<textarea maxLength={500} rows={2} value={a.text} onChange={e=>changeAnswer(id,{...a,text:e.target.value,selected:a.selected.filter(x=>!isUnknown(x)),skipped:false})}/></label><button type="button" className="text-button" aria-pressed={a.skipped} onClick={()=>changeAnswer(id,{...a,skipped:!a.skipped})}>{a.skipped?'已跳过（点此恢复）':'跳过这一题'}</button></section>;})}
 {!ids.length&&!busy&&state.plan&&<p>已经可以开始写这封信了。</p>}
 {(!state.scenario||state.extra)&&<details className="supplement-extra"><summary>补充其他要求（选填）</summary><label className="field">有没有故事必须遵守、但前面没写到的事？<textarea rows={2} maxLength={500} value={state.extra} onChange={e=>edit({...current.current,extra:e.target.value})}/></label></details>}
 </>}{busy&&<p role="status">{['正在读你写下的这些…','正在理解你的补充…'].includes(progress)?<InkWait/>:progress}</p>}{error&&<p role="alert">{error}</p>}</div>
 {!conflict&&<div className="am-followup-actions supplement-actions"><button type="button" className="primary supplement-generate" disabled={generating.current} onClick={generate}>{analysisFailed?'跳过分析，直接生成':'直接生成'}<span>已填写的内容都会保留</span></button>{state.page>0&&<button type="button" className="text-button" onClick={()=>move(state.page-1)}>查看前面的回答</button>}{state.page<state.pages.length-1?<button type="button" className="text-button" onClick={()=>move(state.page+1)}>查看后面的回答</button>:canContinue&&<button type="button" className="text-button" disabled={busy} onClick={()=>plan(finish())}>{busy?<InkWait/>:'提交这组回答，看看还缺什么'}</button>}</div>}
 </dialog>;
}
