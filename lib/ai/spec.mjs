import {format,isKpiRef} from './facts.mjs';
// Contrato entre la IA y los generadores. La IA solo elige y redacta; las cifras se resuelven aquí desde el motor.
const str={type:'string'},nstr={type:['string','null']};
const obj=(properties)=>({type:'object',additionalProperties:false,required:Object.keys(properties),properties});
export const WIDGET_TYPES=['kpi','curve','priority_items','alerts','census','daily','materials','resources'];
export const specSchema=obj({
 headline:str,summary:str,
 sections:{type:'array',items:obj({title:str,body:str,tone:{type:'string',enum:['ok','info','warning','danger']}})},
 widgets:{type:'array',items:obj({type:{type:'string',enum:WIDGET_TYPES},title:str,metric:nstr,curve:{type:['string','null'],enum:['physical','financial',null]},itemCodes:{type:['array','null'],items:str}})},
 recommendations:{type:'array',items:obj({text:str,alertKey:nstr})}
});
const LIMIT={headline:160,summary:1500,sectionTitle:80,sectionBody:800,recommendation:350,widgetTitle:80,sections:5,widgets:8,recommendations:5,itemCodes:8};
export const PLACEHOLDER=/\{\{\s*([^{}\s][^{}]*?)\s*\}\}/g;
export function validateSpec(spec,facts){
 const v=[],reg=facts.registry,codes=new Set(facts.priority.map(i=>i.code)),alertKeys=new Set(facts.alerts.map(a=>a.key));
 const clean={headline:'',summary:'',sections:[],widgets:[],recommendations:[]};
 if(!spec||typeof spec!=='object'){return {violations:['La respuesta no es un objeto.'],clean};}
 const check=(value,label,max)=>{
  if(typeof value!=='string'||!value.trim()){v.push(`${label}: está vacío.`);return '';}
  const s=value.trim();if(s.length>max)v.push(`${label}: supera ${max} caracteres.`);
  for(const m of s.matchAll(PLACEHOLDER))if(!reg.has(m[1].trim()))v.push(`${label}: el marcador {{${m[1].trim()}}} no existe en refs.`);
  if(/\d/.test(s.replace(PLACEHOLDER,'')))v.push(`${label}: contiene cifras escritas directamente; usa marcadores {{ref}}.`);
  return s;
 };
 clean.headline=check(spec.headline,'headline',LIMIT.headline);clean.summary=check(spec.summary,'summary',LIMIT.summary);
 const list=(name,max)=>{if(!Array.isArray(spec[name])){v.push(`${name}: debe ser una lista.`);return [];}if(spec[name].length>max)v.push(`${name}: máximo ${max} elementos.`);return spec[name].slice(0,max);};
 for(const [n,s]of list('sections',LIMIT.sections).entries()){clean.sections.push({title:check(s?.title,`sections[${n}].title`,LIMIT.sectionTitle),body:check(s?.body,`sections[${n}].body`,LIMIT.sectionBody),tone:['ok','info','warning','danger'].includes(s?.tone)?s.tone:'info'});}
 for(const [n,w]of list('widgets',LIMIT.widgets).entries()){
  const label=`widgets[${n}]`,item={type:w?.type,title:check(w?.title,label+'.title',LIMIT.widgetTitle)};
  if(!WIDGET_TYPES.includes(w?.type))v.push(`${label}: tipo no permitido.`);
  if(w?.type==='kpi'){if(!isKpiRef(reg,w.metric))v.push(`${label}: metric debe ser una cifra de refs (no texto ni fecha).`);item.metric=w.metric;}
  if(w?.type==='curve'){if(!['physical','financial'].includes(w.curve))v.push(`${label}: curve debe ser physical o financial.`);item.curve=w.curve;}
  if(w?.type==='priority_items'){const list=Array.isArray(w.itemCodes)?w.itemCodes:[];if(!list.length||list.length>LIMIT.itemCodes||list.some(c=>!codes.has(c)))v.push(`${label}: itemCodes debe tener de 1 a ${LIMIT.itemCodes} códigos de codigosDisponibles.`);item.itemCodes=list.filter(c=>codes.has(c));}
  clean.widgets.push(item);
 }
 for(const [n,x]of list('recommendations',LIMIT.recommendations).entries()){
  if(x?.alertKey&&!alertKeys.has(x.alertKey))v.push(`recommendations[${n}].alertKey no coincide con ninguna alerta.`);
  clean.recommendations.push({text:check(x?.text,`recommendations[${n}].text`,LIMIT.recommendation),alertKey:alertKeys.has(x?.alertKey)?x.alertKey:null});
 }
 return {violations:v,clean};
}
export const resolveText=(text,registry)=>text.replace(PLACEHOLDER,(_,ref)=>format(registry.get(ref.trim())));
export function resolveSpec(clean,facts,cutoff){
 const reg=facts.registry,t=s=>resolveText(s,reg);
 const widgets=clean.widgets.map(w=>{
  if(w.type==='kpi')return {type:'kpi',title:t(w.title),ref:w.metric,value:format(reg.get(w.metric))};
  if(w.type==='curve')return {type:'curve',title:t(w.title),curve:w.curve};
  if(w.type==='priority_items')return {type:'priority_items',title:t(w.title),rows:w.itemCodes.map(code=>{const i=facts.priority.find(x=>x.code===code),f=s=>format(reg.get(`item:${code}${s}`));return {code,description:i.description,progress:f('.progress'),planned:f('.planned'),gap:f('.gap'),deficit:f('.deficit')};})};
  if(w.type==='alerts')return {type:'alerts',title:t(w.title),alerts:facts.alerts.slice(0,8)};
  if(['daily','materials','resources'].includes(w.type))return {type:w.type,title:t(w.title)};
  return {type:'census',title:t(w.title),...facts.census,total:facts.census.complete+facts.census.active+facts.census.empty};
 });
 return {cutoff,headline:t(clean.headline),summary:t(clean.summary),sections:clean.sections.map(s=>({title:t(s.title),body:t(s.body),tone:s.tone})),widgets,recommendations:clean.recommendations.map(r=>({text:t(r.text),alert:r.alertKey?{key:r.alertKey,title:facts.alerts.find(a=>a.key===r.alertKey).title}:null}))};
}
