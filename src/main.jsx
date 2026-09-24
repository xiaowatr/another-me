import {pendingStory} from './services/story-task-client.js';
import {formError,requiredBackgroundFields} from './form-validation';
import {revisitMemories} from './memory-review';
import {reportStoryTiming} from './services';
import {Mailbox,PostalWaiting} from './PostalMotion';
import {rolePresentation} from './role-presentation.js';
import {hardQuestion,applyClarification} from './input-anchors.js';
import {explicitCorrections} from './consistency.js';
import StoryPaper from './StoryPaper';
import {roleRecords,selectRoleRecords} from './role-record.js';
import LifeHome from './LifeHome';
import WrapUp from './WrapUp';
import {closeConversation,emptyReview,completeReview,finishReview,dismissCandidates,reviseMemories,sameMemory} from './memory-review';
import AboutMe from './AboutMe';
import {reviewStory,currentOpening,sceneTimeLabel} from './fact-frame';
import {chatClock,lifeContext,chatIdentity,qualifyCurrentAge} from './session-context';
import StoryArchive from './StoryArchive';
import {optionalFollowup,savedFollowup,archiveName} from './story-input';
import {MBTI_TYPES,migrateBackground} from './background';
﻿import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { experience, streamReply, confirmSeen } from './services';
import './style.css';
import {coordinates,coordinateError} from './context';
import {readLives,writeLives,modelHistory,removeLifeBackup} from './life-store';
import {composerAction} from './composer';
import MemoryPanel from './MemoryPanel';
import { takeMessage, messageDelay, appendBubble } from './chat-stream';
import { readDraft, writeDraft, clearDraft, EMPTY_BACKGROUND } from './draft';
const empty = {...EMPTY_BACKGROUND,inputVersion:'6'};
function draftStorage() {try{return window.localStorage;}catch{return null;}}
function App() {
  const [savedLives]=useState(()=>readLives(draftStorage()));
  const [initialLife]=useState(()=>savedLives.lives.find(l=>l.id===savedLives.activeId));
  const [library,setLibrary]=useState(savedLives.lives);
  const [lifeName,setLifeName]=useState(initialLife?archiveName(initialLife):'');
  const [lifeId,setLifeId]=useState(initialLife?.id || null);
  const [memories,setMemories]=useState(initialLife?.memories || []);
  const [freshStoryId,setFreshStoryId]=useState(null);
  const [formOrigin,setFormOrigin]=useState('home');
  const [storyInfoOpen,setStoryInfoOpen]=useState(false);
  const [aboutOpen,setAboutOpen]=useState(false),[savedNotice,setSavedNotice]=useState('');
  const [candidates,setCandidates]=useState(initialLife?.candidates || []);
  const [contextStart,setContextStart]=useState(initialLife?.contextStart || 0);
  const [eraContext,setEraContext]=useState(initialLife?.eraContext || []);
  const [sessionMeta,setSessionMeta]=useState({...emptyReview(),...initialLife?.sessionMeta});
  const [editingProfile,setEditingProfile]=useState(false),[wrapWorkingId,setWrapWorkingId]=useState(null);
  const reviewJobs=useRef(new Set()),live=useRef(null),libraryRef=useRef(library);
  const [lifeStorageOkay,setLifeStorageOkay]=useState(true);
  const storyDisplayTiming=useRef(null);
  const generation=useRef(null),followBottom=useRef(true),historicMessages=useRef(new Set(initialLife?.messages.map(m=>m.id)||[]));
  const messagesBox=useRef(null),chatPositions=useRef(new Map());
  const composer=useRef(null),composing=useRef(false);
  const [savedDraft] = useState(() => readDraft(draftStorage()));
  const [page, setPage] = useState(() => pendingStory() ? 'input' : Object.entries(savedDraft.background).some(([key,value])=>key!=='inputVersion' && Boolean(value)) ? 'input' : savedLives.lives.length ? 'lives' : 'home');
  useEffect(()=>setStoryInfoOpen(false),[page,lifeId]);
  const [step, setStep] = useState(0);
  const [background, setBackground] = useState(migrateBackground({...empty,...savedDraft.background}));
  const [generatedBackground, setGeneratedBackground] = useState(migrateBackground(initialLife?.background || empty));
  const [story, setStory] = useState(initialLife?.story || null);
  const [messages, setMessages] = useState(initialLife?.messages || []);
  const [draft, setDraft] = useState(initialLife?.draft || '');
  const [busy, setBusy] = useState(false);
  const [storyRetrying,setStoryRetrying]=useState(false);
  const [waitingNote,setWaitingNote]=useState([]);
  const [error, setError] = useState('');
  const [generationFailed,setGenerationFailed]=useState(false);const [failureId,setFailureId]=useState('');
  const [status, setStatus] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [storyMode, setStoryMode] = useState(initialLife?.mode || 'demo');
  const [corrections, setCorrections] = useState([]);
  const [intent, setIntent] = useState('chat');
  const [question, setQuestion] = useState('');
  const [clarification, setClarification] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(savedDraft.detailsOpen);
  const [clearedDraft,setClearedDraft]=useState(null);
  const [storageOkay, setStorageOkay] = useState(null);
  libraryRef.current=library;
  live.current={...library.find(l=>l.id===lifeId),id:lifeId,name:lifeName,story,background:generatedBackground,messages,draft,memories,candidates,contextStart,eraContext,mode:storyMode,sessionMeta};
  useEffect(() => {setStorageOkay(writeDraft(draftStorage(),{background,step,detailsOpen,question,clarification}));},[background,step,detailsOpen,question,clarification]);
  useEffect(()=>{
    if(!lifeId || !story)return;
    const life={...library.find(l=>l.id===lifeId),conversationContext:lifeContext(generatedBackground,story,memories),chatTime:chatClock(generatedBackground),id:lifeId,name:lifeName,story,background:generatedBackground,messages,draft,memories,candidates,contextStart,eraContext,mode:storyMode,sessionMeta};
    setLibrary(prev=>[...prev.filter(l=>l.id!==lifeId),life]);
  },[lifeName,lifeId,story,generatedBackground,messages,draft,memories,candidates,contextStart,eraContext,storyMode,sessionMeta]);
  useEffect(()=>{const okay=writeLives(draftStorage(),{activeId:lifeId,lives:library});setLifeStorageOkay(okay);if(okay&&library.some(l=>l.id===lifeId))experience.ackStory(lifeId);},[library,lifeId]);
  function switchLife(id,destination='chat'){if(requestLock.current)return;const found=library.find(l=>l.id===id);if(!found)return;const life={...found,lastVisitedAt:new Date().toISOString()};setLibrary(prev=>prev.map(l=>l.id===id?life:l));historicMessages.current=new Set(life.messages.map(m=>m.id));
    setSavedNotice('');setLifeId(id);setLifeName(archiveName(life));setStory(life.story);setGeneratedBackground(life.background);setMessages(life.messages);setDraft(life.draft || '');setMemories(life.memories || []);setCandidates(life.candidates || []);setContextStart(life.contextStart || 0);setEraContext(life.eraContext || []);setStoryMode(life.mode);setSessionId(null);setError('');setTiming(null);setSyncFailed(false);setSessionMeta({...emptyReview(),...life.sessionMeta});setEditingProfile(false);setAboutOpen(destination==='about');setPage(destination==='life'?'life':'chat');
  }
  function renameLife(id,name){setLibrary(prev=>prev.map(l=>l.id===id?{...l,name}:l));if(id===lifeId)setLifeName(name);}
  useEffect(()=>{if(page!=='input' || background.followupKey)return;const q=optionalFollowup(background);if(q)setBackground(prev=>prev.followupKey?prev:{...prev,followupKey:q.id,followupQuestion:q.question});},[page,background]);
  const followup=hardQuestion(background)||(['model','hard-conflict'].includes(background.followupKey)?{question:background.followupQuestion,options:['说不清']}:savedFollowup(background));
  function mutateLife(id,transform){const current=live.current?.id===id?live.current:libraryRef.current.find(l=>l.id===id);if(!current)return;const next=transform(current);const all=libraryRef.current.map(l=>l.id===id?next:l);libraryRef.current=all;setLibrary(all);if(live.current?.id===id){live.current=next;setMessages(next.messages);setMemories(next.memories);setCandidates(next.candidates);setContextStart(next.contextStart||0);setSessionMeta(next.sessionMeta||emptyReview());}const okay=writeLives(draftStorage(),{activeId:live.current?.id,lives:all});setLifeStorageOkay(okay);return {next,okay};}
  function changeMemories(next){mutateLife(lifeId,l=>reviseMemories(l,next));}
  function changeCandidates(next){mutateLife(lifeId,l=>dismissCandidates(l,next));}
  function returnLives(){setEditingProfile(false);setAboutOpen(false);setPage('lives');}
  function newLife(){setFormOrigin('lives');setError('');setGenerationFailed(false);setSyncFailed(false);setClearedDraft(null);setTiming(null);setDetailsOpen(false);setSavedNotice('');setEditingProfile(false);setQuestion('');setClarification('');setPage('input');}
  function deleteLife(id){if(requestLock.current)return;reviewJobs.current.delete(id);const all=libraryRef.current.filter(l=>l.id!==id);libraryRef.current=all;setLibrary(all);if(lifeId===id){live.current=null;setLifeId(null);setStory(null);setMessages([]);setCandidates([]);setMemories([]);setSessionMeta(emptyReview());}const okay=writeLives(draftStorage(),{activeId:lifeId===id?null:lifeId,lives:all});setLifeStorageOkay(okay&&removeLifeBackup(draftStorage(),id));setPage('lives');}
  async function endChat(){const id=lifeId;if(reviewJobs.current.has(id))return;reviewJobs.current.add(id);setWrapWorkingId(id);setAboutOpen(false);const t=activeTurn.current;
    try{if(t){await stopReply();await t.finished;await new Promise(resolve=>setTimeout(resolve,0));}
      const result=mutateLife(id,l=>{const ended=page==='chat'?closeConversation(l):l;const reviewed=finishReview(ended);if(reviewed.sessionMeta.review?.status==='failed')return reviewed;try{return completeReview(reviewed);}catch{return {...reviewed,sessionMeta:{...reviewed.sessionMeta,review:{...reviewed.sessionMeta.review,status:'failed'}}};}});
      if(result?.okay){setSavedNotice(result.next.sessionMeta.review?.status==='failed'?'聊天已保存，但记忆整理未完成，请打开这条人生的资料与记忆处理。':'聊天已保存，下次接着聊');returnLives();}else setError('暂时无法保存，请保留当前页面。');
    }finally{reviewJobs.current.delete(id);setWrapWorkingId(null);}
  }
  function saveSelected(ids){try{mutateLife(lifeId,l=>completeReview(l,ids));returnLives();}catch{setError('记忆已满，请先在关于我中整理已有内容。');}}
  const requestLock = useRef(false);
  const activeTurn=useRef(null);
  const [chatWaiting,setChatWaiting]=useState(false);
  const [timing,setTiming]=useState(null);
  const [syncFailed,setSyncFailed]=useState(false);
  function showReceived(){const t=activeTurn.current;if(!t)return;clearTimeout(t.timer);t.timer=null;flushTurn(t,true);}
  function flushTurn(t,all=false){
    if(t.stopped)return;
    let piece;
    do{[piece,t.buffer]=takeMessage(t.buffer,all || t.done);if(!piece)break;
      t.shown+=piece;
      const previousIds=[...t.bubbleIds];
      if(previousIds.length>=4 || (!piece.trim() && previousIds.length)){const id=previousIds.at(-1);setMessages(prev=>prev.map(m=>m.id===id?{...m,text:m.text+piece}:m));}
      else if(piece.trim()){const nextMessages=appendBubble([],piece,t.messageId,t.bubbleIds);setMessages(prev=>[...prev,...nextMessages]);}
      const shown=t.shown;t.ack=t.ack.then(()=>confirmSeen({sessionId:t.sessionId,turnId:t.id,text:shown}));t.ack.catch(()=>{});
      if(t.firstShown==null)requestAnimationFrame(()=>requestAnimationFrame(()=>{if(t.firstShown==null)t.firstShown=Math.round(performance.now()-t.started);}));
    }while(all);
    if(piece && !all)t.timer=setTimeout(()=>{t.timer=null;flushTurn(t);},messageDelay(piece));
    else if(t.buffer && (t.done || takeMessage(t.buffer)[0]))t.timer=setTimeout(()=>{t.timer=null;flushTurn(t);},1000);
    if(t.done && !t.buffer)t.resolveDrain?.();
  }
  async function stopReply(){
    const t=activeTurn.current;if(!t)return;t.stopped=true;clearTimeout(t.timer);t.buffer='';
    if(t.id)t.ack=t.ack.then(()=>confirmSeen({sessionId:t.sessionId,turnId:t.id,text:t.shown,stop:true}));
    t.controller.abort();t.resolveDrain?.();setChatWaiting(false);
    try{await t.ack;}catch{setSyncFailed(true);setError('已停止，文字仍然保留。请重新打开这条人生后继续。');}
  }
  const heading = useRef(null);
  const chatEnd = useRef(null);
  const refreshStatus = () => experience.status().then(data => {setStatus(data);setError('');}).catch(e => setError(e.message));
  useEffect(() => {
    refreshStatus();
    const refresh = () => experience.status().then(setStatus).catch(() => {});
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); heading.current?.focus(); }, [page, step]);
  useEffect(() => { if (page === 'chat' && messages.length && followBottom.current) chatEnd.current?.scrollIntoView({ block: 'nearest' }); }, [messages]);
  useLayoutEffect(()=>{if(page==='chat'&&messagesBox.current)messagesBox.current.scrollTop=chatPositions.current.get(lifeId)??messagesBox.current.scrollHeight;},[page,lifeId]);
  useLayoutEffect(()=>{const el=composer.current;if(!el)return;el.style.height='0px';const h=Math.min(136,Math.max(40,el.scrollHeight));el.style.height=h+'px';el.style.overflowY=el.scrollHeight>136?'auto':'hidden';},[draft,page]);
  useEffect(()=>{if(page!=='chat')return;const vv=window.visualViewport;const resize=()=>{document.documentElement.style.setProperty('--chat-viewport',(vv?.height||window.innerHeight)+'px');document.documentElement.style.setProperty('--chat-offset',(vv?.offsetTop||0)+'px');};resize();vv?.addEventListener('resize',resize);vv?.addEventListener('scroll',resize);return()=>{vv?.removeEventListener('resize',resize);vv?.removeEventListener('scroll',resize);};},[page]);
  function cancelGeneration(){experience.cancelStory().catch(e=>setError(e.message));setStorageOkay(writeDraft(draftStorage(),{background,step,detailsOpen,question,clarification}));if(generation.current){generation.current.abort();generation.current=null;requestLock.current=false;setBusy(false);}}
  const navigate = (next) => { if(generation.current)cancelGeneration();else if(requestLock.current)return;if(page==='chat'&&messagesBox.current)chatPositions.current.set(lifeId,messagesBox.current.scrollTop);if(next==='input'&&page!=='input')setFormOrigin(page);if(next!=='input')setEditingProfile(false); setError(''); if(next==='input' && page==='life')setBackground(migrateBackground({...empty,...generatedBackground})); setPage(next); };
  function clearForm(){if(requestLock.current)return;setClearedDraft(prev=>prev || {background:{...background},question,clarification,detailsOpen});clearDraft(draftStorage());setBackground({...empty});setQuestion('');setClarification('');setDetailsOpen(false);setError('');}
  function undoClear(){if(!clearedDraft || requestLock.current)return;setBackground(clearedDraft.background);setQuestion(clearedDraft.question);setClarification(clearedDraft.clarification);setDetailsOpen(clearedDraft.detailsOpen);setClearedDraft(null);}
  const update = (event) => { setClearedDraft(null); const {name,value}=event.target;setStorageOkay(null);setBackground(prev=>({...prev,[name]:value,...(['realityOutcome','hypotheticalDirection','birthYear','forkAge','locationText','choiceReason','details','lifeSituation'].includes(name)?{followupKey:'',followupQuestion:'',followupAnswer:'',followupSkipped:''}:{})})); setQuestion(''); setClarification(''); };
  const field = (name, label, placeholder, kind = 'textarea') => <label className="field">{label}{requiredBackgroundFields.includes(name)&&!label.includes('*')?' *':''}{kind === 'input' ? <input name={name} value={background[name]} onChange={update} placeholder={placeholder} maxLength={80}  /> : <textarea required={requiredBackgroundFields.includes(name)} name={name} value={background[name]} onChange={update} placeholder={placeholder} maxLength={1500}  rows={name === 'lifeSituation' ? 2 : name === 'details' ? 4 : 3} />}</label>;
  async function next(event, direct=false, recover=null) {
    event.preventDefault(); if (requestLock.current) return;setGenerationFailed(false);setStoryRetrying(false);
    const fields = ['realityOutcome','hypotheticalDirection'];setFailureId('');
    if(!recover&&hardQuestion(background)){setBackground(b=>({...b,followupKey:'hard-conflict',followupSkipped:''}));setError('请先确认上方相互矛盾的信息，再继续。');return;}
    if(!recover&&formError(background)){setError(formError(background));return;}
    if(!recover&&coordinateError(background)){setError(coordinateError(background));return;}
    if(!recover&&fields.some(key=>!background[key]?.trim())){setError('请写下想回到的瞬间，以及这次希望发生的变化。');return;}
    setError('');
    if(editingProfile){setGeneratedBackground(migrateBackground(background));setContextStart(messages.length);setSessionId(null);setEditingProfile(false);setSavedNotice('已保存');setPage('chat');setAboutOpen(true);return;}
    const submitted=recover?.input.background||{...migrateBackground(applyClarification(background)),...(hardQuestion(background)?{followupKey:'hard-conflict'}:{}),followupSkipped:direct || (background.followupKey&&!background.followupAnswer?.trim())?'1':background.followupSkipped};
    setBackground(submitted);setWaitingNote([]);
    const controller=new AbortController();const clientTraceId=crypto.randomUUID(),clientStarted=performance.now();generation.current=controller;requestLock.current = true; setBusy(true);
    try {
      const result = await experience.getStory(recover?.input||{ background:submitted, clarification:'',clarificationSkipped:direct || Boolean(submitted.followupKey) || Boolean(submitted.followupSkipped), previousSessionId: null },controller.signal,clientTraceId,()=>setStoryRetrying(true),note=>{if(generation.current===controller)setWaitingNote(note);});
      reportStoryTiming(result.clientTiming,result.kind==='clarification'?'clarification':'received');
      if(generation.current!==controller)return;
      if (result.kind === 'clarification') { setBackground(prev=>({...prev,followupKey:result.hard?'hard-conflict':'model',followupQuestion:result.question,followupAnswer:'',followupSkipped:''}));return; }
      const createdId=result.taskId||crypto.randomUUID();storyDisplayTiming.current={...result.clientTiming,lifeId:createdId,clientStarted};setFreshStoryId(createdId);historicMessages.current=new Set();setSessionMeta({...emptyReview(),lastVisitedAt:new Date().toISOString()});setEditingProfile(false);setLifeId(createdId);setLifeName(archiveName({background:submitted,story:result.story}));setMemories([]);setCandidates([]);setContextStart(0);setEraContext(result.eraContext || []);
      setStory(result.story); setSessionId(result.sessionId); setStoryMode(result.mode);
      setGeneratedBackground(structuredClone(result.background||submitted));
      setSyncFailed(false); setMessages([]); setCorrections([]); setDraft(''); setIntent('chat'); setQuestion(''); setClarification(''); setBackground({...empty});setPage('life');
    } catch (e) { reportStoryTiming(e.timing,controller.signal.aborted?'stopped':'failed');if(generation.current===controller){setError(e.message);setFailureId(e.requestId||e.timing?.requestId||'');setGenerationFailed(true);} }
    finally { if(generation.current===controller){generation.current=null;requestLock.current = false; setBusy(false);} }
  }
  async function send(event,retry=null) {
    event?.preventDefault();const text=(retry?.text ?? draft).trim();if(!text || requestLock.current || reviewJobs.current.has(lifeId))return;
    const messageId=retry?.id || crypto.randomUUID();requestLock.current=true;setBusy(true);setChatWaiting(true);setError('');setTiming(null);
    setSessionMeta(m=>({...m,lastChatAt:new Date().toISOString(),startedAt:m.startedAt||new Date().toISOString()}));
    setFailureId('');const t={controller:new AbortController(),started:performance.now(),buffer:'',shown:'',bubbleIds:[],ack:Promise.resolve(),firstBody:null,firstShown:null,done:false,stopped:false,timer:null,id:null,messageId,sessionId:null};activeTurn.current=t;
    t.finished=new Promise(resolve=>t.resolveFinished=resolve);
    t.drain=new Promise(resolve=>t.resolveDrain=resolve);
    setMessages(prev=>retry?prev.map(m=>m.id===messageId?{...m,status:'pending'}:m):[...prev,{id:messageId,role:'user',text,status:'pending'}]);
    if(!retry)setDraft('');composer.current?.focus();
    let failure=null;
    try{
      const restored=await experience.restore({background:generatedBackground,story,memories,corrections:explicitCorrections(messages,contextStart),roleRecords:selectRoleRecords(roleRecords(messages,generatedBackground,memories,contextStart),text),history:modelHistory(messages,messageId,contextStart)},sessionId,t.controller.signal);
      t.sessionId=restored.sessionId;setSessionId(restored.sessionId);setSyncFailed(false);
      if(t.stopped)throw new Error('已停止');
      await streamReply({sessionId:t.sessionId,message:text,intent},{signal:AbortSignal.any([t.controller.signal,AbortSignal.timeout(100000)]),onEvent:e=>{
        if(t.stopped)return;
        if(e.type==='request')t.requestId=e.requestId;
        if(e.type==='start'){t.id=e.turnId;setCorrections(e.corrections);}
        if(e.type==='text'){if(t.firstBody==null)t.firstBody=Math.round(performance.now()-t.started);t.buffer+=e.text;if(!t.timer)flushTurn(t);}
        if(e.type==='done'){t.requestId=e.requestId || t.requestId;t.networkDone=Math.round(performance.now()-t.started);t.done=true;if(!t.timer)flushTurn(t);}
      }});
      await t.drain;
      if(!t.stopped)setIntent('chat');
    }catch(e){if(!t.stopped){failure=e;setFailureId(e.requestId||t.requestId||'');t.buffer='';clearTimeout(t.timer);setError(e.message || '回复中断，输入和已显示内容已保留。');}}
    finally{
      try{await t.ack;}catch{setSyncFailed(true);setError('文字已保留，请重新打开这条人生后继续。');}
      setMessages(prev=>prev.map(m=>m.id===messageId?{...m,status:t.stopped?'stopped':failure?'failed':'sent'}:m));
      clearTimeout(t.timer);
      const measures={firstBodyMs:t.firstBody,firstShownMs:t.firstShown,completeMs:t.networkDone ?? null,displayCompleteMs:Math.round(performance.now()-t.started),outcome:t.stopped?'stopped':failure?'failed':'success'};
      setTiming(measures);if(t.requestId)fetch('/api/timing',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:t.requestId,...measures})}).catch(()=>{});
      t.resolveFinished?.();activeTurn.current=null;requestLock.current=false;setBusy(false);setChatWaiting(false);experience.status().then(setStatus).catch(()=>{});
    }
  }
  const demo = (page === 'life' || page === 'chat') ? storyMode === 'demo' : status?.mode === 'demo';
  const notice = status?.mode==='real' ? null : <div className="notice"><span className="dot"/>{!status ? '正在检查本地服务……' : demo ? '演示模式 · 尚未配置密钥，故事与回复均为固定示例，不会根据输入生成。' : status.mode === 'configuration' ? '本地模型配置需要检查，请修正配置后重启。' : ''}</div>;
  return <div className={`app-shell ${page==='chat'?'in-chat':''}`}><fieldset className="app-fieldset" disabled={false}>
    <header><button className="brand" onClick={() => navigate('home')} aria-label="another me 首页"><span className="brand-symbol" aria-hidden="true">✉</span> another me<span className="brand-cn">平行人生邮局</span></button><span className="header-note">另一种人生的来信</span>{status?.mode !== 'real' && <span className="demo-pill">{status?.mode === 'demo' ? '体验原型 / 演示' : '连接检查'}</span>}</header>
    <main><button type="button" className={"text-button lives-entry"+(page==='home'?' home-lives-entry':'')} disabled={busy} onClick={()=>page==='chat'?navigate('life'):returnLives()}>{page==='chat'?'← 故事与背景':'我的那些如果'}</button>{page==='lives'&&<LifeHome library={library} onOpen={switchLife} onNew={newLife} onDelete={deleteLife} onRename={renameLife} notice={savedNotice}/>} {page==='wrap'&&error&&<p role="alert" className="error">{error}</p>}{page==='wrap'&&lifeId&&<WrapUp savedOkay={lifeStorageOkay} life={live.current} working={wrapWorkingId===lifeId} onCandidates={changeCandidates} onSave={saveSelected} onReturn={returnLives} onRetry={endChat}/>} {!lifeStorageOkay && <p className="error" role="alert">浏览器空间不足或不允许存储，当前人生未能保存。请勿关闭页面。</p>}
      {!status && error && <div className="error" role="alert">{error} <button onClick={refreshStatus} className="text-button">重新连接</button></div>}
      {page === 'home' && <>
        <div className="hero">
          <section className="hero-copy"><h1 ref={heading} tabIndex={-1}>如果人生，<br/>从某一刻<span className="accent">开始不同</span>。</h1><p className="hero-sub">那个我，现在会怎样？</p><p className="description">也许在另一座城市，做着另一份工作，<br className="desktop-break"/>遇见了不同的人。写下你想探索的不同，<br className="desktop-break"/>与另一种可能里的自己，聊一聊。</p><p className="small data-note">故事为 AI 创作，并非真实预测。必要的背景与对话内容会发送给 MiniMax。</p>{notice}</section>
          <Mailbox onStart={() => {setBackground(migrateBackground(background));navigate('input');}}/>
        </div>
        <section className="how"><div><span className="number">01</span><h2>找到那个起点</h2><p>一个不同的起点，展开另一种日常。</p></div><div><span className="number">02</span><h2>看见另一种日常</h2><p>每一种可能，都有不同的风景。</p></div><div><span className="number">03</span><h2>给自己一封回信</h2><p>在对话里，重新认识此刻的你。</p></div></section>
      </>}
      {page === 'input' && <section className="compact-form"><div className="form-top"><button type="button" className="text-button" onClick={()=>navigate(formOrigin)}>← 返回</button></div><h1 ref={heading} tabIndex={-1}>回到那个瞬间</h1>{notice}<p className="small">* 为必填；不确定或不愿透露可直接说明。生活补充可跳过。</p><form onSubmit={next} noValidate>
        {field('realityOutcome','你想回到哪个瞬间？ *','当时发生了什么，你实际做了什么选择？')}
        {field('hypotheticalDirection','如果那次不一样，你想让什么发生？ *','写下你想探索的变化。')}
        {followup && !background.followupSkipped && <section className="gentle-question" aria-label="一个小问题"><p>{followup.question}</p><p className="small">{hardQuestion(background)?'请先确认这些互相矛盾的信息，再继续。':'补充后点击下方按钮继续，也可以跳过。'}</p><div className="question-options">{followup.options.map(option=><button type="button" key={option} aria-pressed={background.followupAnswer===option} onClick={()=>setBackground({...background,followupAnswer:option,followupSkipped:''})}>{option}</button>)}</div><label className="sr-only" htmlFor="followup-answer">也可以自己说</label><input id="followup-answer" value={background.followupAnswer || ''} maxLength={500} placeholder="也可以自己说" onChange={e=>setBackground({...background,followupAnswer:e.target.value,followupSkipped:''})}/><div className="am-followup-actions"><button type="submit" className="primary" disabled={busy}>按这个补充继续生成</button>{!hardQuestion(background)&&<button type="button" className="text-button" disabled={busy} onClick={e=>next(e,true)}>跳过，直接生成</button>}</div></section>}
        <section className="optional-fields" aria-label="当时的你"><h2 className="form-group-title">当时的你</h2><div className="coordinate-pair">{field('birthYear','出生年份','例如：2000','input')}<label className="field">性别 *<select name="gender" value={background.gender || ''} onChange={update}><option value="">请选择</option>{['女','男','非二元','不透露'].map(value=><option key={value} value={value}>{value}</option>)}</select></label>{field('forkAge','当时年龄','例如：17','input')}</div>
        {coordinates(background).forkYear && <p className="form-hint">那年大约是{coordinates(background).forkYear}年</p>}
        {field('locationText','当时所在地','城市或你愿意说的地方','input')}
        <h2 className="form-group-title">你想补充的</h2><div className="mbti-row"><label className="field">MBTI *<select name="mbti" value={background.mbti || ''} onChange={update}><option value="">请选择</option><option value="unknown">不确定</option>{MBTI_TYPES.map(type=><option key={type}>{type}</option>)}</select></label><details className="mbti-help"><summary>帮助</summary><p className="small">MBTI仅辅助表达风格，以你具体说的话为准，不决定职业、经历或人生结果。不确定也没关系。</p></details></div>
        {field('choiceReason','当时，你为什么这样选？','有没有什么让你犹豫，或者差一点改变主意？不记得可以写“不记得”。')}
        {field('details','还有什么希望这条人生保留，或不要写错？','没有补充可写“无”。不确定也可以直接说明。')}
        {field('lifeSituation','当时的你，过着怎样的生活？（选填）','例如：在读大学；刚入职，和朋友合租。')}
        </section>
        {pendingStory()&&<div className="draft-actions"><button type="button" className="secondary" disabled={busy} onClick={e=>next(e,false,pendingStory())}>恢复生成结果</button><button type="button" className="text-button" disabled={busy} onClick={()=>experience.cancelStory().then(()=>setError("已取消，草稿仍保留。")).catch(e=>setError(e.message))}>取消原任务</button></div>}<div className="form-bottom"><div className="draft-actions"><span className="draft-status" role="status">{storageOkay===null?'正在保存…':storageOkay?'已保存':'暂时无法保存，请先备份文字'}</span><button type="button" className="text-button" disabled={busy} onClick={clearForm}>一键清空</button>{clearedDraft && <button type="button" className="text-button" disabled={busy} onClick={undoClear}>撤销清空</button>}</div><button className="primary" disabled={busy}>{editingProfile?'保存资料':busy?'正在写信…':generationFailed?'重试生成':status?.mode==='real'?'生成平行人生 ↗':'查看演示人生 ↗'}</button></div>{error && <div role="alert" className="error"><p>{error}</p>{failureId&&<label>请求ID（可选中复制）<input readOnly value={failureId} onFocus={e=>e.target.select()}/></label>}</div>}
      </form></section>}
      {page==='life'&&story&&<div className="life-layout"><div className="page-top"><button className="text-button" onClick={()=>navigate('input')}>修改背景信息</button><button className="text-button" onClick={()=>setStoryInfoOpen(true)}>查看故事背景</button></div>{notice}{reviewStory(story,generatedBackground,memories).issues.length>0&&<aside className="story-review"><p>有些时间或经历与背景不一致，原文仍为你保留。</p><button className="text-button" onClick={()=>navigate('input')}>核对背景并更新故事</button><small>更新会另存一个故事，原来的仍保留。</small></aside>}<StoryPaper key={lifeId} id={lifeId} play={freshStoryId===lifeId} onShown={()=>{const t=storyDisplayTiming.current;if(t?.lifeId===lifeId&&!t.shown){t.shown=true;const {lifeId:_,clientStarted,shown,...safe}=t;reportStoryTiming(safe,'shown',{displayCompleteMs:Math.round(performance.now()-clientStarted)});}}}><section className="life-heading"><p className="eyebrow">遇见另一个自己</p><h1 ref={heading} tabIndex={-1}>{story.title}</h1><p>{rolePresentation(story.identity,generatedBackground)} {storyMode === 'demo' && <span className="tag">示例人物</span>}</p><p className="description">{story.intro}</p></section><section className="scenes">{story.scenes.map((scene,i) => <article className="scene" key={i}><time>{sceneTimeLabel(scene.time,generatedBackground)}</time><div><h2>{scene.title}</h2><p>{scene.text}</p></div></article>)}</section></StoryPaper><div className="chat-invite"><div><h2>有些话，想和另一个自己聊聊。</h2><p>{storyMode === 'demo' ? '打开与示例人物的演示对话。' : '带着这段人生，开始一封新的回信。'}</p></div><button className="primary" onClick={() => navigate('chat')}>继续聊天 <span>↗</span></button></div><AboutMe title="故事背景" open={storyInfoOpen} onClose={()=>setStoryInfoOpen(false)}><aside className="background-card"><p className="small">{storyMode === 'demo' ? '以下是你的原文，未用于生成示例故事。' : ''}</p><dl><dt>故事开始于</dt><dd>{coordinates(generatedBackground).forkYear || '未知'}</dd><dt>当时所在地或环境</dt><dd>{coordinates(generatedBackground).locationAtFork || '未填写'}</dd>{[['mbti','MBTI（表达风格参考）'],['birthYear','出生年份'],['gender','性别'],['forkAge','分岔时年龄'],['realityOutcome','想回到的瞬间'],['hypotheticalDirection','这次探索的可能'],['lifeSituation','当时的生活'],['choiceReason','当时选择的原因'],['details','补充背景']].map(([key, title]) => generatedBackground[key] && (key!=='gender'||['女','男','非二元'].includes(generatedBackground.gender)) && <React.Fragment key={key}><dt>{title}</dt><dd>{generatedBackground[key]}</dd></React.Fragment>)}</dl><button className="text-button" onClick={() => navigate('input')}>修改这些文字 ↗</button></aside><details className="era-notes"><summary>背景资料</summary><p className="small"></p>{eraContext.length ? eraContext.map(card=><article key={card.id}><h3>{card.title}</h3><p>{card.start} 至 {card.end} · {card.regions.join('、')} · {card.educationScope.join('、')}</p><ul>{card.facts.map(f=><li key={f}>{f}</li>)}</ul><p>{card.limits}</p><a href={card.url} target="_blank" rel="noreferrer">{card.sourceTitle}</a></article>):<p>这段故事以个人生活为主。</p>}</details></AboutMe></div>}
      {page === 'chat' && story && <section className="chat-page"><div className="chat-title"><div className="avatar">我</div><div><h1 ref={heading} tabIndex={-1}>与另一个自己通信</h1><p>{chatIdentity(generatedBackground)}</p></div><nav className="chat-nav"><button type="button" className="text-button" onClick={()=>navigate('life')}>故事</button><button type="button" className="text-button" onClick={()=>setAboutOpen(true)}>关于我与记忆</button></nav></div>{notice}<div className="messages" onScroll={e=>{const el=e.currentTarget;followBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<70;chatPositions.current.set(lifeId,el.scrollTop);}} ref={messagesBox} role="log" aria-label="对话记录" aria-live="polite"><div className="message assistant first-letter"><span className="speaker-label">另一个自己</span><p>{qualifyCurrentAge(currentOpening(story,generatedBackground),generatedBackground).trim()}</p></div>{messages.map((message, i) => <div className={`message ${message.role} ${historicMessages.current.has(message.id)?'':'am-new-message'}`} key={message.id||i}><span className="speaker-label">{message.role==='user'?'你':'另一个自己'}</span><p>{message.text.trim()}</p>{message.contextExcluded && <small>这条旧回复有误，已保留原文。</small>}{message.role==='user' && message.status==='failed' && <button className="text-button" disabled={busy} onClick={e=>send(e,message)}>重试这条消息</button>}</div>)}{chatWaiting && <p role="status">另一个自己正在输入…</p>}<div ref={chatEnd}/></div>
        {chatWaiting && <div className="stream-actions"><button type="button" className="text-button" onClick={showReceived}>立即显示全部（已收到的内容）</button><button type="button" className="text-button" onClick={stopReply}>停止本轮回复</button></div>}

        <div className="closing-row"><button type="button" className="closing-button" onClick={endChat} disabled={wrapWorkingId===lifeId}>先聊到这里吧</button></div><form className="composer" onSubmit={send}><label className="sr-only" htmlFor="message">写给另一个自己</label><textarea ref={composer} id="message" onCompositionStart={()=>composing.current=true} onCompositionEnd={()=>composing.current=false} onKeyDown={e=>{
          const action=composerAction(e,composing.current);if(action==='none')return;e.preventDefault();
          if(action==='send'){send(e);return;}
          const input=e.currentTarget,start=input.selectionStart,end=input.selectionEnd;
          if(draft.length-(end-start)>=2000)return;
          setDraft(draft.slice(0,start)+'\n'+draft.slice(end));requestAnimationFrame(()=>{input.selectionStart=input.selectionEnd=start+1;});
        }} value={draft} onChange={e => setDraft(e.target.value)} placeholder="写给另一个自己……" rows={1} maxLength={2000}/><button className="primary" disabled={!draft.trim() || busy || wrapWorkingId===lifeId}>{busy ? '正在回信…' : '发送'} <span>↑</span></button></form>{error && <div role="alert" className="error"><p>{error}</p>{failureId&&<label>请求ID（可选中复制）<input readOnly value={failureId} onFocus={e=>e.target.select()}/></label>}</div>}<p className="small">Enter 发送 · Ctrl＋Enter 换行</p></section>}
      {page==='chat' && <AboutMe open={aboutOpen} onClose={()=>setAboutOpen(false)}><button type="button" className="text-button" disabled={busy} onClick={()=>{setAboutOpen(false);setEditingProfile(true);setFormOrigin('chat');setBackground(migrateBackground(generatedBackground));setPage('input');}}>修改故事背景</button>        <label className="field">MBTI（选填）<select disabled={busy} value={generatedBackground.mbti || ''} onChange={e=>{setGeneratedBackground({...generatedBackground,mbti:e.target.value});setContextStart(messages.length);setSavedNotice('已保存');}}><option value="">不填写</option><option value="unknown">不确定</option>{MBTI_TYPES.map(t=><option key={t}>{t}</option>)}</select></label><p className="small">以你亲口说的为准，类型只是参考。</p>{sessionMeta.review?.status==='failed'&&<button className="text-button" onClick={endChat}>重新整理上次聊天</button>}<button type="button" className="text-button" disabled={busy} onClick={()=>{try{const result=mutateLife(lifeId,l=>{const r=revisitMemories(l);return r.sessionMeta.review?.status==='failed'?r:completeReview(r);});setSavedNotice(!result?.okay?'暂时无法保存，请保留页面。':result.next.sessionMeta.review?.status==='failed'?'记忆整理失败，请稍后再试。':result.next.memories.length?'已保存，可在下方查看和编辑。':'没有找到适合保留的新信息。');}catch{setSavedNotice('记忆整理未完成，请检查已有内容后再试。');}}}>从已有聊天整理记忆</button><MemoryPanel messages={messages} memories={memories} candidates={candidates} onCandidates={changeCandidates} onMemories={changeMemories} onSaved={()=>setSavedNotice('已保存')} disabled={busy}/>{savedNotice && <p role="status">{savedNotice}</p>}</AboutMe>}
      {busy && generation.current && page==='input' && <PostalWaiting settingNote={waitingNote} onCancel={cancelGeneration} retrying={storyRetrying}/>}
    </main><footer><span>another me <span className="footer-dot">·</span> 另一种人生，依然是你</span><span>每条路，都有自己的光。 <span>✧</span></span></footer>
  </fieldset></div>;
}
createRoot(document.getElementById('root')).render(<App/>);





