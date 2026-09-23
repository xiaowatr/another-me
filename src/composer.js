export function composerAction(event,composing){
 if(event.key!=='Enter' || composing || event.isComposing || event.keyCode===229 || event.nativeEvent?.isComposing || event.nativeEvent?.keyCode===229)return 'none';
 return event.ctrlKey?'newline':'send';
}
