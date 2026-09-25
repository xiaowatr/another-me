import {safeOpeningAddress} from './participant-identity.js';
﻿import {roleGender} from './input-anchors.js';
// Remove only standalone self-metadata fragments, not other people's pronouns or user text.
export function rolePresentation(text,background={}){if(roleGender(background))return text;return String(text||'').replace(/^(?:姐|哥|姑娘|小伙子)[，,、！! ]+/, '').replace(/你(?:这个|这位)(?:姑娘|小伙子|男孩|女孩)/g,'你').replace(/我(?:这个|这位)(?:姑娘|小伙子|男孩|女孩)/g,'我').replace(/(^|[。！？\n；·|，])\s*(?:(?:我的)?性别[：:]?\s*(?:未知|未填写|不详)|(?:我的)?性别(?:在这里)?(?:并)?不重要)\s*(?=$|[。！？\n；·|，])/g,'$1').replace(/([·|，；])\s*(?=[·|，；]|$)/g,'').replace(/^[\s·|，；。]+|[\s·|，；]+$/g,'').trim();}
export function presentNewStory(story,b){return Object.fromEntries(Object.entries(story).map(([k,v])=>[k,typeof v==='string'?rolePresentation(k==='opening'?safeOpeningAddress(v,b):v,b):k==='scenes'?v.map(scene=>Object.fromEntries(Object.entries(scene).map(([key,text])=>[key,rolePresentation(text,b)]))):v]));}
