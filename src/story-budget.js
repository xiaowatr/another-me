// Generation and each review stage have independent per-operation budgets.
export const STORY_MAX_REWRITES=3;
export const STORY_MAX_MODEL_CALLS=4;
export const STORY_MAX_REVIEW_CALLS=4;
export const STORY_MAX_TOTAL_CALLS=12;
export const storyCallCount=s=>s.storyCallCount??s.cumulativeCallCount??0;
export function retryableStoryFailure(error){return ['invalid_response','background_conflict'].includes(error.category)||(error.terminal&&['upstream','timeout'].includes(error.category));}
