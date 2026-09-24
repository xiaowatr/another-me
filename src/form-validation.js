import {coordinates} from './context.js';
export const requiredBackgroundFields=['realityOutcome','hypotheticalDirection','locationText','gender','mbti','choiceReason','details'];
export function formError(b){if(requiredBackgroundFields.some(k=>!b[k]?.trim()))return '请填写标 * 的内容。不确定、记不清或不愿透露时，可以直接说明。';const c=coordinates(b);if(!b.birthYear&&!b.forkAge)return '请补充出生年份或当时年龄；已有事件年份时，另一项无需重复填写。';if(!c.forkYear)return '请补充当时年龄或在事件中说明年份，以确定故事起点。';return null;}
