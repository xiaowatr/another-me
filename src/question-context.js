import {timeAnchors,futureScenario} from './input-anchors.js';
export function questionTime(background,now=new Date()) {const a=timeAnchors(background,now);return {tense:futureScenario(background,a)?'future':'original',year:a.start?.year||null,meaning:futureScenario(background,a)?'未来设想，询问用户现在的偏好和行为':'过去分叉，询问事件当时的情况，不改成现在'};}
export function questionTitle(question,meta,background){if(meta?.displayedQuestionText)return meta.displayedQuestionText;if(question.scenario)return (questionTime(background).tense==='future'?'请按现实现在的你回答这个假设：':'请按分叉点当时的你回答这个假设：')+question.question;const t=questionTime(background),title=meta?.questionText||question.question;

 return t.tense==='future'?(question.id==='R02'?'现在，你们平时怎么相处？':title).replace(/当时的你/g,'现在的你').replace(/^那段时间，?/,'现在，').replace(/^那时候，?/,'现在，').replace(/^那时，?/,'现在，').replace(/^那会儿，/,'现在，').replace(/^那件事发生前/,'在设想的那件事发生前'):title.replace(/现在|目前|如今/g,'那时');}
