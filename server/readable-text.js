import {Converter} from 'opencc-js';
const simplify=Converter({from:'tw',to:'cn'});
// New model output only; never rewrite stored stories or user text.
export const readableText=text=>simplify(text).replaceAll('分岔后','那次选择之后').replaceAll('分岔口','选择面前').replaceAll('分岔的起点','那次决定');
export function readableResult(value){if(typeof value==='string')return readableText(value);if(Array.isArray(value))return value.map(readableResult);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,readableResult(v)]));return value;}
