// A new story's first message makes no claim about events, time or location.
// Archived stories and existing chat histories are not rewritten.
export const FIXED_OPENING='想跟你聊聊这段日子。';
export function fillStoryOpening(story){return {...story,opening:FIXED_OPENING};}
