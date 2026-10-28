import {operationsSnapshot} from '../../public/operations-insights.mjs';
import {createHash} from 'node:crypto';
import {siteAlerts} from '../../public/site-alerts.mjs';
import {today} from '../../public/domain.mjs';
import {plannedDates} from '../../public/agenda-domain.mjs';
import {displayDate} from '../../public/ui-dates.mjs';
// Hechos del motor determinista. TODA cifra que llegue a un informe nace aquí y se inserta por referencia {{ref}}.
const nf=d=>new Intl.NumberFormat('es-PE',{minimumFractionDigits:d,maximumFractionDigits:d}),f0=nf(0),f1=nf(1),f2=nf(2);
export function format({kind,value}){
 if(value===null||value===undefined)return '—';
 if(kind==='percent')return f1.format(value)+' %';
 if(kind==='points')return (value>0.05?'+':'')+f1.format(value)+' puntos';
 if(kind==='money')return 'S/ '+f2.format(value);
 if(kind==='int')return f0.format(value);
 if(kind==='date')return displayDate(value);
 return String(value);
}
const KPI_BLOCK=ref=>ref==='cutoff'||ref.includes(':')||ref.startsWith('status.');
export const isKpiRef=(registry,ref)=>registry.has(ref)&&!KPI_BLOCK(ref)&&!['text','date'].includes(registry.get(ref).kind);
export function buildFacts(project,state,cutoff){
 const a=siteAlerts(project,state,cutoff),r=a.r,m=a.m,known=m.confirmed.length>0,registry=new Map();
 const add=(ref,kind,value,label)=>registry.set(ref,{ref,kind,value,label});
 add('cutoff','date',cutoff,'Fecha de corte');
 add('physical.actual','percent',m.physical,'Avance físico acumulado confirmado');add('physical.planned','percent',r.physical.planned,'Avance físico programado al corte');add('physical.gap','points',r.physical.gap,'Diferencia física (real menos programado)');
 add('financial.actual','percent',m.financial,'Avance financiero valorizado confirmado');add('financial.planned','percent',r.financial.planned,'Avance financiero programado al corte');add('financial.gap','points',r.financial.gap,'Diferencia financiera (real menos programado)');
 add('valued','money',m.financialValued,'Avance financiero registrado');add('budget','money',m.financialBudget,'Presupuesto financiero configurado');add('direct.valued','money',m.valued,'Producción a costo directo');add('paid','money',m.paid,'Pagos registrados');
 add('status.physical','text',r.physical.status,'Estado físico según el motor');add('status.financial','text',r.financial.status,'Estado financiero según el motor');
 const days=[...plannedDates(project)].filter(v=>v<=cutoff&&v<=today()),recorded=new Set(m.confirmed.map(v=>v.date));
 add('reports.confirmed','int',m.confirmed.length,'Jornadas confirmadas al corte');add('reports.drafts','int',a.pending.length,'Borradores anteriores sin confirmar');
 add('days.coverage','percent',days.length?days.filter(v=>recorded.has(v)).length/days.length*100:0,'Cobertura de registro de jornadas programadas');
 const items=r.items.map(i=>({...i,deficit:i.planned===null?null:Math.max(0,i.budget*i.planned/100-i.valued)}));
 const census={complete:items.filter(i=>i.progress>=100-1e-8).length,active:items.filter(i=>i.progress>0&&i.progress<100-1e-8).length,empty:items.filter(i=>i.progress<=0).length};
 add('items.total','int',items.length,'Partidas totales');add('items.complete','int',census.complete,'Partidas completadas');add('items.active','int',census.active,'Partidas en ejecución');add('items.empty','int',census.empty,'Partidas sin avance registrado');
 add('alerts.count','int',a.alerts.length,'Alertas automáticas de control');
 const priority=(known?items.filter(i=>i.gap===null||i.gap<-.1):items.filter(i=>i.planned>0)).sort((x,y)=>(y.deficit||0)-(x.deficit||0)||y.budget-x.budget).slice(0,10);
 for(const i of priority){
  add(`item:${i.code}`,'text',`${i.code} · ${i.description}`,'Partida prioritaria');
  add(`item:${i.code}.progress`,'percent',i.progress,'Avance registrado de la partida');
  add(`item:${i.code}.planned`,i.planned===null?'text':'percent',i.planned===null?'Sin programación vinculada':i.planned,'Avance programado de la partida');
  add(`item:${i.code}.gap`,i.gap===null?'text':'points',i.gap===null?'—':i.gap,'Diferencia de la partida');
  add(`item:${i.code}.deficit`,i.deficit===null?'text':'money',i.deficit===null?'—':i.deficit,'Alcance valorizado pendiente respecto al programa');
 }
 const alerts=a.alerts.map(({key,level,title,text})=>({key,level,title,text}));
 const op=operationsSnapshot(project,state,cutoff);add('materials.incoming','money',op.materialSummary.knownIncome,'Entrada de materiales con costo conocido');add('materials.outgoing','money',op.materialSummary.knownOutput,'Salida de materiales con costo conocido');add('materials.stock','money',op.materialSummary.knownStock,'Saldo con costo conocido');add('materials.unknown','int',op.materialSummary.unknown,'Materiales con costo desconocido');
 add('resources.people','int',op.resources.filter(r=>r.date===cutoff).reduce((s,r)=>s+r.people,0),'Asistencias en partes del día, no personas únicas');add('resources.hours','number',op.resources.filter(r=>r.date===cutoff).reduce((s,r)=>s+r.machineHours,0),'Horas equipo del día');
 for(const row of m.finance.rows){add('cost:'+row.key+'.budget','money',row.budget,row.label+' presupuestado');add('cost:'+row.key+'.actual','money',row.value,row.label+' registrado');}
 const modelFacts={criterioFinanciero:m.finance.notice,modalidad:project.executionMode||'Sin definir',configuracionFinanciera:m.finance.configured,
  datosConfirmados:known,estado:{fisico:r.physical.status,financiero:r.financial.status},
  refs:[...registry.values()].map(e=>({ref:e.ref,descripcion:e.label,valor:format(e)})),
  alertas:alerts.map(x=>({key:x.key,nivel:x.level,titulo:x.title.replace(/\d+/g,'N')})),
  codigosDisponibles:priority.map(i=>i.code)
 };
 const round=v=>typeof v==='number'?Math.round(v*1e4)/1e4:v;
 const signature=createHash('sha256').update(JSON.stringify([project.planVersion||1,cutoff,[...registry.values()].map(e=>[e.ref,round(e.value)]),alerts.map(x=>[x.key,x.level]),r.physical.status,r.financial.status])).digest('hex');
 return {registry,modelFacts,signature,alerts,priority,census,known};
}
