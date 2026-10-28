import {financeValue,financePlan} from './finance.mjs';
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function fail(message) { throw new Error(message); }
export function date(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) !== value) fail('Fecha inválida. Usa año-mes-día.');
  return value;
}
export function text(value, label, max = 3000, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(`${label}: completa un texto válido (máximo ${max} caracteres).`);
  return value.trim();
}
export function num(value, label, min = 0, max = 1e12) {
  if (value === '' || value === null || typeof value === 'boolean' || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) fail(`${label}: introduce un número entre ${min} y ${max}.`);
  return Number(value);
}
export const round = x => Math.round((x + Number.EPSILON) * 100) / 100;
export function validateProject(input) {
  const p = { name: text(input.name, 'Nombre de obra', 150), location: text(input.location || '', 'Ubicación', 150, false), start: date(input.start), end: date(input.end) };
  if (p.start > p.end) fail('La fecha final debe ser igual o posterior al inicio.');
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 2000) fail('Agrega entre 1 y 2000 partidas.');
  const codes = new Set();
  p.items = input.items.map((i, n) => {
    const code = text(String(i.code || ''), 'Código de partida', 40);
    if (codes.has(code)) fail(`Código de partida repetido: ${code}`); codes.add(code);
    return { id: code, code, description: text(i.description, `Descripción fila ${n+1}`, 300), unit: text(i.unit, 'Unidad', 20), quantity: num(i.quantity, 'Metrado contratado', 0.000001), price: num(i.price, 'Precio unitario', 0.000001), weight: num(i.weight, 'Peso físico (%)', 0, 100) };
  });
  if (Math.abs(p.items.reduce((s,i)=>s+i.weight,0)-100) > .01) fail('Los pesos físicos de las partidas deben sumar 100%.');
  if (!Array.isArray(input.schedule) || input.schedule.length < 2 || input.schedule.length > 1000) fail('El programa necesita al menos dos fechas: inicio 0% y final 100%.');
  p.schedule = input.schedule.map(r => ({ date: date(r.date), physical: num(r.physical, 'Físico programado (%)',0,100), financial: num(r.financial,'Financiero programado (%)',0,100) })).sort((a,b)=>a.date.localeCompare(b.date));
  const first=p.schedule[0], last=p.schedule.at(-1);
  if(first.date!==p.start || first.physical!==0 || first.financial!==0 || last.date!==p.end || last.physical!==100 || last.financial!==100) fail('El programa debe comenzar en la fecha de inicio con 0% y terminar en la fecha final con 100%, para ambos avances.');
  p.schedule.forEach((r,i)=>{ if(i && (r.date<=p.schedule[i-1].date || r.physical<p.schedule[i-1].physical || r.financial<p.schedule[i-1].financial)) fail('Las fechas del programa deben ser únicas y los porcentajes acumulados no pueden disminuir.'); });
  return p;
}
function list(value, label, max=200) { if(!Array.isArray(value) || value.length>max) fail(`${label}: lista inválida.`); return value; }
export function validateReport(input, project) {
  const r={date:date(input.date), author:text(input.author,'Responsable',100), note:text(input.note||'','Descripción',10000,false), tomorrow:text(input.tomorrow||'','Plan para mañana',3000,false), paid:num(input.paid??0,'Pago realizado',0), items:[], personnel:[], machinery:[], movements:[]};
  if(r.date<project.start || r.date>project.end || r.date>today()) fail('El reporte debe estar dentro del plazo de obra y no puede ser futuro.');
  const seen=new Set();
  r.items=list(input.items,'Metrados').map(i=>{
    if(!project.items.some(p=>p.code===i.code)) fail(`Partida desconocida: ${i.code}`);
    if(seen.has(i.code)) fail('Registra cada partida una sola vez por reporte.');seen.add(i.code);
    return {code:i.code,quantity:num(i.quantity,'Metrado ejecutado',.000001)};
  });
  r.personnel=list(input.personnel,'Personal').map(i=>{const expected=i.expected===undefined?null:num(i.expected,'Personal previsto',1,100000),count=num(i.count,'Personal presente',expected===null?1:0,expected??100000);if(expected!==null&&!Number.isInteger(expected))fail('La cantidad prevista debe ser entera.');return {role:text(i.role,'Cargo',100),count,...(expected===null?{}:{expected,absent:expected-count})};});
  if(input.attendance?.length){r.attendance=list(input.attendance,'Asistencia').map(i=>({name:text(i.name,'Nombre del trabajador',100),role:text(i.role,'Cargo',100),present:i.present===true,hours:i.present===true?num(i.hours,'Horas de asistencia',0,24):0}));const names=new Set();for(const person of r.attendance){const key=person.name.toLocaleLowerCase('es');if(names.has(key))fail('Un trabajador está repetido en la asistencia.');names.add(key);}const counts=new Map();for(const person of r.attendance.filter(v=>v.present))counts.set(person.role,(counts.get(person.role)||0)+1);r.personnel=[...counts].map(([role,count])=>({role,count}));}
  if(r.personnel.some(i=>!Number.isInteger(i.count))) fail('La cantidad de personas debe ser un número entero.');
  r.machinery=list(input.machinery,'Maquinaria').map(i=>{if(i.count===undefined&&i.hoursPerUnit===undefined)return {name:text(i.name,'Equipo',100),hours:num(i.hours,'Horas de equipo',0,24)};const count=num(i.count??1,'Cantidad de equipos',1,10000),hoursPerUnit=num(i.hoursPerUnit??i.hours,'Horas por unidad',0,24);if(!Number.isInteger(count))fail('La cantidad de equipos debe ser entera.');return {name:text(i.name,'Equipo',100),count,hoursPerUnit,hours:count*hoursPerUnit};});
  r.movements=list(input.movements,'Almacén').map(i=>{if(!['entrada','salida'].includes(i.type)) fail('Movimiento de almacén inválido.');return {material:text(i.material,'Material',100),unit:text(i.unit,'Unidad de material',20),type:i.type,quantity:num(i.quantity,'Cantidad de material',.000001)};});
  r.photos=list(input.photos||[],'Fotos',3).map(p=>{
    if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p.data||'') || p.data.length>4200000) fail('Solo se admiten imágenes PNG, JPEG o WebP de hasta 3 MB.');
    return {name:text(p.name,'Nombre de imagen',150),data:p.data};
  });
  if(!r.note && !r.items.length && !r.movements.length && !r.personnel.length && !r.machinery.length && !r.paid && !r.photos.length && !r.attendance?.length) fail('Completa al menos un dato del reporte.');
  return r;
}
export function validateTotals(project, reports, externalMovements=[]) {
  for(const i of project.items) {
    const quantity=reports.reduce((s,r)=>s+r.items.filter(x=>x.code===i.code).reduce((v,x)=>v+x.quantity,0),0);
    if(quantity > i.quantity + 1e-8) fail(`El acumulado de ${i.code} supera el metrado contratado (${i.quantity} ${i.unit}). Revisa el reporte o tramita la modificación del presupuesto.`);
  }
  const stock=new Map();
  for(const r of [...reports,...externalMovements].sort((a,b)=>a.date.localeCompare(b.date) || (a.effectiveAt||a.createdAt||'').localeCompare(b.effectiveAt||b.createdAt||''))) for(const m of r.movements) {
    const key=`${m.material.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es')}|${m.unit.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es')}`;
    const balance=(stock.get(key)||0)+(m.type==='entrada'?m.quantity:-m.quantity);
    if(balance < -1e-8) fail(`Stock insuficiente de ${m.material} (${m.unit}) el ${r.date}. Registra primero su ingreso, incluido el saldo inicial.`);
    stock.set(key,balance);
  }
}
export function approved(reports, projectId, cutoff='9999-12-31') { return reports.filter(r=>r.projectId===projectId && r.status==='confirmed' && r.date<=cutoff); }
export function dailyValuations(project,reports,cutoff='9999-12-31') {
  const totals=new Map(),result=new Map();
  for(const r of approved(reports,project.id,cutoff).sort((a,b)=>a.date.localeCompare(b.date)||(a.effectiveAt||a.createdAt||'').localeCompare(b.effectiveAt||b.createdAt||''))){
    const lines=[];for(const entry of r.items){const item=project.items.find(i=>i.code===entry.code),before=totals.get(entry.code)||0,after=before+entry.quantity;lines.push({code:entry.code,value:round(round(after*item.price)-round(before*item.price))});totals.set(entry.code,after);}
    result.set(r.id,{lines,value:round(lines.reduce((s,l)=>s+l.value,0))});
  }return result;
}
export function metrics(project, reports, cutoff=today()) {
  const confirmed=approved(reports,project.id,cutoff);
  const items=project.items.map(i=>{const executed=confirmed.reduce((s,r)=>s+r.items.filter(x=>x.code===i.code).reduce((v,x)=>v+x.quantity,0),0);return {...i,executed,budget:round(i.quantity*i.price),valued:round(executed*i.price),progress:executed/i.quantity*100};});
  const budget=round(items.reduce((s,i)=>s+i.budget,0)), valued=round(items.reduce((s,i)=>s+i.valued,0));
  const physical=items.reduce((s,i)=>s+i.progress*i.weight/100,0);
  const stock=new Map();for(const r of confirmed) for(const m of r.movements){const key=`${m.material.toLocaleLowerCase('es')}|${m.unit.toLocaleLowerCase('es')}`;const prev=stock.get(key)||{material:m.material,unit:m.unit,quantity:0}; prev.quantity+=m.type==='entrada'?m.quantity:-m.quantity; stock.set(key,prev);}
  const finance=financeValue(project,valued,cutoff);
  return {items,budget,valued,physical,finance,financialBudget:finance.budget,financialValued:finance.value,financial:finance.percent,paid:round(confirmed.reduce((s,r)=>s+r.paid,0)),stock:[...stock.values()],confirmed};
}
function directPlanned(project, on) {
  const s=project.schedule; if(on<=s[0].date)return {physical:0,financial:0};if(on>=s.at(-1).date)return {physical:100,financial:100};
  const b=s.findIndex(r=>r.date>=on),a=s[b-1],z=s[b],t=(Date.parse(on)-Date.parse(a.date))/(Date.parse(z.date)-Date.parse(a.date));
  return {physical:a.physical+(z.physical-a.physical)*t,financial:a.financial+(z.financial-a.financial)*t};
}
export function planned(p,on){const v=directPlanned(p,on);return {...v,directFinancial:v.financial,financial:financePlan(p,v.financial,on)};}
export function curve(project,reports,cutoff=today()) {
  const dates=[...new Set([project.start,...project.schedule.map(s=>s.date),...approved(reports,project.id,cutoff).map(r=>r.date),...(cutoff>=project.start && cutoff<=project.end?[cutoff]:[])])].sort();
  return dates.map(d=>({date:d,...planned(project,d),actualPhysical:d<=cutoff?metrics(project,reports,d).physical:null,actualFinancial:d<=cutoff?metrics(project,reports,d).financial:null}));
}
