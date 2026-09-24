const KEY='another-me.anonymous.v1';
let ephemeral;
export function anonymousToken(){
 if(typeof localStorage==='undefined'){if(typeof window!=='undefined')throw new Error('无法保存浏览器身份，请先备份草稿并允许本地保存。');return ephemeral||=(Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join(''));}
 try{let value=localStorage.getItem(KEY);if(!/^[a-f0-9]{64}$/.test(value||'')){value=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');localStorage.setItem(KEY,value);}return value;}catch{throw new Error('无法保存浏览器身份，请先备份草稿并允许本地保存。');}
}
