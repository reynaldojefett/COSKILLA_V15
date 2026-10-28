import {matchingView} from './matching-view.mjs';
import {replaceMatching} from './matching-position.mjs';
import {bulkCalendarControls,readBulkCalendar} from './calendar-bulk.mjs';
import {applyCalendar} from './calendar.mjs';
import {applyTaskDates,proposeTaskDates} from './schedule-review.mjs';
import {enhanceDates} from './ui-dates.mjs';
let demo=null,view={active:'',query:'',filter:'all',taskQuery:''},calendar=null,edits=[];
function initial(project){const items=[],tasks=[],mappings=[];for(let n=0;n<8;n++)for(const [k,i] of project.items.entries()){const code=`${n+1}.${k+1}`,t=project.tasks.find(t=>t.id===project.mappings.find(m=>m.code===i.code)?.taskId);items.push({...i,code,description:i.description+' · Frente '+(n+1)});tasks.push({...t,id:code,wbs:code,name:i.description+' · Frente '+(n+1),predecessors:[]});mappings.push({code,taskId:code});}return {project:{...project,id:'connection-example'},items,tasks,mappings};}
const tasks=()=>applyTaskDates(applyCalendar(demo.tasks,calendar),edits);
export function connectionExample(p){if(!demo)demo=initial(p);return `<header class="page-intro"><h1>Conexión del presupuesto · Ejemplo</h1></header><p class="notice">32 partidas ficticias para probar la búsqueda, los ajustes y las horas semanales. Esta práctica es independiente del avance del simulador. Los documentos reales se procesan en la aplicación local.</p><div id="demo-hours">${bulkCalendarControls(demo.tasks,calendar)}</div><div id="matching-example">${matchingView(demo.project,demo.items,demo.mappings,tasks(),view)}</div>`;}
function paint(focus=''){const node=document.querySelector('#matching-example');if(node)replaceMatching(node,matchingView(demo.project,demo.items,demo.mappings,tasks(),view),focus);}
export function initConnectionExample(ctx){
 document.addEventListener('input',e=>{if(!e.target.closest('#matching-example'))return;if(e.target.matches('[data-match-query]')){view.query=e.target.value;paint('[data-match-query]');}if(e.target.matches('[data-task-search]')){view.taskQuery=e.target.value;paint('[data-task-search]');}});
 document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!document.querySelector('#matching-example'))return;
  if(b.dataset.matchItem){view.active=b.dataset.matchItem;view.taskQuery='';paint();}
  if(b.dataset.matchFilter){view.filter=b.dataset.matchFilter;paint();}
  if(b.dataset.useTask||b.dataset.clearMapping){const code=b.dataset.useCode||b.dataset.clearMapping;demo.mappings=demo.mappings.map(m=>m.code===code?{code,taskId:b.dataset.useTask||''}:m);paint();}
  if(b.hasAttribute('data-cancel-dates'))paint();
  if(b.dataset.hoursPreset){for(const i of b.closest('.bulk-calendar').querySelectorAll('[data-bulk-hours]')){const d=+i.dataset.bulkHours;i.value=b.dataset.hoursPreset==='daily'||d>=1&&d<=5||b.dataset.hoursPreset==='saturday'&&d===6?8:0;}}
  if(b.hasAttribute('data-apply-bulk-hours')||b.hasAttribute('data-restore-bulk-hours')){const section=b.closest('.bulk-calendar');try{calendar=b.hasAttribute('data-restore-bulk-hours')?null:readBulkCalendar(section);paint();ctx.toast('Jornada aplicada solo al ejemplo de conexión.');}catch(err){section.querySelector('[data-bulk-error]').textContent=err.message;}}
  if(b.dataset.proposeDates){const node=b.closest('[data-date-editor]'),task=tasks().find(t=>t.id===b.dataset.proposeDates);try{const v=proposeTaskDates(demo.project,task,tasks(),{week:node.querySelector('[data-date-week]').value,hours:node.querySelector('[data-date-hours]').value});if(!v.possible)throw new Error(v.reason);for(const [selector,value] of [['[data-date-start]',v.start],['[data-date-finish]',v.finish]]){const el=node.querySelector(selector);el.value=el.type==='date'?value:value.split('-').reverse().join('/');}enhanceDates(node);node.querySelector('[data-date-reason]').value=v.reason;}catch(err){node.querySelector('.date-error').textContent=err.message;}}
  if(b.dataset.saveDates||b.dataset.restoreDates){const id=b.dataset.saveDates||b.dataset.restoreDates,node=b.closest('[data-date-editor]');try{const rest=edits.filter(v=>v.taskId!==id);if(b.dataset.saveDates)rest.push({taskId:id,start:node.querySelector('[data-date-start]').value,finish:node.querySelector('[data-date-finish]').value,week:node.querySelector('[data-date-week]').value,hours:node.querySelector('[data-date-hours]').value,reason:node.querySelector('[data-date-reason]').value,reviewed:node.querySelector('[data-date-reviewed]').checked});applyTaskDates(applyCalendar(demo.tasks,calendar),rest);edits=rest;paint();ctx.toast('Ajuste de ejemplo conservado. La selección y el desplazamiento se mantienen.');}catch(err){node.querySelector('.date-error').textContent=err.message;}}
 });
}
