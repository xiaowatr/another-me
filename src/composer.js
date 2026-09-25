export function composerAction(event,composing){
 if(event.key!=='Enter' || composing || event.isComposing || event.keyCode===229 || event.nativeEvent?.isComposing || event.nativeEvent?.keyCode===229)return 'none';
 return event.ctrlKey?'newline':'send';
}
// Measure a separate textarea: collapsing the focused control makes mobile browsers
// scroll to a transient caret position while the software keyboard is opening.
export function resizeComposer(el){
 if(!el)return;
 const probe=el.cloneNode(false);
 probe.removeAttribute('id');probe.removeAttribute('name');probe.removeAttribute('autofocus');
 probe.setAttribute('aria-hidden','true');probe.tabIndex=-1;
 Object.assign(probe.style,{position:'fixed',top:'0px',left:'-10000px',width:el.getBoundingClientRect().width+'px',height:'0px',minHeight:'0px',maxHeight:'none',visibility:'hidden',pointerEvents:'none'});
 probe.value=el.value;el.parentNode.appendChild(probe);
 const border=2,content=probe.scrollHeight+border;probe.remove();
 el.style.height=Math.min(136,Math.max(40,content))+'px';
 el.style.overflowY=content>136?'auto':'hidden';
}
