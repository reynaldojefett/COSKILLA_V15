import {randomUUID} from 'node:crypto';
import {checkedFinance,activeFinance,costLabels} from '../public/finance.mjs';
import {date,text,fail} from '../public/domain.mjs';
import {aiSnapshot} from './ai-report.mjs';
export function handleV14(s,path,input,event){
 if(!['/api/finance','/api/finance-entry','/api/finance-entry-void','/api/ai-report-approve'].includes(path))return {handled:false};
 const p=s.projects.find(p=>p.id===input.projectId);if(!p)fail('Obra no encontrada.');const author=text(input.author,'Responsable',100);let result;
 if(path==='/api/finance'){const before=structuredClone(p.financeConfig||null),config=checkedFinance(input,p),reason=text(input.reason,'Motivo del ajuste',1000);p.financeVersions||=[];p.financeVersions.push({at:new Date().toISOString(),author,reason,before,after:config});p.financeConfig=config;event(s,'Configuración financiera actualizada',p.id,author,reason);result=config;}
 if(path==='/api/finance-entry'){
  if(activeFinance(p)?.mode!=='administracion-directa')fail('Los devengados se registran tras configurar Administración directa.');
  const category=input.category;if(!Object.hasOwn(costLabels,category))fail('Concepto de gasto inválido.');const day=date(input.date);if(day<p.start||day>p.end)fail('La fecha debe estar dentro del plazo de obra.');const amount=Number(input.amount);if(!Number.isFinite(amount)||amount<=0||amount>1e12)fail('Ingresa un importe mayor que cero.');
  const reference=text(input.reference,'Documento de devengado',300),requestId=text(input.requestId,'Identificador',100);p.financeEntries||=[];const previous=p.financeEntries.find(e=>e.requestId===requestId);if(previous)return {handled:true,result:previous};
  if(p.financeEntries.some(e=>!e.voidedAt&&e.reference.toLowerCase()===reference.toLowerCase()&&e.category===category))fail('Este documento ya está registrado en el concepto. Revisa antes de duplicarlo.');
  result={id:randomUUID(),requestId,date:day,category,amount:Math.round(amount*100)/100,reference,author,at:new Date().toISOString()};p.financeEntries.push(result);event(s,'Devengado registrado',p.id,author,`${reference} · ${costLabels[category]} · S/ ${result.amount}`);
 }
 if(path==='/api/finance-entry-void'){const row=p.financeEntries?.find(e=>e.id===input.id&&!e.voidedAt);if(!row)fail('Registro no disponible.');row.voidReason=text(input.reason,'Motivo',1000);row.voidedAt=new Date().toISOString();row.voidedBy=author;event(s,'Devengado anulado',p.id,author,row.voidReason);result=row;}
 if(path==='/api/ai-report-approve'){const a=s.aiReports?.find(a=>a.id===input.id&&a.projectId===p.id);if(!a)fail('Análisis no encontrado.');if(input.reviewed!==true)fail('Revisa el análisis antes de incorporarlo.');if(aiSnapshot(p,s,a.cutoff,a.scope,a.reportId).hash!==a.hash)fail('Los registros cambiaron. Genera otro análisis antes de aprobarlo.');a.status='approved';a.approvedBy=author;a.approvedAt=new Date().toISOString();event(s,'Análisis IA revisado',p.id,author,a.id);result=a;}
 return {handled:true,result};
}
