// New auxiliary fields are derived once; stored stories are never rewritten.
export function fillStoryMetadata(story,setting){
 const identity=setting?.fixedDisplay?.identity||story.identity||'另一个自己',scenes=story.scenes||['chapter1','chapter2','chapter3'].map(k=>story[k]).filter(Boolean);
 const parts=[identity+'。'];let size=parts[0].length;
 for(const scene of scenes){const paragraph=String(scene.text||'').split(/\n\s*\n/)[0].trim();if(paragraph&&size+paragraph.length+2<=1900){parts.push(paragraph);size+=paragraph.length+2;}}
 return {...story,synopsis:story.intro,character:parts.join('\n\n')};
}
