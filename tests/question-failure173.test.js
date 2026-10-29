import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {transformWithOxc} from 'vite';
import {supplementState,saveSupplement} from '../src/supplementary.js';
import {optionalQuestionFallback} from '../src/question-recovery.js';

// Exercise the real component's effects and event handlers with a small hook/DOM harness.
// No browser, HTTP request, model or React renderer is started by these tests.
const sourceURL=new URL('../src/SupplementaryQuestions.jsx',import.meta.url);
const original=await fs.readFile(sourceURL,'utf8');
const source=process.env.QUESTION_COMPONENT_SOURCE?await fs.readFile(process.env.QUESTION_COMPONENT_SOURCE,'utf8'):original;
async function mount(planQuestions,background={realityOutcome:'原来两人都没有去。',hypotheticalDirection:'一人留下，一人出发。',details:'关系和去留尚未说明。'}){
 let cursor=0,slots=[],effects=[],tree,submitted=[],changed=[],apiCalls=0;
 const hook=(init)=>{const i=cursor++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];};
 const React={createElement:(type,props,...children)=>({type,props:{...props,children}})};
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const hooks={default:React,useState:hook,useRef:v=>hook(()=>({current:v}))[0],useEffect:(fn,deps)=>{const i=cursor++;if(!same(slots[i],deps)){slots[i]=deps;effects.push(fn);}}};
 const bindings={};let n=0;
 const imports=source.replace(/import\s+([^;]+?)\s+from\s+['"]([^'"]+)['"];?/g,(_,names,path)=>{
  bindings['m'+n]=path==='react'?hooks:path==='./services'?{experience:{planQuestions:(...a)=>{apiCalls++;return planQuestions(...a);}}}:null;
  const key='m'+n++;if(!bindings[key])bindings[key]=path;
  const declarations=[];
  const named=names.match(/\{([^}]+)\}/);
  if(named)declarations.push(`const {${named[1].replace(/\s+as\s+/g,':' )}}=${key};`);
  const def=names.split(',')[0].trim();if(!def.startsWith('{'))declarations.push(`const ${def}=${key}.default;`);
  return declarations.join('\n');
 });
 for(const [k,v] of Object.entries(bindings))if(typeof v==='string')bindings[k]=await import(new URL(v,sourceURL));
 const compiled=await transformWithOxc(imports.replace('export default function SupplementaryQuestions','function SupplementaryQuestions'),fileURLToPath(sourceURL),{lang:'jsx',jsx:{runtime:'classic'}});
 const Component=new Function(...Object.keys(bindings),compiled.code+';return SupplementaryQuestions;')(...Object.values(bindings));
 const storage={getItem:()=>null,setItem(){},removeItem(){}};
 globalThis.localStorage=storage;globalThis.window={scrollY:0,scrollX:0,innerHeight:800,addEventListener(){},removeEventListener(){},scrollTo(){}};
 globalThis.document={body:{getAttribute:()=>null,removeAttribute(){},setAttribute(){},style:{}}};
 function walk(x,fn){if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(v=>walk(v,fn));return;}fn(x);walk(x.props?.children,fn);}
 function render(){cursor=0;effects=[];tree=Component({background,onChange:b=>changed.push(b),onClose(){},onGenerate:b=>submitted.push(b)});walk(tree,x=>{if(x.props?.ref)x.props.ref.current={showModal(){},scrollTo(){},style:{setProperty(){}}};});const jobs=effects;effects=[];jobs.forEach(f=>f());}
 async function flush(){for(let i=0;i<5;i++){await new Promise(r=>setImmediate(r));render();}}
 function find(predicate){let found;walk(tree,x=>{if(predicate(x))found=x;});return found;}
 function text(x){if(arguments.length===0)x=tree;return !x?'':Array.isArray(x)?x.map(text).join(''):typeof x==='object'?text(x.props?.children):String(x);}
 render();await flush();
 return {flush,submitted,changed,get calls(){return apiCalls;},text,find,async click(label){const b=find(x=>x.type==='button'&&text(x)===label);assert.ok(b,'button '+label);assert.ok(!b.props.disabled);await b.props.onClick();await flush();}};
}
const empty={questions:[],covered:[],conflict:null,expectations:{},stop:true};
test('planner failure remains on question page until explicit skip; no false answered/skipped state',async()=>{
 const b={details:'关系和去留尚未说明。'},initial=supplementState(b);initial.shown=['G08'];initial.pages=[['G08']];initial.answers.G08={selected:[],text:'我之前填写的回答',skipped:false};
 const ui=await mount(async()=>optionalQuestionFallback(),saveSupplement(b,{...initial,plan:null,page:1}));
 assert.equal(ui.calls,1);assert.equal(ui.submitted.length,0);assert.match(ui.text(),/补充内容已保留/);assert.equal(ui.find(x=>x.props?.role==='alert'),undefined);assert.doesNotMatch(ui.text(),/未能准备好|失败/);
 assert.equal(supplementState(ui.changed.at(-1)).answers.G08.text,'我之前填写的回答');
 assert.equal(supplementState(ui.changed.at(-1)).skippedRemaining,undefined);
 await ui.click('跳过未完成的补充，开始写故事');assert.equal(ui.submitted.length,1);
 assert.equal(supplementState(ui.submitted[0]).answers.G08.text,'我之前填写的回答');
});
test('transport error does not silently generate and retains request ID',async()=>{
 const ui=await mount(async()=>{throw Object.assign(new Error('mock network'),{category:'network',requestId:'mock-failure'});});
 assert.equal(ui.submitted.length,0);assert.match(ui.text(),/补充内容已保留/);assert.equal(ui.find(x=>x.props?.role==='alert'),undefined);assert.doesNotMatch(ui.text(),/未能准备好|失败/);
 assert.equal(ui.find(x=>x.type==='input'&&x.props.readOnly)?.props.value,'mock-failure');
});
test('reviewed questions actually display and require explicit action',async()=>{
 const ui=await mount(async()=>({...empty,questions:[{id:'K1',questionText:'你与小林是什么关系？谁留下、谁出发？'}]}));
 assert.match(ui.text(),/你与小林是什么关系/);assert.equal(ui.submitted.length,0);
});
test('valid zero-question result still waits for start and is not labelled failed',async()=>{
 const ui=await mount(async()=>empty);assert.equal(ui.submitted.length,0);assert.doesNotMatch(ui.text(),/补充内容已保留/);
 await ui.click('开始写故事');assert.equal(ui.submitted.length,1);
});
test('failure preserves real conflict and cannot skip into story',async()=>{
 const conflict={question:'请确认原设定。',evidence:[]};
 const ui=await mount(async()=>optionalQuestionFallback({plan:{conflict}}));
 assert.match(ui.text(),/请确认原设定/);assert.equal(ui.submitted.length,0);assert.equal(ui.find(x=>x.type==='button'&&ui.text(x).includes('开始写故事')),undefined);
});
test('reopening saved failure shows notice and keeps explicit choice without extra planner call',async()=>{
 const b={details:'先问清楚。'},s={...supplementState(b),plan:optionalQuestionFallback()};
 const ui=await mount(async()=>{throw Error('must not call');},saveSupplement(b,s));assert.equal(ui.calls,0);assert.match(ui.text(),/补充内容已保留/);assert.equal(ui.submitted.length,0);assert.ok(ui.find(x=>x.type==='input'&&x.props.readOnly));assert.doesNotMatch(ui.text(),/已经可以开始写/);
});

test('explicit skip during loading waits for a returned conflict and cannot bypass it',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);const ui=await mount(()=>pending);
 assert.equal(ui.submitted.length,0);const click=ui.click('跳过补充，开始写故事');
 resolve({...empty,conflict:{question:'请确认谁留下。',evidence:[]}});await click;
 assert.equal(ui.submitted.length,0);assert.match(ui.text(),/请确认谁留下/);
});
test('explicit skip during loading can continue after unavailable result',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);const ui=await mount(()=>pending);
 assert.equal(ui.submitted.length,0);const click=ui.click('跳过补充，开始写故事');
 resolve(optionalQuestionFallback());await click;assert.equal(ui.submitted.length,1);
});

// v174: transient errors recover automatically inside existing bounds; no model request multiplication.
import {planWhenReady} from '../src/services/question-admission.js';
import {createPlannerTasks,planWithGapCheck} from '../server/supplementary-planner.js';
import {AppError} from '../server/core.js';
test('timeout recovery reattaches one cached plan while server retries only its failed stage',async()=>{
 const b={realityOutcome:'没有学陶艺。',hypotheticalDirection:'报名并上课。'};let transport=0,model=0;const notices=[];
 const cached=createPlannerTasks(background=>planWithGapCheck(background,{call:async(t,m,o)=>{
  model++;if(model<=2)throw new AppError('timeout');
  const result={questions:[],covered:[],conflict:null,scenarioCandidates:[],expectations:{},stop:true,...(model>3?{keepScenario:false,changeSubject:'self',evidence:b.hypotheticalDirection}:{})};
  o.validateResult(result);return {result,requestId:'mock-plan'};
 }},{sleep:async()=>{}}));
 const result=await planWhenReady(async(path,{background})=>{
  transport++;assert.equal(path,'/api/questions');assert.deepEqual(background,b);const sameTask=cached('same-owner',background);
  if(transport<3)throw Object.assign(new Error('timeout'),{category:'timeout'});return sameTask;
 },b,null,s=>notices.push(s),{sleep:async()=>{}});
 assert.equal(transport,3);assert.equal(model,4);assert.equal(result.optionalAnalysisUnavailable,undefined);
 assert.ok(notices.some(s=>s.includes('重新接回')));assert.ok(notices.every(s=>!/失败|中断|[23]\/3/.test(s)));
 assert.equal(await cached('same-owner',b),result);assert.equal(model,4);
});
test('exhausted timeout recovery has a fixed ceiling and never creates a new planning task',async()=>{
 let transport=0,runs=0;const b={details:'保留原填写'},cached=createPlannerTasks(async()=>{runs++;return optionalQuestionFallback();});
 await assert.rejects(planWhenReady(async()=>{transport++;await cached('same-owner',b);throw new AppError('timeout');},b,null,()=>{},{sleep:async()=>{}}),e=>e.category==='timeout');
 assert.equal(transport,3);assert.equal(runs,1);
});
test('cancel during retry delay stops further requests',async()=>{
 const c=new AbortController();let requests=0;
 await assert.rejects(planWhenReady(async()=>{requests++;throw new AppError('timeout');},{},c.signal,()=>{},{sleep:async()=>c.abort()}),e=>e.name==='AbortError');
 assert.equal(requests,1);
});
test('non-transient input conflict is not retried as timeout',async()=>{
 let requests=0;await assert.rejects(planWhenReady(async()=>{requests++;throw new AppError('input_conflict');},{},null,()=>{},{sleep:async()=>{}}),e=>e.category==='input_conflict');assert.equal(requests,1);
});
test('server timeout alone exhausts existing three attempts without exposing unreviewed questions',async()=>{
 let model=0;const result=await planWithGapCheck({realityOutcome:'没有上课。',hypotheticalDirection:'报名并上课。'},{call:async()=>{model++;throw new AppError('timeout');}},{sleep:async()=>{}});
 assert.equal(model,3);assert.equal(result.optionalAnalysisUnavailable,true);assert.deepEqual(result.questions,[]);
});

// v176: literal user requests precede optional AI planning, including saved older plans.
const literalBase={realityOutcome:'本来和小林一起走，后来都没走成。',hypotheticalDirection:'一个人留下，一个人出发。',details:'小林和我什么关系、到底谁走谁留，你先问问我再写吧。'};
test('explicit literal question is shown on opening without a model request or automatic story',async()=>{
 const ui=await mount(async()=>{throw Error('must not call');},literalBase);assert.equal(ui.calls,0);assert.match(ui.text(),/小林和我什么关系、到底谁走谁留/);assert.equal(ui.submitted.length,0);
});
test('saved older generic question cannot conceal the requested literal question or reassign its old answer',async()=>{
 const s={...supplementState(literalBase),shown:['K1'],pages:[['K1']],questionMeta:{K1:{questionText:'你们平时怎么相处？',displayedQuestionText:'你们平时怎么相处？'}},answers:{K1:{selected:[],text:'偶尔聊天',skipped:false}},plan:{questions:[{id:'K1',questionText:'你们平时怎么相处？'}],stop:true}};
 const ui=await mount(async()=>{throw Error('must not call');},saveSupplement(literalBase,s));assert.equal(ui.calls,0);assert.match(ui.text(),/谁走谁留/);const state=supplementState(ui.changed.at(-1));assert.equal(state.pages.at(-1)[0],'K2');assert.equal(state.answers.K1.text,'偶尔聊天');assert.equal(state.answers.K2,undefined);assert.equal(ui.submitted.length,0);
});
test('literal answer is stored with original question and only explicit start hands it off',async()=>{
 const ui=await mount(async()=>{throw Error('must not call');},literalBase);
 let selected=false;const field=ui.find(x=>x.type==='textarea'&&x.props.rows===2&&!selected&&(selected=true));
 assert.ok(field);field.props.onChange({target:{value:'小林是同事，我留下。'}});await ui.flush();await ui.click('提交本组回答，继续');assert.equal(ui.submitted.length,0);await ui.click('开始写故事');assert.equal(ui.submitted.length,1);const state=supplementState(ui.submitted[0]);assert.equal(state.answers.K1.text,'小林是同事，我留下。');assert.match(state.questionMeta.K1.displayedQuestionText,/谁走谁留/);assert.equal(ui.calls,0);
});
test('literal question remains explicitly skippable, not automatically answered',async()=>{
 const ui=await mount(async()=>{throw Error('must not call');},literalBase);assert.equal(ui.submitted.length,0);await ui.click('跳过剩余问题，开始写故事');assert.equal(ui.submitted.length,1);const state=supplementState(ui.submitted[0]);assert.equal(state.answers.K1.skipped,true);assert.equal(state.answers.K1.text,'');assert.equal(ui.calls,0);
});

test('v177 answered optional group reaches explicit start without a second planner call, including old stop=false plans',async()=>{
 const b={realityOutcome:'没有学陶艺。',hypotheticalDirection:'去学陶艺。'},s=supplementState(b);
 const saved=saveSupplement(b,{...s,shown:['K1'],pages:[['K1']],page:0,answers:{K1:{selected:[],text:'慢慢尝试',skipped:false}},plan:{questions:[{id:'K1',questionText:'你想怎样尝试？'}],stop:false}});
 const ui=await mount(async()=>{throw Error('must not replan')},saved);
 await ui.click('提交本组回答，继续');assert.equal(ui.calls,0);assert.equal(ui.submitted.length,0);assert.match(ui.text(),/开始写故事/);
 await ui.click('开始写故事');assert.equal(ui.submitted.length,1);assert.equal(supplementState(ui.submitted[0]).answers.K1.text,'慢慢尝试');
});
