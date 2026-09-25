import {createHash} from 'node:crypto';
export const CODE_VERSION='2026-09-25.v64-local';
export function diagnosticRange(temporal){const w=temporal?.window;return w?{months:w.months,anchor:w.anchor,start:w.start,end:w.end,precision:w.precision}:null;}
export function takeDiagnosticCase(background,env=process.env){const id=env.DIAGNOSTIC_CASE_ID||'',expires=Date.parse(env.DIAGNOSTIC_CASE_EXPIRES_AT||'');if(!/^[a-f0-9-]{36}$/.test(id)||!Number.isFinite(expires)||expires<=Date.now()||expires>Date.now()+86400000)return null;return String(background.details||'').includes('[诊断:'+id+']')?id:null;}
export function redactEvidence(text,key){let s=String(text||'');if(key)s=s.split(key).join('[已隐藏密钥]');return s.replace(/Bearer\s+\S+/gi,'Bearer [已隐藏]').replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[已隐藏邮箱]').replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g,'[已隐藏手机号]');}
export function outputFingerprint(text){return {length:text.length,sha256:createHash('sha256').update(text).digest('hex')};}

