export function questionMeaning(q,meta){
 if(q.id==='G08'&&!meta?.answerKind)return {answerKind:'creative_preference',purpose:'旧G08询问希望保留的小习惯；只作为平行创作偏好，不确认现实用户真实拥有该习惯'};
 return {answerKind:meta?.answerKind||q.answerKind||'user_answer',purpose:q.purpose};
}
