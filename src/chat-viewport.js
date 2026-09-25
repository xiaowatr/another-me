// Keyboard viewport and fixed-position boxes may move independently in mobile Safari.
export function viewportBox(v,innerHeight){const height=Math.min(v?.height||innerHeight,innerHeight);return {height,top:Math.max(0,Math.min(v?.offsetTop||0,innerHeight-height))};}

export function watchChatViewport(win,root,onResize=()=>{}){
 let frame,timers=[],closed=false,lastHeight=null;
 const mobile=win.matchMedia('(max-width:760px)'),body=win.document.body,html=win.document.documentElement,scrollY=win.scrollY;
 const original={position:body.style.position,top:body.style.top,width:body.style.width,overflow:body.style.overflow,height:body.style.height};
 const originalHtml=html?{overflow:html.style.overflow,height:html.style.height,overscrollBehavior:html.style.overscrollBehavior}:null;
 let locked=false;
 const unlock=()=>{Object.assign(body.style,original);if(html)Object.assign(html.style,originalHtml);locked=false;};
 const lock=()=>{if(mobile.matches&&!locked){locked=true;Object.assign(body.style,{position:'static',top:'',width:'100%',overflow:'hidden',height:'100%'});if(html)Object.assign(html.style,{overflow:'hidden',height:'100%',overscrollBehavior:'none'});}else if(!mobile.matches&&locked)unlock();};
 const update=()=>{if(closed)return;win.cancelAnimationFrame(frame);frame=win.requestAnimationFrame(()=>{
  if(closed)return;const b=viewportBox(win.visualViewport,Math.max(win.innerHeight,html?.clientHeight||0));
  root.style.setProperty('--chat-viewport',b.height+'px');

  // Absolute shell uses document coordinates. No DOM measurement feeds back
  // into its next position during Safari keyboard animation.
  const pageTop=Number.isFinite(win.visualViewport?.pageTop)?win.visualViewport.pageTop:(win.scrollY||0)+b.top;
  root.style.setProperty('--chat-offset',Math.max(0,pageTop)+'px');
  if(lastHeight!==b.height){lastHeight=b.height;onResize();}
 });};
 const settle=()=>{update();timers.forEach(clearTimeout);timers=[80,250,500].map(ms=>setTimeout(update,ms));};
 const mediaChange=()=>{lock();settle();};lock();mobile.addEventListener('change',mediaChange);
 const v=win.visualViewport;v?.addEventListener('resize',settle);v?.addEventListener('scroll',update);
 win.addEventListener('resize',settle);win.addEventListener('scroll',update);win.addEventListener('focusout',settle);win.addEventListener('focusin',settle);
 const composer=win.document.querySelector?.('.composer');const observer=win.ResizeObserver&&composer?new win.ResizeObserver(update):null;observer?.observe(composer);
 update();return()=>{closed=true;mobile.removeEventListener('change',mediaChange);observer?.disconnect();win.cancelAnimationFrame(frame);timers.forEach(clearTimeout);v?.removeEventListener('resize',settle);v?.removeEventListener('scroll',update);win.removeEventListener('resize',settle);win.removeEventListener('scroll',update);win.removeEventListener('focusout',settle);win.removeEventListener('focusin',settle);if(locked){unlock();win.scrollTo(0,scrollY);}root.style.removeProperty('--chat-viewport');root.style.removeProperty('--chat-offset');};
}
