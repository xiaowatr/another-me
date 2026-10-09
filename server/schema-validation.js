// Validator for the JSON Schema keywords used by our provider tools.
// Unsupported keywords fail closed, so new schema rules cannot silently go unchecked.
const keywords=new Set(['type','properties','required','additionalProperties','items','minItems','maxItems','minLength','maxLength','enum','anyOf','description']);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const pointer=(base,key)=>base+'/'+String(key).replace(/~/g,'~0').replace(/\//g,'~1');
export function validateSchema(schema,value,at=''){
 const errors=[],add=(path,keyword)=>errors.push({path,keyword});
 for(const key of Object.keys(schema))if(!keywords.has(key))throw Error('Unsupported schema keyword: '+key);
 if(schema.anyOf){if(!schema.anyOf.some(s=>validateSchema(s,value,at).length===0))add(at,'anyOf');return errors;}
 if(schema.type&&!({object:object(value),array:Array.isArray(value),string:typeof value==='string',null:value===null}[schema.type])){add(at,'type');return errors;}
 if(schema.enum&&!schema.enum.some(x=>JSON.stringify(x)===JSON.stringify(value)))add(at,'enum');
 if(typeof value==='string'){const length=[...value].length;if(schema.minLength!=null&&length<schema.minLength)add(at,'minLength');if(schema.maxLength!=null&&length>schema.maxLength)add(at,'maxLength');}
 if(Array.isArray(value)){if(schema.minItems!=null&&value.length<schema.minItems)add(at,'minItems');if(schema.maxItems!=null&&value.length>schema.maxItems)add(at,'maxItems');if(schema.items)value.forEach((x,i)=>errors.push(...validateSchema(schema.items,x,pointer(at,i))));}
 if(object(value)){for(const key of schema.required||[])if(!Object.hasOwn(value,key))add(pointer(at,key),'required');for(const [key,x]of Object.entries(value)){const child=Object.hasOwn(schema.properties||{},key)?schema.properties[key]:null;if(child)errors.push(...validateSchema(child,x,pointer(at,key)));else if(schema.additionalProperties===false)add(pointer(at,key),'additionalProperties');}}
 return errors;
}
