export function chatRetryText(event){
 if(event?.type==='retry'&&event.attempt===2&&event.maxAttempts===2)return event.reason==='connect_timeout'?'信号打了个小盹，正在再连一次…（第2/2次）':'刚才卡了一下，正在再试一次…（第2/2次）';
 if(event?.type==='status'&&event.phase==='repair')return '这句话再理顺一下，马上接着说…';
 return '';
}
