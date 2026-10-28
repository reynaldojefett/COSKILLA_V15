import {buildFacts} from './ai/facts.mjs';
import {generateAnalysis} from './ai/analysis.mjs';
import {resolveProvider} from './ai/provider.mjs';
import {createHash} from 'node:crypto';
import {metrics} from '../public/domain.mjs';
import {dailyCurve} from '../public/planning.mjs';
import {operationsSnapshot} from '../public/operations-insights.mjs';
import {criticalNetwork} from '../public/critical-network.mjs';
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false}),str={type:'string'},array=items=>({type:'array',items});
export const analysisSchema=object({summary:str,observations:array(object({level:{type:'string',enum:['info','attention','urgent']},text:str,sourceIds:array(str)})),actions:array(str),charts:array({type:'string',enum:['daily','cumulative','materials','resources']})});
export function aiSnapshot(p,state,cutoff,scope='trace',reportId=null){
 const m=metrics(p,state.reports,cutoff),ops=operationsSnapshot(p,state,cutoff),network=criticalNetwork(p,state.reports,cutoff);
 // Names, photos, source documents, account information and API credentials are not sent.
 const snapshot={scope,reportId,cutoff,planVersion:p.planVersion||0,executionMode:p.executionMode||'',finance:m.finance,physical:m.physical,items:m.items.map(({code,description,unit,quantity,executed,budget,valued})=>({code,description,unit,quantity,executed,budget,valued})),curve:p.schedule?.length>1?dailyCurve(p,state.reports,cutoff):[],reports:m.confirmed.map(r=>({id:r.id,date:r.date,items:r.items})),warehouse:ops.materialRows,resources:ops.resources.map(({id,date,people,expected,absent,equipmentCount,machineHours})=>({id,date,people,expected,absent,equipmentCount,machineHours})),critical:{tasks:network.critical.map(t=>({id:t.id,name:t.name,start:t.start,finish:t.finish,late:t.late})),warnings:network.warnings},financeEntries:(p.financeEntries||[]).filter(e=>!e.voidedAt&&e.date<=cutoff).map(({id,date,category,amount})=>({id,date,category,amount}))};
 const ids=['project:'+p.id,...snapshot.items.map(i=>'item:'+i.code),...snapshot.reports.map(r=>r.id),...ops.movementIds,...snapshot.financeEntries.map(r=>r.id)];snapshot.sourceIds=ids;
 if(p.schedule?.length>1){const f=buildFacts(p,state,cutoff);snapshot.facts={...f,registry:[...f.registry]};}
 return {snapshot,hash:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')};
}
export async function analyzeReport(snapshot,env=process.env,fetcher=fetch){
 const provider=resolveProvider(env);if(!provider)throw new Error('IA pendiente de configurar. Agrega OPENAI_API_KEY o ANTHROPIC_API_KEY en .env.');if(!snapshot.facts)throw new Error('Aplica la línea base antes de generar el análisis IA.');
 const facts={...snapshot.facts,registry:new Map(snapshot.facts.registry)},result=await generateAnalysis({facts,cutoff:snapshot.cutoff,provider,fetcher,env});
 const content={summary:result.resolved.summary,observations:result.resolved.sections.map(v=>({level:v.tone==='danger'?'urgent':v.tone==='warning'?'attention':'info',text:v.title+': '+v.body,sourceIds:snapshot.sourceIds.slice(0,1)})),actions:result.resolved.recommendations.map(v=>v.text),charts:result.resolved.widgets.filter(v=>['daily','materials','resources'].includes(v.type)).map(v=>v.type)};
 return {content,resolved:result.resolved,spec:result.spec,provider:provider.name,model:result.model,responseId:result.requestId,usage:result.usage,promptVersion:'ia-2-finanzas'};
}

export function validateAnalysis(c,ids){const validText=(s,max)=>typeof s==='string'&&s.trim()&&s.length<=max;if(!c||!validText(c.summary,4000)||!Array.isArray(c.observations)||c.observations.length>8||!Array.isArray(c.actions)||c.actions.length>6||!Array.isArray(c.charts)||c.charts.length>4)throw new Error('Análisis de IA inválido.');for(const v of c.observations)if(!['info','attention','urgent'].includes(v.level)||!validText(v.text,2000)||!Array.isArray(v.sourceIds)||!v.sourceIds.length||v.sourceIds.some(id=>!ids.includes(id)))throw new Error('La IA citó una fuente no verificable. Reintenta el análisis.');if(c.actions.some(v=>!validText(v,1000))||c.charts.some(v=>!['daily','cumulative','materials','resources'].includes(v)))throw new Error('El análisis contiene acciones o gráficos no válidos.');}
