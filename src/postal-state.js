export function lifeRecency(l){return Math.max(0,...[l.lastVisitedAt,l.sessionMeta?.lastVisitedAt,l.sessionMeta?.lastChatAt,l.createdAt].map(v=>Date.parse(v)||0));}
export function sortedLives(lives){return lives.map((life,index)=>({life,index})).sort((a,b)=>lifeRecency(b.life)-lifeRecency(a.life)||a.index-b.index).map(x=>x.life);}
