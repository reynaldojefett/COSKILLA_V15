// Financial control is deterministic; AI may explain these results, never replace them.
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
export const costLabels={direct:'Costo directo',ggFixed:'Gastos generales fijos',ggVariable:'Gastos generales variables',supervision:'Inspección / supervisión',liquidation:'Liquidación',technicalFile:'Expediente técnico',other:'Otros costos aprobados',tax:'Impuestos del presupuesto'};
// Qué conceptos se consideran en cada modalidad. Es una guía de captura: el presupuesto aprobado de tu obra prevalece.
export const financeItems={
 contrata:{
  title:'Por contrata',
  basis:'Valorización de seguimiento: costo directo ejecutado más los porcentajes de gastos generales y utilidad del presupuesto contratado; el IGV va sobre el subtotal.',
  included:[
   ['Costo directo','Partidas del presupuesto: metrado ejecutado por precio unitario.'],
   ['Gastos generales fijos (%)','No dependen del plazo. Ejemplos habituales: garantías, seguros, trámites y gastos de contrato. Toma el porcentaje de tu análisis de gastos generales ofertado.'],
   ['Gastos generales variables (%)','Dependen del plazo: personal técnico y administrativo, oficina de obra, servicios, alquileres y movilidad.'],
   ['Utilidad (%)','Porcentaje ofertado sobre el costo directo.'],
   ['Subtotal e IGV (%)','El IGV se calcula sobre el subtotal. Usa 0 % si tus precios ya lo incluyen.']],
  excluded:'No se agregan: supervisión y expediente técnico de la entidad, reajustes, adelantos y su amortización, retenciones, mayores gastos generales por ampliación de plazo, adicionales y deductivos. Se controlan por separado.'},
 'administracion-directa':{
  title:'Administración directa',
  basis:'Presupuesto del expediente técnico aprobado: costo directo más los costos que el expediente asigna a la obra, cada uno como porcentaje del costo directo. No hay utilidad.',
  included:[
   ['Costo directo','Partidas del presupuesto analítico: mano de obra, materiales y maquinaria.'],
   ['Gastos generales fijos y variables (S/)','Importes del análisis de gastos generales del expediente técnico. Si tu expediente no los separa, regístralos en uno solo.'],
   ['Inspección / supervisión (S/)','Solo si el presupuesto aprobado de la obra lo incluye.'],
   ['Liquidación (S/)','Gasto de la liquidación técnico-financiera, si está presupuestado.'],
   ['Expediente técnico (S/)','Solo si el presupuesto de la obra lo incluye.'],
   ['Otros costos aprobados (S/)','Cualquier otro concepto del presupuesto aprobado.'],
   ['Impuestos del presupuesto (S/)','Solo si el presupuesto aprobado los consigna como línea propia; si el IGV ya está en los precios, déjalo en 0.']],
  excluded:'No se agrega utilidad. Compras, salidas de almacén y comprobantes no se suman a la curva para no duplicar: los devengados documentados se muestran aparte, como comparación.'}
};
const amount=(v,label)=>{const n=Number(v);if(v===''||v===null||v===undefined||!Number.isFinite(n)||n<0||n>1e12)throw new Error(`${label}: ingresa un importe válido, mayor o igual a cero.`);return round(n);};
export function checkedFinance(input,project){
 if(!['contrata','administracion-directa'].includes(project.executionMode))throw new Error('Define la modalidad en la ficha.');
 if(input.reviewed!==true)throw new Error('Confirma los conceptos con tu presupuesto aprobado.');
 const reference=String(input.reference||'').trim();if(!reference||reference.length>500)throw new Error('Indica el documento que sustenta estos valores.');
 const mode=project.executionMode,config={mode,reference,reviewed:true};
 if(mode==='contrata'){for(const key of ['ggFixedRate','ggVariableRate','utilityRate','taxRate']){config[key]=amount(input[key],key);if(config[key]>100)throw new Error('Cada porcentaje debe estar entre 0 y 100.');}config.taxIncluded=input.taxIncluded===true;if(config.taxIncluded&&config.taxRate!==0)throw new Error('Los precios ya incluyen IGV: usa 0% de IGV adicional para no duplicarlo.');}
 else{config.costs={};for(const key of Object.keys(costLabels).filter(k=>k!=='direct'))config.costs[key]=amount(input.costs?.[key]??0,costLabels[key]);}
 return config;
}
export function activeFinance(p){return p.financeConfig?.reviewed&&p.financeConfig.mode===p.executionMode?p.financeConfig:null;}
export function directBudget(p){return round((p.items||[]).reduce((n,i)=>n+round(i.quantity*i.price),0));}
const rateText=r=>r.basis==='subtotal'?`${r.percentOfDirect.toFixed(2)} % del costo directo (${r.rate} % del subtotal)`:`${r.percentOfDirect.toFixed(2)} % del costo directo`;
// Cada concepto es un porcentaje del costo directo; su valor al corte es ese porcentaje por el costo directo valorizado.
function proportionalRows(c,cd,base){
 const pct=v=>cd?v/cd*100:0,rows=[{key:'direct',label:costLabels.direct,percentOfDirect:100,budget:cd,value:round(base)}];
 if(c.mode==='contrata'){
  for(const [key,label]of [['ggFixedRate','Gastos generales fijos'],['ggVariableRate','Gastos generales variables'],['utilityRate','Utilidad']])rows.push({key,label,rate:c[key],percentOfDirect:c[key],budget:round(cd*c[key]/100),value:round(base*c[key]/100)});
  const budget=round(rows.reduce((n,r)=>n+r.budget,0)),value=round(rows.reduce((n,r)=>n+r.value,0));
  rows.push({key:'subtotal',label:'Subtotal sin IGV',subtotal:true,percentOfDirect:pct(budget),budget,value});
  const tax={key:'tax',label:c.taxIncluded?'IGV adicional (incluido en precios)':'IGV',rate:c.taxRate,basis:'subtotal',budget:round(budget*c.taxRate/100),value:round(value*c.taxRate/100)};tax.percentOfDirect=pct(tax.budget);rows.push(tax);
 }else for(const key of Object.keys(costLabels).filter(k=>k!=='direct')){const budget=round(c.costs?.[key]||0);if(budget>0)rows.push({key,label:costLabels[key],percentOfDirect:pct(budget),budget,value:cd?round(base*budget/cd):0});}
 for(const r of rows)if(r.key!=='direct')r.rateText=rateText(r);
 return rows;
}
export function financeValue(p,base,cutoff='9999-12-31'){
 const cd=directBudget(p),c=activeFinance(p),direct=p.executionMode==='administracion-directa';
 if(!c){const rows=[{key:'direct',label:costLabels.direct,percentOfDirect:100,budget:cd,value:round(base)}];return {configured:false,mode:p.executionMode,budget:cd,value:round(base),percent:cd?base/cd*100:0,rows,label:'Valorización a costo directo',notice:direct?'Pendiente: registra los conceptos del presupuesto aprobado (gastos generales, supervisión, liquidación, expediente técnico). Mientras tanto se muestra solo el costo directo.':'Pendiente: configura gastos generales, utilidad e IGV. Mientras tanto se muestra solo el costo directo.'};}
 const rows=proportionalRows(c,cd,base),counted=rows.filter(r=>!r.subtotal),budget=round(counted.reduce((n,r)=>n+r.budget,0)),value=round(counted.reduce((n,r)=>n+r.value,0));
 let accruedTotal;
 if(c.mode==='administracion-directa'){const entries=(p.financeEntries||[]).filter(e=>!e.voidedAt&&e.date<=cutoff);for(const r of rows)r.accrued=round(entries.filter(e=>e.category===r.key).reduce((n,e)=>n+e.amount,0));accruedTotal=round(rows.reduce((n,r)=>n+(r.accrued||0),0));}
 return {configured:true,mode:c.mode,budget,value,percent:budget?value/budget*100:0,rows,accruedTotal,label:c.mode==='contrata'?'Valorización de obra con GG, utilidad e IGV':'Valorización con gastos generales y costos del expediente',notice:c.mode==='contrata'?'Seguimiento diario: cada concepto es un porcentaje del costo directo valorizado. No incluye reajustes, adelantos, amortizaciones, retenciones ni pagos.':'Seguimiento diario: cada concepto del presupuesto aprobado se valoriza como porcentaje del costo directo ejecutado. Los devengados documentados se comparan aparte y no mueven la curva.'};
}
export function financePlan(p,directPercent,date){return financeValue(p,directBudget(p)*directPercent/100,date).percent;}
// Valorización día a día: costo directo del día y conceptos derivados como porcentaje de ese valor.
export function financeDaily(p,curve,cutoff,count=15){
 const days=curve.filter(r=>r.actualDirectValue!==null&&r.actualDirectValue!==undefined&&r.date>=p.start&&r.date<=cutoff);
 let previous=financeValue(p,0,cutoff);const out=[];
 for(const day of days){const now=financeValue(p,day.actualDirectValue,cutoff);out.push({date:day.date,directDay:round(now.rows[0].value-previous.rows[0].value),rows:now.rows.map((r,k)=>({key:r.key,label:r.label,subtotal:!!r.subtotal,day:round(r.value-previous.rows[k].value),acc:r.value})),totalDay:round(now.value-previous.value),totalAcc:now.value});previous=now;}
 return out.filter(d=>d.directDay>0).slice(-count);
}
