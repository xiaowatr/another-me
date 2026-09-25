// Shared new-submission validation. Historical records remain readable.
export function eventDate(b){
 const date=text=>{const m=String(text||'').replace(/(?:观察|只看|只写)[：:]?\s*(?:18|19|20|21)\d{2}年\d{1,2}(?:月)?(?:—|–|-|至|到|和)\d{1,2}月/g,'').match(/((?:18|19|20|21)\d{2})年(?:(\d{1,2})月)?/);return m?{year:+m[1],month:m[2]?+m[2]:null}:null;};
 return date(b.hypotheticalDirection)||date(b.realityOutcome);
}
export function ageFieldErrors(b,year=new Date().getFullYear()){
 const errors={},birth=String(b.birthYear??''),age=String(b.forkAge??'');
 if(!/^\d{4}$/.test(birth)||+birth<1850||+birth>year)errors.birthYear='请填写四位出生年份（1850年至今）。';
 if(!/^\d{1,3}$/.test(age)||+age>120)errors.forkAge='请填写0—120之间的整数年龄；记不清可填大概数字。';
 const date=eventDate(b);
 if(!Object.keys(errors).length&&date&&![date.year-Number(birth),date.year-Number(birth)-1].includes(+age))errors.forkAge='事件年份与出生年份、当时年龄对不上，请核对修改（已考虑生日带来的一岁差异）。';
 return errors;
}
