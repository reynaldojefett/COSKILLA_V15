export const normalized=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/([0-9])([a-z])/g,'$1 $2').replace(/([a-z])([0-9])/g,'$1 $2').replace(/[^a-z0-9]+/g,' ').trim();
const sameDescription=(a,b)=>normalized(a).replace(/\s/g,'')===normalized(b).replace(/\s/g,'');
const chapterWords=s=>normalized(String(s||'').replace(/\([^)]*\)/g,'')).split(' ').filter(w=>w.length>2&&!['reparacion','mayor','menor','mantenimiento','conservacion','tipo','del','las','los','una','und','unidades'].includes(w)&&!/^\d+$/.test(w)).join(' ');
export const normalizedCode=s=>String(s??'').trim().toUpperCase().replace(/\s+/g,'').replace(/\.+$/,'');
function similarity(a,b){const aa=normalized(a),bb=normalized(b);if(aa===bb)return 1;const words=new Set(aa.split(' ').filter(w=>w.length>1)),other=new Set(bb.split(' ').filter(w=>w.length>1)),same=[...words].filter(w=>other.has(w)).length;return 2*same/(words.size+other.size||1);}
export function rankedTasks(item,tasks,{includeMilestones=false}={}){return tasks.filter(t=>!t.summary&&(includeMilestones||!t.milestone)).map(task=>{
 const explicit=[task.budgetCode,task.activityId].some(c=>c&&normalizedCode(c)===normalizedCode(item.code));
 const numbers=s=>(String(s).normalize('NFKC').match(/\d+(?:[.,]\d+)?/g)||[]).sort().join('|'),a=numbers(item.description),b=numbers(task.name),numericConflict=!!a&&!!b&&a!==b;
 const exact=sameDescription(item.description,task.name),parents=String(task.parent||'').split('/').map(p=>p.trim()).filter(Boolean),chapter=chapterWords(item.chapter),context=chapter?Math.max(0,...parents.map(p=>similarity(chapter,chapterWords(p)))):0;
 return {task,score:explicit?2:((exact?1:similarity(item.description,task.name))+context*.18)*(numericConflict?.5:1),explicit,exact,context};
 }).filter(c=>c.score>=.2).sort((a,b)=>b.score-a.score||a.task.name.localeCompare(b.task.name)).slice(0,5);}
export function proposeLinks(items,tasks){return items.map(item=>{
 const ranked=rankedTasks(item,tasks),[best,next]=ranked;
 const duplicateCode=best?.explicit&&next?.explicit;
 const certain=best&&!duplicateCode&&(best.explicit||(best.exact&&(!next?.exact||best.score-next.score>.08))||(!best.exact&&best.score>=.78&&(!next||best.score-next.score>=.14)));
 return {code:item.code,taskId:certain?best.task.id:'',suggested:true,method:certain?(best.explicit?'code':best.exact?'description':'similarity'):'manual',reason:duplicateCode?'Código repetido en el programa':certain?'Revisar equivalencia y fechas':'Requiere selección del responsable'};
 });}
export function hydrateChapters(items,rows=[]){let chapter='';const chapters=new Map();for(const row of rows){if(row.type==='heading'&&row.description.length<130)chapter=row.description;if(row.eligible)chapters.set(row.code,chapter);}return items.map(i=>({...i,chapter:i.chapter||chapters.get(i.code)||''}));}
export function relationStatus(project,item,task,tasks=[]){
 if(!item.unit?.trim())return {kind:'heading',blocking:false,label:'Título del presupuesto',help:'Se conserva en la tabla. La relación se realiza en las partidas que tienen unidad.'};
 if(!task)return {kind:'missing',blocking:true,label:'Elige una actividad',help:'Busca por nombre o código, revisa las sugerencias o agrega la actividad que falta en tu programa. También puedes descargar el Excel con las partidas de este presupuesto y completar sus fechas.'};
 if(task.summary)return {kind:'summary',blocking:true,label:'Selecciona una actividad de ejecución',help:'Esta tarea agrupa otras actividades. Selecciona una actividad hija con fechas y trabajo programado.'};
 if(task.milestone)return {kind:'milestone',blocking:true,label:'Este registro es un hito',help:'Un hito no aporta por sí solo la duración de trabajo. Si este registro representa ejecución de obra, corrige su duración en el programa o abre el ajuste de fechas y confirma expresamente su uso como actividad de seguimiento.'};
 if(task.finish<task.start)return {kind:'dates',blocking:true,label:'Inicio y fin están invertidos',help:'El fin de esta actividad es anterior al inicio. Abre Revisar o ajustar fechas y solicita una propuesta tentativa, o corrige el programa de origen.'};
 if(!task.days?.some(d=>d.hours>0))return {kind:'calendar',blocking:true,label:task.calendarOverride?'Actividad en día no laborable':'Revisar calendario de la tarea',help:task.calendarOverride?`Las fechas ${task.start} a ${task.finish} no incluyen días del calendario que elegiste. Si la obra trabaja en esos días, corrige el calendario declarado; si no, corrige las fechas en el programa. No se mueve la actividad automáticamente.`:'La tarea no tiene horas laborables. Define un calendario de seguimiento arriba o corrige su calendario e inicio y fin en Project/Primavera; luego actualiza la lectura. Un hito sin trabajo no sustituye una partida de ejecución.'};
 if(task.start<project.start||task.finish>project.end)return {kind:'dates',blocking:true,label:'Fechas fuera del plazo de la obra',help:`La actividad va de ${task.start} a ${task.finish}. Corrige el inicio/duración en la ficha o selecciona una programación compatible. El botón «Copiar fechas del programa» puede ayudarte.`};
 if([task.budgetCode,task.activityId].some(c=>c&&normalizedCode(c)===normalizedCode(item.code)))return {kind:'code',blocking:false,label:'Mismo código de partida',help:'El código coincide. Revisa que el alcance, el capítulo y las fechas también correspondan.'};
 const exact=sameDescription(item.description,task.name),duplicates=tasks.filter(t=>!t.summary&&sameDescription(t.name,task.name)).length>1;
 if(duplicates)return {kind:'context',blocking:false,label:'Revisar el capítulo de la tarea',help:`Hay nombres repetidos. Verifica que «${task.parent||'actividad sin capítulo'}» corresponde a esta partida antes de confirmar.`};
 return {kind:exact?'matched':'review',blocking:false,label:exact?'Relación encontrada':'Revisar equivalencia',help:exact?'Comprueba las fechas y el capítulo antes de aplicar la línea base.':'Las descripciones son diferentes. Compara el alcance y el capítulo; puedes cambiar la tarea si no corresponde.'};
}
export function budgetRows(parsed){return parsed?.rows?.length?parsed.rows:(parsed?.items||[]).map(i=>({...i,rowId:`${i.sourceSheet||'presupuesto'}:${i.sourceRow||i.code}`,type:'item',eligible:!!i.unit,partial:i.sourceAmount??null,subtotal:null}));}
