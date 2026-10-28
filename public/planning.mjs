import {financeValue,financePlan} from './finance.mjs';
import {date,text,num,fail,validateProject,metrics,round,today} from './domain.mjs';
import {projectProfile} from './project-profile.mjs';
export const addDays=(day,n)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export const dayCount=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/86400000)+1;
export const ready=p=>!!p&&p.configStatus!=='setup'&&p.items?.length>0&&p.schedule?.length>1;
export function basics(input){
 const duration=num(input.duration,'Duración en días calendario',1,3660);if(!Number.isInteger(duration))fail('La duración debe ser un número entero de días calendario.');
 const start=date(input.start),district=text(input.district,'Distrito',200),province=text(input.province,'Provincia',100),department=text(input.department,'Departamento',100);
 return {name:text(input.name,'Nombre de obra',900),cui:text(input.cui||'','CUI',40,false),district,province,department,location:`${district}, ${province}, ${department}`,start,duration,end:addDays(start,duration-1),practice:input.practice===true||input.practice==='on',...projectProfile(input)};
}
export function validItems(items){return validateProject({name:'Validación',start:'2020-01-01',end:'2020-01-02',items,schedule:[{date:'2020-01-01',physical:0,financial:0},{date:'2020-01-02',physical:100,financial:100}]}).items;}
export function buildDaily(project,items,tasks,mappings){
 const leaves=tasks.filter(t=>!t.summary&&!t.milestone),byId=new Map(leaves.map(t=>[t.id,t]));
 const links=items.map(i=>{const link=mappings.find(m=>m.code===i.code),task=byId.get(link?.taskId);if(!task)fail(`Selecciona una tarea para la partida ${i.code}.`);if(task.start<project.start||task.finish>project.end)fail(`La tarea ${task.name} (${task.start} a ${task.finish}) está fuera del plazo de la ficha. Corrige la ficha o utiliza un programa compatible.`);if(!task.days?.length)fail(`La tarea ${task.name} no tiene horas laborables. Revisa hitos y calendario en el programa.`);const total=task.days.reduce((s,d)=>s+num(d.hours,'Horas laborables',0,24),0);if(!total)fail(`La tarea ${task.name} no tiene horas laborables positivas.`);return {code:i.code,taskId:task.id,task,total};});
 const budget=round(items.reduce((s,i)=>s+round(i.quantity*i.price),0)),fractions=new Map();
 const schedule=[];for(let d=addDays(project.start,-1);d<=project.end;d=addDays(d,1)){
  let physical=0,financial=0;for(const [n,i]of items.entries()){const l=links[n],part=l.task.days.filter(v=>v.date<=d).reduce((s,v)=>s+v.hours,0)/l.total;physical+=part*i.weight;financial+=part*round(i.quantity*i.price)/budget*100;fractions.set(i.code,part);}
  schedule.push({date:d,physical:Math.min(100,physical),financial:Math.min(100,financial)});
 }
 return {schedule,mappings:links.map(l=>({code:l.code,taskId:l.taskId})),method:'Reparto uniforme del presupuesto y peso físico de cada partida entre las horas laborables de su tarea vinculada. No reproduce curvas de recursos ni costos nativos de Project/P6.'};
}
export function directPlanAt(p,on){if(!p.schedule?.length)return {physical:0,financial:0};if(on<p.schedule[0].date)return {physical:0,financial:0};let previous=p.schedule[0];for(const r of p.schedule){if(r.date>on){const t=(Date.parse(on)-Date.parse(previous.date))/(Date.parse(r.date)-Date.parse(previous.date));return {physical:previous.physical+(r.physical-previous.physical)*t,financial:previous.financial+(r.financial-previous.financial)*t};}previous=r;}return {physical:previous.physical,financial:previous.financial};}
export function planAt(p,on){const v=directPlanAt(p,on);return {...v,directFinancial:v.financial,financial:financePlan(p,v.financial,on)};}
export function dailyCurve(p,reports,cutoff=today()){
 const result=[],end=p.end;let previousActual={physical:0,financial:0},previousPlan=planAt(p,addDays(p.start,-1));
 // Incremental accumulation avoids recalculating every report for every day.
 const confirmed=reports.filter(r=>r.projectId===p.id&&r.status==='confirmed'&&r.date<=cutoff),byDate=new Map(),amounts=new Map(p.items.map(i=>[i.code,0]));
 for(const r of confirmed){const list=byDate.get(r.date)||[];list.push(r);byDate.set(r.date,list);}
 const budget=round(p.items.reduce((s,i)=>s+round(i.quantity*i.price),0));
 result.push({date:addDays(p.start,-1),...previousPlan,actualPhysical:p.start<=cutoff?0:null,actualFinancial:p.start<=cutoff?0:null,actualDirectValue:p.start<=cutoff?0:null,actualTotalValue:p.start<=cutoff?0:null,dailyPhysical:0,dailyFinancial:0,dailyActualPhysical:0,dailyActualFinancial:0});
 for(let d=p.start;d<=end;d=addDays(d,1)){
  for(const r of byDate.get(d)||[])for(const i of r.items)amounts.set(i.code,(amounts.get(i.code)||0)+i.quantity);
  const plan=planAt(p,d);let physical=0,value=0;for(const i of p.items){const executed=amounts.get(i.code)||0;physical+=executed/i.quantity*i.weight;value+=round(executed*i.price);}
  const fin=financeValue(p,round(value),d),actual={physical,financial:fin.percent};
  result.push({date:d,...plan,actualPhysical:d<=cutoff?physical:null,actualFinancial:d<=cutoff?actual.financial:null,actualDirectValue:d<=cutoff?round(value):null,actualTotalValue:d<=cutoff?fin.value:null,dailyPhysical:plan.physical-previousPlan.physical,dailyFinancial:plan.financial-previousPlan.financial,dailyActualPhysical:d<=cutoff?physical-previousActual.physical:null,dailyActualFinancial:d<=cutoff?actual.financial-previousActual.financial:null});previousPlan=plan;previousActual=actual;
 }return result;
}
export function trace(p,reports,cutoff=today()){
 const m=metrics(p,reports,cutoff),plan=planAt(p,cutoff),tolerance=.1;
 const financeKnown=m.confirmed.length>0;
 const status=(a,b,known,empty)=>!known?empty:a-b < -tolerance?'Retrasado':a-b>tolerance?'Adelantado':'Según programa';
 return {cutoff,planVersion:p.planVersion||1,reportIds:m.confirmed.map(r=>r.id),physical:{actual:m.physical,planned:plan.physical,gap:m.physical-plan.physical,status:status(m.physical,plan.physical,m.confirmed.length>0,'Sin reportes confirmados')},financial:{actual:m.financial,planned:plan.financial,gap:m.financial-plan.financial,status:status(m.financial,plan.financial,financeKnown,'Sin reportes confirmados')},items:m.items.map(i=>{const mapping=p.mappings?.find(x=>x.code===i.code),task=p.tasks?.find(x=>x.id===mapping?.taskId);const total=task?.days?.reduce((s,d)=>s+d.hours,0)||0,progress=total?task.days.filter(d=>d.date<=cutoff).reduce((s,d)=>s+d.hours,0)/total*100:null;return {...i,planned:progress,gap:progress===null?null:i.progress-progress,state:i.progress>=100-1e-8?'Completada':i.progress>0?'En ejecución':'Sin avance registrado'};}),daily:dailyCurve(p,reports,cutoff)};
}
