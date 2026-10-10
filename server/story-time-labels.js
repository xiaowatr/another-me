// A range label is not an invented per-chapter date or a story-end clock.
export const CHAPTER_POSITIONS=Object.freeze([Object.freeze({chapter:'chapter1',position:'start',label:'开始时'}),Object.freeze({chapter:'chapter2',position:'during',label:'期间'}),Object.freeze({chapter:'chapter3',position:'near_end',label:'临近结束'})]);
export function storyRangeLabel(setting){
 const {start,window}=setting?.constraints?.observation||{};
 const origin=start&&!start.estimated&&Number.isInteger(start.year)?`${start.year}年${Number.isInteger(start.month)?start.month+'月':''}${Number.isInteger(start.day)?start.day+'日':''}起`:'';
 const range=window?.weeks?window.weeks+'周内':window?.months?window.months+'个月内':'';
 return [origin,range].filter(Boolean).join(' · ')||'这段日子';
}
export function fillChapterTimes(story,setting){const range=storyRangeLabel(setting);for(const {chapter,label} of CHAPTER_POSITIONS)if(story[chapter])story[chapter].time=[range==='这段日子'?'':range,label].filter(Boolean).join(' · ');return story;}
