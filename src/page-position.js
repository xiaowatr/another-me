const KEY='another-me.page.v1';
export function initialPage(storage,lives,hasDraft,pending){try{const p=JSON.parse(storage?.getItem(KEY)||'null');if(['chat','life'].includes(p?.page)&&p.lifeId===lives.activeId&&lives.lives.some(l=>l.id===p.lifeId))return p.page;if(p?.page==='lives'&&lives.lives.length)return 'lives';}catch{}return pending||hasDraft?'input':lives.lives.length?'lives':'home';}
export function savePage(storage,page,lifeId){try{storage?.setItem(KEY,JSON.stringify({page,lifeId}));}catch{}}
