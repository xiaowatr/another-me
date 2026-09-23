export function shouldOpenLetter(storage,id,reduced){if(reduced||!id)return false;try{return !storage.getItem('another-me.opened-letter:'+id);}catch{return false;}}
export function markLetterOpened(storage,id){try{storage.setItem('another-me.opened-letter:'+id,'1');}catch{}}
