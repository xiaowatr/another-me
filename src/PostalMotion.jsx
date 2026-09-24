import React,{useEffect,useState} from 'react';
import './postal-motion.css';
export function Mailbox({onStart}){return <button type="button" className="am-mailbox-scene am-mailbox-start" onClick={onStart} aria-label="点击开始，打开邮筒写信"><span className="am-mailbox-orbit"/><div className="am-mailbox"><div className="am-mailbox-cap"/><div className="am-mailbox-slot"/><span className="am-mailbox-letter" aria-hidden="true"><span>点击开始</span></span><div className="am-mailbox-label">another me<small>平行人生邮局</small><span aria-hidden="true">✉</span></div><div className="am-mailbox-door"/><div className="am-mailbox-base"/></div><span className="am-mailbox-caption">点击邮筒，寄往另一种可能</span></button>;}
export function PostalWaiting({onCancel,retrying=false,settingNote=[],recovering=false}){return <aside className="am-postal-wait" aria-label="正在等待回信"><div className="am-sending" aria-hidden="true"><div className="am-send-sheet"><span className="am-send-fold"/></div><div className="am-send-pocket"/><div className="am-send-flap"/></div><svg className="am-mail-route" viewBox="0 0 300 80" aria-hidden="true"><path d="M15 60 C75 -5 125 105 185 35 S250 30 285 15"/><circle r="3"/></svg><p role="status">{recovering?'连接有些不稳，正在找回这封回信…':retrying?'这封回信没写好，正在重新写一次…':'正在等待另一条时间线的回信'}</p><SettingNote lines={settingNote}/><button type="button" className="text-button" onClick={onCancel}>取消等待，保留草稿</button></aside>;}

export function SettingNote({lines=[]}){
 const text=lines.slice(0,3).join('\n');const [shown,setShown]=useState(0);
 useEffect(()=>{setShown(0);if(!text)return;const media=matchMedia('(prefers-reduced-motion: reduce)');let timer;
 const start=()=>{clearInterval(timer);if(media.matches){setShown(text.length);return;}let n=0;timer=setInterval(()=>{n=Math.min(n+1,text.length);setShown(n);if(n===text.length)clearInterval(timer);},35);};
 start();media.addEventListener('change',start);return()=>{clearInterval(timer);media.removeEventListener('change',start);};},[text]);
 if(!text)return null;
 return <div className="am-setting-note" aria-label={text}>{lines.slice(0,3).map((line,i)=>{const offset=lines.slice(0,i).join("\n").length+(i?1:0),count=Math.max(0,shown-offset);return <span key={i} aria-hidden="true">{line.slice(0,count)}<span className="am-note-unwritten">{line.slice(count)}</span></span>;})}</div>;
}
