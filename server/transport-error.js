// Fixed codes only: never log raw messages, URLs, headers or provider credentials.
const codes=new Map([
 ['ENOTFOUND',['dns',false]],['EAI_AGAIN',['dns',true]],
 ['ECONNREFUSED',['connection',true]],['ECONNRESET',['connection',true]],['EPIPE',['connection',true]],
 ['ENETUNREACH',['connection',true]],['EHOSTUNREACH',['connection',true]],
 ['ETIMEDOUT',['timeout',true]],['UND_ERR_CONNECT_TIMEOUT',['timeout',true]],
 ['UND_ERR_HEADERS_TIMEOUT',['timeout',true]],['UND_ERR_BODY_TIMEOUT',['timeout',true]],
 ['UND_ERR_SOCKET',['connection',true]],
 ['CERT_HAS_EXPIRED',['tls',false]],['DEPTH_ZERO_SELF_SIGNED_CERT',['tls',false]],
 ['SELF_SIGNED_CERT_IN_CHAIN',['tls',false]],['UNABLE_TO_VERIFY_LEAF_SIGNATURE',['tls',false]],
 ['ERR_TLS_CERT_ALTNAME_INVALID',['tls',false]],['ERR_TLS_CERT_SIGNATURE_ALGORITHM_UNSUPPORTED',['tls',false]]
]);
export function transportError(error){
 const queue=[error],seen=new Set(),found=[];
 while(queue.length&&seen.size<12){const e=queue.shift();if(!e||typeof e!=='object'||seen.has(e))continue;seen.add(e);
  if(codes.has(e.code)&&!found.includes(e.code))found.push(e.code);
  if(e.cause)queue.push(e.cause);if(Array.isArray(e.errors))queue.push(...e.errors.slice(0,6));
 }
 const entries=found.map(code=>codes.get(code));
 const timedOut=entries.some(([kind])=>kind==='timeout')||['TimeoutError','AbortError'].includes(error?.name);
 const permanent=entries.find(([,retryable])=>!retryable);
 return {kind:permanent?.[0]||(timedOut?'timeout':entries[0]?.[0]||'unknown'),codes:found,retryable:!permanent,timedOut};
}
