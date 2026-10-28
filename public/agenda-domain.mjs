import {metrics,round,date,dailyValuations} from './domain.mjs';
import {addDays} from './planning.mjs';
export function agendaRows(project,reports,on){
 date(on);const accumulated=metrics(project,reports,'9999-12-31'),atDate=metrics(project,reports,on),before=metrics(project,reports,addDays(on,-1)),confirmed=reports.filter(r=>r.projectId===project.id&&r.date===on&&r.status==='confirmed'),drafts=reports.filter(r=>r.projectId===project.id&&r.date===on&&r.status==='draft'),values=dailyValuations(project,reports,on);
 return project.items.map(item=>{
  const mapping=project.mappings?.find(m=>m.code===item.code),task=project.tasks?.find(t=>t.id===mapping?.taskId),hours=task?.days?.filter(d=>d.date===on).reduce((n,d)=>n+d.hours,0)||0,total=task?.days?.reduce((n,d)=>n+d.hours,0)||0,plannedQuantity=total?item.quantity*hours/total:0;
  const executed=accumulated.items.find(i=>i.code===item.code)?.executed||0,previous=before.items.find(i=>i.code===item.code)?.executed||0,dayQuantity=confirmed.reduce((n,r)=>n+r.items.filter(i=>i.code===item.code).reduce((s,i)=>s+i.quantity,0),0);
  const dayValue=round(confirmed.reduce((n,r)=>n+(values.get(r.id)?.lines.find(i=>i.code===item.code)?.value||0),0));
  const cutoffExecuted=atDate.items.find(i=>i.code===item.code)?.executed||0,draftQuantity=drafts.reduce((n,r)=>n+r.items.filter(i=>i.code===item.code).reduce((s,i)=>s+i.quantity,0),0),lastReport=reports.filter(r=>r.projectId===project.id&&r.status==='confirmed'&&r.date<=on&&r.items.some(i=>i.code===item.code)).sort((a,b)=>b.date.localeCompare(a.date))[0];
  return {...item,task,plannedQuantity,plannedValue:plannedQuantity*item.price,previous,executed,cutoffExecuted,progress:cutoffExecuted/item.quantity*100,draftQuantity,registeredToday:dayQuantity+draftQuantity,lastDate:lastReport?.date||null,dayQuantity,dayValue,remaining:Math.max(0,item.quantity-executed),backlog:!!task&&task.finish<on&&cutoffExecuted<item.quantity-1e-8,scheduled:hours>0};
 });
}
export function plannedDates(project){const dates=new Set(),linked=new Set((project.mappings||[]).map(m=>m.taskId));for(const t of project.tasks||[])if(linked.has(t.id))for(const d of t.days||[])if(d.hours>0)dates.add(d.date);return dates;}
export function agendaInput(rows,entries,reason=''){
 const items=[];let offSchedule=false;for(const row of rows){const value=entries[row.code];if(value===''||value===undefined)continue;const quantity=Number(value);if(!Number.isFinite(quantity)||quantity<0)throw new Error(`Revisa el metrado de ${row.code}.`);if(!quantity)continue;if(quantity>row.remaining+1e-8)throw new Error(`El avance de ${row.code} supera el saldo de ${row.remaining} ${row.unit}.`);items.push({code:row.code,quantity});if(!row.scheduled)offSchedule=true;}
 if(offSchedule&&!reason.trim())throw new Error('Explica el motivo del avance fuera de la fecha programada.');
 return {items,offScheduleReason:offSchedule?reason.trim():''};
}
