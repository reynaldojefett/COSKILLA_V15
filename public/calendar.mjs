import {date,num,fail,text} from './domain.mjs';
import {addDays,dayCount} from './planning.mjs';
export function checkedCalendar(value){
 if(!value?.enabled)return null;
 if(value.dayHours){const dayHours=Object.fromEntries([0,1,2,3,4,5,6].map(d=>[d,num(value.dayHours[d]??0,'Horas de '+d,0,24)]));if(!Object.values(dayHours).some(h=>h>0))fail('Define al menos un día con horas de trabajo.');if(!['all','missing'].includes(value.scope))fail('Selecciona a qué actividades aplicar la jornada.');if(value.reviewed!==true)fail('Revisa y acepta la jornada declarada.');return {enabled:true,dayHours,scope:value.scope,reviewed:true,reason:text(value.reason,'Motivo de la jornada',1000)};}
 const weekdays={weekdays:[1,2,3,4,5],saturday:[1,2,3,4,5,6],daily:[0,1,2,3,4,5,6]}[value.week];
 if(!weekdays)fail('Selecciona un calendario de trabajo válido.');
 return {enabled:true,week:value.week,hours:num(value.hours,'Horas de trabajo por día',.01,24)};
}
export function applyCalendar(tasks,value){
 const calendar=checkedCalendar(value);if(!calendar)return tasks;
 if(calendar.dayHours)return tasks.map(t=>{if(t.summary||t.milestone||calendar.scope==='missing'&&t.days?.some(d=>d.hours>0))return t;const days=[];if(t.start>t.finish||dayCount(t.start,t.finish)>3660)fail('Revisa las fechas de las actividades antes de cambiar la jornada.');for(let d=date(t.start);d<=t.finish;d=addDays(d,1)){const hours=calendar.dayHours[new Date(d+'T12:00:00Z').getUTCDay()];if(hours>0)days.push({date:d,hours});}return {...t,sourceDays:t.sourceDays||t.days,days,calendarOverride:calendar,calendarSource:'Jornada semanal declarada para seguimiento',criticalReviewRequired:calendar.scope==='all'};});
 const weekdays={weekdays:[1,2,3,4,5],saturday:[1,2,3,4,5,6],daily:[0,1,2,3,4,5,6]}[calendar.week];
 return tasks.map(t=>{
  if(t.summary||t.milestone||t.days?.some(d=>d.hours>0))return t;
  const start=date(t.start),finish=date(t.finish);if(finish<start||dayCount(start,finish)>3660)return {...t,days:[],calendarIssue:'Revisa las fechas de la actividad antes de distribuir sus horas.'};
  const days=[];for(let d=start;d<=finish;d=addDays(d,1))if(weekdays.includes(new Date(d+'T12:00:00Z').getUTCDay()))days.push({date:d,hours:calendar.hours});
  return {...t,days,calendarSource:'Declarado por el responsable para actividades sin horas',calendarOverride:calendar};
 });
}
