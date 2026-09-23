import React,{useState} from 'react';
import {archiveName} from './story-input';
function Entry({life,onOpen,onRename}){
 const [editing,setEditing]=useState(false),[name,setName]=useState(archiveName(life));
 return <article className="archive-entry">{editing?<form onSubmit={e=>{e.preventDefault();if(name.trim()){onRename(life.id,name.trim().slice(0,60));setEditing(false);}}}><label>故事名称<input autoFocus value={name} maxLength={60} onChange={e=>setName(e.target.value)}/></label><button type="submit" className="text-button" disabled={!name.trim()}>保存名称</button><button type="button" className="text-button" onClick={()=>setEditing(false)}>取消</button></form>:<><button type="button" className="text-button story-link" onClick={()=>onOpen(life.id)}>{archiveName(life)}</button><button type="button" className="text-button" onClick={()=>{setName(archiveName(life));setEditing(true);}}>改名</button></>}</article>;
}
function exportBackup(){try{const keys=['another-me.lives.v1.before-v8','another-me.background-draft.v1.before-v8'];const data=Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]).filter(([,v])=>v));if(!Object.keys(data).length)return;const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='another-me-迁移前备份.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{}}
export default function StoryArchive({library,onOpen,onRename,onNew,disabled}){
 return <details className="story-archive"><summary>我的故事</summary><fieldset disabled={disabled}><p className="small">你的故事都在这里。</p><button type="button" className="text-button" onClick={exportBackup}>导出旧版备份</button>{library.map(l=><Entry key={l.id} life={l} onOpen={onOpen} onRename={onRename}/>)}{!library.length&&<p className="small">还没有保存的故事。</p>}<button type="button" className="text-button" onClick={onNew}>探索新的人生 ↗</button></fieldset></details>;
}
