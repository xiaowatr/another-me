import {dateParts} from './input-anchors.js';
// Story labels are the clock source; unknown precision stays unknown.
export function storyClock(background,story){
 let anchor=null,label=null;
 for(const scene of story?.scenes||[]){if(/回忆|此前|回顾/.test(scene.time||''))continue;label=scene.time||null;const d=dateParts(label)[0];if(d)anchor=d;else if(/同年/.test(label||'')&&anchor)anchor={year:anchor.year,month:null};else if(/次年|翌年/.test(label||'')&&anchor)anchor={year:anchor.year+1,month:null};else anchor=null;}
 const birth=/^\d{4}$/.test(background?.birthYear||'')?Number(background.birthYear):null;
 return {mode:'story_end',label:label||'故事结束时',year:anchor?.year??null,month:anchor?.month??null,day:anchor?.day??null,asOf:anchor?[anchor.year,...(anchor.month?[String(anchor.month).padStart(2,'0')]:[]),...(anchor.day?[String(anchor.day).padStart(2,'0')]:[])].join('-'):null,approxAge:birth&&anchor?.year>=birth?anchor.year-birth:null};
}

export function beyondStoryEnd(text,clock){return clock?.year!=null&&dateParts(text).some(d=>d.year>clock.year||d.year===clock.year&&clock.month&&d.month>clock.month||d.year===clock.year&&d.month===clock.month&&clock.day&&d.day>clock.day);}
