export const MBTI_TYPES=['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'];
export const ACTIVE_FIELDS=['lifeSituation','choiceReason','realityOutcome','hypotheticalDirection','birthYear','forkAge','gender','locationText','mbti','details','followupKey','followupQuestion','followupAnswer','followupSkipped'];
export function activeBackground(b={}){const result=Object.fromEntries(ACTIVE_FIELDS.map(k=>[k,typeof b[k]==='string'?b[k]:'']));result.inputVersion='6';return result;}
export function migrateBackground(b={}){
 const source={...b};
 if(!Object.hasOwn(b,'realityOutcome'))source.realityOutcome=b.eventContext||b.choice||'';
 if(!Object.hasOwn(b,'hypotheticalDirection'))source.hypotheticalDirection=b.alternative||'';
 if(!Object.hasOwn(b,'locationText'))source.locationText=b.cityMode==='specific'?b.city||'':b.cityMode==='type'?b.cityType||'':'';
 return activeBackground(source);
}
export function retiredBackground(b={}){return Object.fromEntries(Object.entries(b).filter(([k,v])=>!ACTIVE_FIELDS.includes(k)&&k!=='inputVersion'&&v!==''&&v!=null));}
