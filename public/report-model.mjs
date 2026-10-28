import {metrics} from './domain.mjs';
import {dailyCurve} from './planning.mjs';
import {financeValue} from './finance.mjs';
import {operationsSnapshot} from './operations-insights.mjs';
import {warehouseLedger} from './warehouse-domain.mjs';
import {profileRows} from './project-profile.mjs';
import {sequenceRows} from './budget-sequence.mjs';
import {catalogModel} from './catalog-view.mjs';
import {resourceTotals} from './resource-totals.mjs';
import {displayDate} from './ui-dates.mjs';
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
export const scopeNames={setup:'Ficha de obra',dashboard:'Resumen de obra',agenda:'Agenda diaria en obra',items:'Metrado valorizado diario',warehouse:'Movimiento de almacén',trace:'Dashboard de trazabilidad',reports:'Reportes diarios',history:'Historial de obra',guide:'Configuración de obra'};
export function reportModel(p,state,cutoff,{scope='items',reportId=null,analysis=null}={}){
 if(!scopeNames[scope])throw new Error('Sección de exportación no válida.');
 const selected=reportId?(state.reports||[]).find(r=>r.id===reportId&&r.projectId===p.id):null;
 if(reportId&&!selected)throw new Error('Reporte no encontrado en esta obra.');
 if(selected)cutoff=selected.date;
 const m=metrics({...p,items:p.items||[]},state.reports||[],cutoff),ops=operationsSnapshot(p,state,cutoff),f=m.finance||financeValue(p,m.valued,cutoff),month=cutoff.slice(0,7),days=new Date(Date.UTC(+month.slice(0,4),+month.slice(5,7),0)).getUTCDate(),dates=Array.from({length:days},(_,n)=>`${month}-${String(n+1).padStart(2,'0')}`),start=month+'-01',sections=[];
 const add=(title,headers,rows,extra={})=>sections.push({title,headers,rows,...extra});
 const meta=[['Obra',p.name],['CUI',p.cui||'No registrado'],['Ubicación',p.location||''],...profileRows(p),['Corte',displayDate(cutoff)],['Línea base',p.planVersion||'Sin aplicar'],['Tipo de datos',p.synthetic||p.practice?'DEMOSTRACIÓN: datos ficticios':'Registros de la obra']];
 if(['items','agenda','reports'].includes(scope)){
  const reports=selected?[selected]:(state.reports||[]).filter(r=>r.projectId===p.id&&r.status==='confirmed'&&r.date<=cutoff),confirmed=reports.filter(r=>r.status==='confirmed'),model=catalogModel(p,state),source=sequenceRows(model.budgetSource,p.items||[]),versions=p.planVersions||[];
  const baseHeaders=['N.°','Ítem','Descripción','Und.','Metrado base','Modif. 01','Modif. 02','Modif. 03','Ejecutado anterior'];
  const quantities=new Map((p.items||[]).map(i=>[i.code,{prior:confirmed.filter(r=>r.date<start).reduce((n,r)=>n+r.items.filter(v=>v.code===i.code).reduce((s,v)=>s+v.quantity,0),0),daily:dates.map(d=>d>cutoff?null:confirmed.filter(r=>r.date===d).reduce((n,r)=>n+r.items.filter(v=>v.code===i.code).reduce((s,v)=>s+v.quantity,0),0))}]));
  const rows=source.map((row,n)=>{const i=(p.items||[]).find(i=>i.code===row.code&&row.eligible);if(!i)return [n+1,row.code,row.description,...Array(8+days).fill('')];const q=quantities.get(i.code),initial=versions[0]?.items?.find(v=>v.code===i.code)?.quantity??i.quantity,changes=versions.slice(1).map(v=>v.items?.find(x=>x.code===i.code)?.quantity).filter((v,n,a)=>v!==undefined&&v!==(n?a[n-1]:initial)).slice(0,3);return [n+1,i.code,i.description,i.unit,initial,...Array.from({length:3},(_,n)=>changes[n]??''),q.prior,...q.daily,round(q.daily.reduce((s,v)=>s+(v||0),0)),round(q.prior+q.daily.reduce((s,v)=>s+(v||0),0))];});
  add('Metrado diario '+month,[...baseHeaders,...dates.map(d=>displayDate(d)),'Total mes','Acum. al corte'],rows,{matrix:true,month,dayStart:9,dayCount:days});
  const valued=source.map(row=>{const i=(p.items||[]).find(i=>i.code===row.code&&row.eligible);if(!i)return [row.code,row.description,...Array(6+days).fill('')];const q=quantities.get(i.code),prior=round(q.prior*i.price),daily=q.daily.map(v=>v===null?null:round(v*i.price)),monthTotal=round(daily.reduce((s,v)=>s+(v||0),0));return [i.code,i.description,i.unit,i.price,round(i.quantity*i.price),prior,...daily,monthTotal,round(prior+monthTotal)];});
  const leaves=valued.filter(r=>typeof r[3]==='number');
  valued.push(['','COSTO DIRECTO','','',round(leaves.reduce((s,r)=>s+r[4],0)),round(leaves.reduce((s,r)=>s+r[5],0)),...dates.map((d,k)=>d>cutoff?null:round(leaves.reduce((s,r)=>s+(r[k+6]||0),0))),round(leaves.reduce((s,r)=>s+r.at(-2),0)),round(leaves.reduce((s,r)=>s+r.at(-1),0))]);
  const cdRow=valued.at(-1),prior0=financeValue(p,cdRow[5],cutoff);
  if(prior0.rows.length>1){
   const series=prior0.rows.map(()=>[]);let cumulative=cdRow[5],previous=prior0;
   cdRow.slice(6,6+days).forEach(v=>{if(v===null){series.forEach(s=>s.push(null));return;}cumulative=round(cumulative+v);const now=financeValue(p,cumulative,cutoff);now.rows.forEach((r,j)=>series[j].push(round(r.value-previous.rows[j].value)));previous=now;});
   const sum=list=>round(list.reduce((n,v)=>n+(v||0),0)),counted=prior0.rows.map((r,j)=>r.subtotal?-1:j).filter(j=>j>=0);
   prior0.rows.forEach((r,j)=>{if(j>0)valued.push(['',(r.label+' · '+r.rateText).toUpperCase(),'','',r.budget,r.value,...series[j],sum(series[j]),previous.rows[j].value]);});
   valued.push(['','TOTAL VALORIZADO','','',round(counted.reduce((n,j)=>n+prior0.rows[j].budget,0)),round(counted.reduce((n,j)=>n+prior0.rows[j].value,0)),...dates.map((d,k)=>d>cutoff?null:round(counted.reduce((n,j)=>n+(series[j][k]||0),0))),round(counted.reduce((n,j)=>n+sum(series[j]),0)),round(counted.reduce((n,j)=>n+previous.rows[j].value,0))]);
  }
  add('Valorizado diario '+month,['Ítem','Descripción','Und.','P.U. S/','Presupuesto S/','Anterior S/',...dates.map(d=>displayDate(d)),'Mes S/','Acumulado S/'],valued,{matrix:true,month,dayStart:6,dayCount:days,money:true});
 }
 const accrual=f.accruedTotal!==undefined;add('Control financiero',['Concepto','% sobre costo directo','Presupuesto S/','Acumulado S/',...(accrual?['Devengado documentado S/']:[])],[...f.rows.map(r=>[r.label,round(r.percentOfDirect),r.budget,r.value,...(accrual?[r.subtotal?'':r.accrued||0]:[])]),['TOTAL','',f.budget,f.value,...(accrual?[f.accruedTotal]:[])],['Avance financiero %','','',round(f.percent),...(accrual?['']:[])]],{note:f.notice});
 if(['dashboard','trace','items'].includes(scope)&&p.schedule?.length>1)add('Curva S',['Fecha','Físico programado %','Físico ejecutado %','Financiero programado %','Financiero ejecutado %','Costo directo ejecutado acum. S/','Valorizado total ejecutado acum. S/','Valorizado total programado acum. S/'],dailyCurve(p,state.reports||[],cutoff).map(r=>[displayDate(r.date),round(r.physical),r.actualPhysical===null?null:round(r.actualPhysical),round(r.financial),r.actualFinancial===null?null:round(r.actualFinancial),r.actualDirectValue===null?null:round(r.actualDirectValue),r.actualTotalValue===null?null:round(r.actualTotalValue),round(f.budget*r.financial/100)]));
 if(['warehouse','trace','dashboard'].includes(scope)){
  add('Materiales valorizados',['Material','Unidad','Entrada','Salida','Saldo','Entrada S/','Salida S/','Saldo S/'],ops.materialRows.map(r=>[r.material,r.unit,r.incoming,r.outgoing,r.balance,r.incomingValue,r.outgoingValue,r.stockValue]));
  const movements=warehouseLedger(state,p.id,cutoff).lines;
  add('Movimientos documentados',['Fecha','Material','Tipo','Cantidad','Unidad','P.U. S/','Total S/'],movements.map(v=>[displayDate(v.date),v.material,v.type,v.quantity,v.unit,v.unitPrice,v.total]),{note:'Los importes desconocidos se muestran como —; no equivalen a cero.'});
 }
 if(['agenda','reports','trace','dashboard'].includes(scope)){
  const reports=selected?[selected]:m.confirmed;
  add('Jornadas y recursos',['Fecha','Responsable','Estado','Personal','Ausentes','Equipos','Horas equipo','Observaciones'],reports.map(r=>{const t=resourceTotals(r);return [displayDate(r.date),r.author,r.status,t.people,t.absent,t.equipment,t.hours,r.note||''];}));
  add('Personal y maquinaria',['Fecha','Tipo','Cargo / equipo','Cantidad','Horas equipo'],reports.flatMap(r=>[...(r.personnel||[]).map(v=>[displayDate(r.date),'Personal',v.role,v.count,'']),...(r.machinery||[]).map(v=>[displayDate(r.date),'Maquinaria',v.name,v.count??1,v.hours])]));
 }
 if(scope==='history')add('Historial',['Fecha y hora','Acción','Responsable','Detalle'],(state.events||[]).filter(e=>(e.entityId===p.id||(state.reports||[]).some(r=>r.id===e.entityId&&r.projectId===p.id))&&e.at.slice(0,10)<=cutoff).map(e=>[e.at,e.action,e.author,e.detail]));
 const approved=analysis?.status==='approved'?analysis:null;
 if(approved)add('Análisis de IA revisado',['Sección','Contenido'],[['Resumen',approved.content.summary],...approved.content.observations.map(v=>['Observación',v.text+' | Fuentes: '+v.sourceIds.join(', ')]),...approved.content.actions.map(v=>['Acción propuesta',v]),['Modelo',approved.model],['Fecha de generación',approved.at],['Revisado por',approved.approvedBy]]);
 return {title:selected?'Parte diario de obra':scopeNames[scope],projectId:p.id,cutoff,meta,sections,signatures:[['Residente',p.resident||''],[p.executionMode==='contrata'?'Supervisor':'Inspector',p.executionMode==='contrata'?p.supervisor||'':p.inspector||'']],note:selected&&selected.status!=='confirmed'?'REPORTE '+selected.status.toUpperCase()+': no suma a la ejecución.':'Solo registros guardados. Documento de seguimiento; no sustituye la valorización contractual aprobada.',ai:approved?{id:approved.id,model:approved.model}:null};
}
