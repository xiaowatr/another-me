import {coordinates} from './context.js';
export const requiredBackgroundFields=['realityOutcome','hypotheticalDirection','locationText','gender','mbti'];
export function formError(b){if(requiredBackgroundFields.some(k=>!b[k]?.trim()))return '请填写标 * 的内容。不确定、记不清或不愿透露时，可以直接说明。';return null;}
