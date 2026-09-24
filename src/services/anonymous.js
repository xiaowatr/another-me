const KEY='another-me.anonymous.v1';
let ephemeral;
export function anonymousToken(){
 if(typeof localStorage==='undefined'){if(typeof window!=='undefined')throw Object.assign(new Error('浏览器无法保存连接标识。请保留当前页面，并允许此网站使用本地存储后再试。'),{category:'identity_storage'});return ephemeral||=(Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join(''));}
 try{let value=localStorage.getItem(KEY);if(!/^[a-f0-9]{64}$/.test(value||'')){value=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');localStorage.setItem(KEY,value);}return value;}catch{throw Object.assign(new Error('浏览器无法保存连接标识。请保留当前页面，并允许此网站使用本地存储后再试。'),{category:'identity_storage'});}
}
