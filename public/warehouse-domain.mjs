import {round} from './domain.mjs';
export const materialKey=(name,unit)=>[name,unit].map(v=>String(v||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es')).join('|');
export function warehouseRecords(state,projectId,cutoff='9999-12-31'){
 const direct=(state.warehouseMovements||[]).filter(m=>m.projectId===projectId&&m.status==='confirmed'&&m.date<=cutoff);
 const reports=(state.reports||[]).filter(r=>r.projectId===projectId&&r.status==='confirmed'&&r.date<=cutoff).flatMap(r=>r.movements.map((m,n)=>({...m,id:r.id+':'+n,reportId:r.id,projectId,date:r.date,createdAt:r.createdAt||'',effectiveAt:r.effectiveAt||r.createdAt||'',author:r.author,status:'confirmed',unitPrice:m.unitPrice??null})));
 return [...direct,...reports].sort((a,b)=>a.date.localeCompare(b.date)||(a.effectiveAt||a.createdAt||'').localeCompare(b.effectiveAt||b.createdAt||'')||a.id.localeCompare(b.id));
}
export function warehouseLedger(state,projectId,cutoff='9999-12-31'){
 const records=warehouseRecords(state,projectId,cutoff),stocks=new Map(),lines=[];
 for(const m of records){const key=materialKey(m.material,m.unit),s=stocks.get(key)||{key,material:m.material,unit:m.unit,quantity:0,incoming:0,outgoing:0,value:0,unknown:false};let unitPrice=m.unitPrice??null;
  if(m.type==='entrada'){s.incoming+=m.quantity;if(unitPrice===null)s.unknown=true;if(!s.unknown)s.value+=m.quantity*unitPrice;s.quantity+=m.quantity;}
  else{unitPrice=s.unknown||s.quantity<=0?null:s.value/s.quantity;s.outgoing+=m.quantity;s.quantity-=m.quantity;if(unitPrice!==null)s.value=Math.max(0,s.value-m.quantity*unitPrice);}
  if(Math.abs(s.quantity)<1e-8){s.quantity=0;s.value=0;s.unknown=false;}stocks.set(key,s);lines.push({...m,unitPrice,total:unitPrice===null?null:round(unitPrice*m.quantity),balance:s.quantity});
 }
 return {stocks:[...stocks.values()].map(s=>({...s,unitPrice:s.unknown||!s.quantity?null:s.value/s.quantity,value:s.unknown?null:round(s.value)})),lines};
}
export function externalMovementReports(movements,projectId){return (movements||[]).filter(m=>m.projectId===projectId&&m.status==='confirmed').map(m=>({id:m.id,date:m.date,createdAt:m.createdAt,items:[],movements:[m]}));}
export function purchaseStatus(purchase,state){const received=(state.warehouseMovements||[]).filter(m=>m.purchaseId===purchase.id&&m.status==='confirmed'&&m.type==='entrada').reduce((n,m)=>n+m.quantity,0);return {...purchase,received,remaining:Math.max(0,purchase.quantity-received)};}
