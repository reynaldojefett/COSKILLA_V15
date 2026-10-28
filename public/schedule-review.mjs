import {date,num,text,fail} from './domain.mjs';
import {addDays,dayCount} from './planning.mjs';
export const weekDays={weekdays:[1,2,3,4,5],saturday:[1,2,3,4,5,6],daily:[0,1,2,3,4,5,6]};
export function workingDates(start,finish,week){
 if(!weekDays[week])fail('Selecciona un calendario válido.');date(start);date(finish);
 if(finish<start||dayCount(start,finish)>3660)fail('Revisa inicio y fin: el plazo debe ser positivo y no superar diez años.');
 const days=[];for(let d=start;d<=finish;d=addDays(d,1))if(weekDays[week].includes(new Date(d+'T12:00:00Z').getUTCDay()))days.push(d);
 return days;
}
export function checkedTaskDates(tasks,values=[]){
 if(!Array.isArray(values)||values.length>2000)fail('Lista de ajustes de fechas inválida.');const seen=new Set();
 return values.map(v=>{
  const task=tasks.find(t=>t.id===v.taskId);if(!task||task.summary||seen.has(v.taskId))fail('Selecciona una actividad de ejecución válida para ajustar sus fechas.');if(task.milestone&&v.convertMilestone!==true)fail('El registro es un hito. Confirma expresamente su uso como actividad de seguimiento o corrige su duración en el programa de origen.');seen.add(v.taskId);
  const start=date(v.start),finish=date(v.finish),hours=num(v.hours,'Horas por día',.01,24),week=v.week;
  if(!workingDates(start,finish,week).length)fail('Las fechas elegidas no incluyen ningún día laborable de ese calendario.');
  if(v.reviewed!==true)fail('Revisa y acepta el ajuste tentativo antes de usarlo para el seguimiento.');
  return {taskId:v.taskId,start,finish,week,hours,reason:text(v.reason,'Motivo del ajuste',1000),reviewed:true,tentative:true,convertMilestone:!!task.milestone&&v.convertMilestone===true};
 });
}
export function applyTaskDates(tasks,values=[]){const edits=checkedTaskDates(tasks,values);return tasks.map(t=>{
 const edit=edits.find(e=>e.taskId===t.id);if(!edit)return t;
 return {...t,sourceDays:t.sourceDays||t.days,criticalReviewRequired:true,sourceMilestone:t.sourceMilestone??!!t.milestone,milestone:edit.convertMilestone?false:!!t.milestone,originalStart:t.originalStart||t.start,originalFinish:t.originalFinish||t.finish,start:edit.start,finish:edit.finish,days:workingDates(edit.start,edit.finish,edit.week).map(date=>({date,hours:edit.hours})),dateAdjustment:edit,calendarSource:'Ajuste de fechas y calendario declarado para seguimiento; pendiente de verificar en el programa de origen'};
 });}
export function dateWarnings(task,tasks){
 const warnings=[];for(const link of task.predecessors||[]){const pred=tasks.find(t=>t.id===link.id);if(!pred)continue;
  if(link.type==='FINISH_START'&&task.start<pred.finish)warnings.push(`El inicio es anterior al fin de su predecesora ${pred.wbs||pred.id} (${pred.finish}). Revisa el vínculo fin-inicio en tu programa.`);
  if(Number(link.lagValue||0)!==0)warnings.push(`El vínculo con ${pred.wbs||pred.id} tiene desfase ${link.lag||''}. Verifica su efecto en MS Project/P6.`);
 }
 return warnings;
}
export function proposeTaskDates(project,task,tasks,{week='weekdays',hours=8,convertMilestone=false}={}){
 if(task.summary)fail('Selecciona una actividad de ejecución, no un resumen.');if(task.milestone&&!convertMilestone)fail('Este registro es un hito. Corrige su duración en el programa o marca expresamente que lo usarás como actividad de seguimiento.');
 hours=num(hours,'Horas por día',.01,24);
 const originalDays=(task.days||[]).filter(d=>d.hours>0).length;
 const duration=originalDays||Math.max(1,task.finish>=task.start?workingDates(task.start,task.finish,week).length:1);
 let earliest=project.start;const caveats=[];
 for(const link of task.predecessors||[]){const pred=tasks.find(t=>t.id===link.id);if(!pred)continue;
  if(link.type==='FINISH_START'){const after=addDays(pred.finish,1);if(after>earliest)earliest=after;}
  if(link.type!=='FINISH_START'||Number(link.lagValue||0)!==0)caveats.push('Hay vínculos o desfases que deben comprobarse en el programa de origen.');
 }
 const available=earliest<=project.end?workingDates(earliest,project.end,week):[];
 if(available.length<duration)return {possible:false,duration,reason:`Las ${duration} jornadas no caben entre ${earliest} y ${project.end} con ese calendario. Revisa el plazo, la duración y las predecesoras en MS Project/P6; no se comprimirá la actividad automáticamente.`};
 let index=available.findIndex(d=>d>=task.start);if(index<0)index=available.length-duration;index=Math.max(0,Math.min(index,available.length-duration));
 return {possible:true,start:available[index],finish:available[index+duration-1],week,hours,duration,reason:`Propuesta tentativa: ${task.milestone?'referencia inicial de':'conservar'} ${duration} jornadas y ubicar la actividad dentro del plazo con el calendario elegido. Verificar duración, vínculos, recursos y frentes en el programa de origen.`,caveats:[...new Set(caveats)],basis:task.milestone?'El origen es un hito: estas jornadas son una referencia inicial de revisión; define su duración real según el rendimiento y el alcance.':originalDays?'Jornadas con horas del programa':'Jornadas estimadas a partir de las fechas y el calendario elegido; sin datos de rendimiento'};
}
