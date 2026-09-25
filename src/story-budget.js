// Budget is per story operation, shared across retries and clarification continuations.
export const STORY_MAX_REWRITES=2;
export const STORY_MAX_MODEL_CALLS=3;
export function retryableStoryFailure(error){return ['invalid_response','background_conflict'].includes(error.category)||(error.terminal&&['upstream','timeout'].includes(error.category));}
