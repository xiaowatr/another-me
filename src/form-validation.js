import {ageFieldErrors} from './age-validation.js';
﻿import {coordinates} from './context.js';
export const requiredBackgroundFields=['birthYear','forkAge','realityOutcome','hypotheticalDirection','locationText','gender'];
export function formError(b){const ageError=Object.values(ageFieldErrors(b))[0];if(ageError)return ageError;if(requiredBackgroundFields.some(k=>!b[k]?.trim()))return '请填写“故事起点”中的内容。不确定、记不清或不愿透露时，可以直接说明。';return null;}
