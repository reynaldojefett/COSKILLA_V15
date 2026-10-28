import {providerInfo,resolveProvider} from './lib/ai/provider.mjs';
import {criticalNetwork} from './public/critical-network.mjs';
import {handleV12} from './lib/operations-v12.mjs';
import {handleV11} from './lib/operations-v11.mjs';
import {operationsSnapshot} from './public/operations-insights.mjs';
import {handleV10} from './lib/operations-v10.mjs';
import {readMaterialImport} from './lib/material-imports.mjs';
import {externalMovementReports} from './public/warehouse-domain.mjs';
import {exportXlsx,exportPdf,exportDocx} from './lib/export-v14.mjs';
import {reportModel} from './public/report-model.mjs';
import {analyzeReport,aiSnapshot} from './lib/ai-report.mjs';
import {handleV14} from './lib/operations-v14.mjs';
import {filesAccepted} from './public/file-review.mjs';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,resolve,extname} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createStore} from './lib/store.mjs';
import {extract} from './lib/ai.mjs';
import {validateProject,validateReport,validateTotals,approved,text,fail,metrics,date,today} from './public/domain.mjs';
import {basics,validItems,buildDaily,ready,trace} from './public/planning.mjs';
import {readImport,suggestLinks} from './lib/imports.mjs';
import {documentFor,documentAction} from './lib/documents.mjs';
import {applyCalendar,checkedCalendar} from './public/calendar.mjs';
import {checkedTaskDates,applyTaskDates,dateWarnings} from './public/schedule-review.mjs';
import {agendaRows} from './public/agenda-domain.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
try{const local=await readFile(join(root,'.env'),'utf8');for(const line of local.split(/\r?\n/)){const match=line.match(/^([A-Z_]+)=(.*)$/);if(match && !process.env[match[1]])process.env[match[1]]=match[2].trim().replace(/^['"]|['"]$/g,'');}}catch(e){if(e.code!=='ENOENT')throw e;}
export async function createApp({dataDir=join(root,'data'),env=process.env,ai=extract,analysisAI=analyzeReport,readDocument=readImport,accountMode=false}={}) {
 const store=await createStore(dataDir);let processing=false;
 const event=(s,action,entityId,author,detail='')=>s.events.push({id:randomUUID(),at:new Date().toISOString(),action,entityId,author,detail});
 const json=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Coskilla-Revision':String(store.read().revision)});res.end(JSON.stringify(data));};
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  try{
   if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||''))return json(res,403,{error:'Acceso permitido solo desde esta computadora.'});
   const url=new URL(req.url,`http://${req.headers.host}`),path=url.pathname;
   if(path.startsWith('/auth/')||path.startsWith('/access/'))return json(res,410,{error:'Acceso por cuentas suspendido. Abre COSKILLA desde la dirección local.'});
   if(req.method==='GET' && path==='/api/state'){const state=store.read();state.aiReports=(state.aiReports||[]).map(a=>{const p=state.projects.find(p=>p.id===a.projectId);return {...a,current:!!p&&aiSnapshot(p,state,a.cutoff,a.scope,a.reportId).hash===a.hash};});return json(res,200,{...state,aiConfigured:!!env.OPENAI_API_KEY,aiAnalysis:providerInfo(env),mode:'local',accountsEnabled:false,appVersion:'15.0.0'});}
   if(req.method==='GET' && path.startsWith('/api/documents/')){const file=store.read().documents?.find(d=>d.id===path.split('/').at(-1));if(!file)return json(res,404,{error:'Documento no encontrado.'});res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="original.${file.name.split('.').at(-1).replace(/[^a-zA-Z0-9]/g,'')}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,'Cache-Control':'no-store'});return res.end(Buffer.from(file.base64,'base64'));}
   if(req.method==='GET' && ['/api/export','/api/report-pdf'].includes(path)){
    const state=store.read(),p=state.projects.find(v=>v.id===url.searchParams.get('projectId'));if(!p)fail('Obra no encontrada.');const cutoff=date(url.searchParams.get('cutoff')),reportId=url.searchParams.get('reportId')||null,scope=url.searchParams.get('scope')||(reportId?'reports':'items'),format=path==='/api/report-pdf'?'pdf':url.searchParams.get('format'),analysisId=url.searchParams.get('analysisId');
    const formats={excel:[exportXlsx,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','xlsx'],word:[exportDocx,'application/vnd.openxmlformats-officedocument.wordprocessingml.document','docx'],pdf:[exportPdf,'application/pdf','pdf']};if(!formats[format])fail('Elige Excel, PDF o Word.');
    let analysis=null;if(analysisId){analysis=state.aiReports?.find(a=>a.id===analysisId&&a.projectId===p.id&&a.cutoff===cutoff&&a.scope===scope&&(a.reportId||null)===reportId&&a.status==='approved');if(!analysis||aiSnapshot(p,state,cutoff,scope,reportId).hash!==analysis.hash)fail('El análisis IA no corresponde a los datos actuales. Genera y revisa uno nuevo.');}
    const model=reportModel(p,state,cutoff,{scope,reportId,analysis}),[render,mime,ext]=formats[format],bytes=await render(model);res.writeHead(200,{'Content-Type':mime,'Content-Disposition':`attachment; filename="COSKILLA-${scope}-${cutoff}.${ext}"`,'Cache-Control':'no-store'});return res.end(bytes);
   }
   if(req.method==='GET' && path.startsWith('/api/material-original/')){const d=store.read().materialImports?.find(v=>v.id===path.split('/').at(-1));if(!d)fail('Original no encontrado.');res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="materiales.${d.name.split('.').at(-1).replace(/[^a-zA-Z0-9]/g,'')}"`,'Cache-Control':'no-store'});return res.end(Buffer.from(d.base64,'base64'));}
   if(req.method==='GET' && path==='/api/backup'){res.setHeader('Content-Disposition','attachment; filename="coskilla-respaldo.json"');return json(res,200,store.read());}
   if(req.method==='POST' && path.startsWith('/api/')){
    if(req.headers.origin!==url.origin || !req.headers['content-type']?.startsWith('application/json'))return json(res,403,{error:'Origen o formato no permitido.'});
    let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>22000000){json(res,413,{error:'La carga supera el límite de 22 MB.'});return;}chunks.push(c);}
    let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return json(res,400,{error:'JSON inválido.'});}
    if(path==='/api/material-import'){if(input.revision!==store.read().revision)fail('Actualiza antes de adjuntar.');const file=await readMaterialImport(input);await store.change(s=>{if(input.revision!==s.revision)fail('Los datos cambiaron durante la lectura. Vuelve a adjuntar.');if(!s.projects.some(p=>p.id===input.projectId))fail('Obra no encontrada.');s.materialImports||=[];file.projectId=input.projectId;s.materialImports.push(file);event(s,'Lista de materiales adjunta',input.projectId,text(input.author,'Responsable',100),file.name+' · SHA-256 '+file.sha256);});return json(res,200,file);}
    if(path==='/api/import'){
     if(input.revision!==store.read().revision)fail('Los datos cambiaron. Actualiza antes de adjuntar.');
     const file=await readDocument(input);
     await store.change(s=>{if(input.revision!==s.revision)fail('Los datos cambiaron durante la lectura. Actualiza y vuelve a adjuntar.');const p=s.projects.find(p=>p.id===input.projectId);if(!p)fail('Obra no encontrada.');s.documents||=[];file.projectId=p.id;s.documents.push(file);p[input.kind+'DocumentId']=file.id;event(s,file.parsed?'Archivo leído y conservado':'Archivo adjunto sin lectura',p.id,text(input.author,'Responsable',100),`${file.name} · SHA-256 ${file.sha256} · ${file.error||'Pendiente de aplicar a la línea base'}`);});
     return json(res,200,file);
    }
    if(path==='/api/document-reread'){
     const before=store.read();if(input.revision!==before.revision)fail('La lista cambió. Pulsa Actualizar lista y vuelve a intentarlo.');
     const {file:original}=documentFor(before,input.projectId,input.id);if(original.removedAt)fail('Recupera el archivo antes de actualizar su lectura.');
     const author=text(input.author,'Responsable',100),file=await readDocument({kind:original.kind,name:original.name,base64:original.base64});
     await store.change(s=>{if(input.revision!==s.revision)fail('La lista cambió durante la lectura. Actualiza y vuelve a intentarlo.');const {project}=documentFor(s,input.projectId,input.id);file.projectId=project.id;file.previousId=original.id;s.documents.push(file);project[file.kind+'DocumentId']=file.id;event(s,'Lectura de archivo actualizada',project.id,author,`${file.name}: ${file.parsed?'lectura completada':'requiere revisión'}. Se conserva la lectura anterior.`);});
     return json(res,200,file);
    }
    if(path==='/api/example-files'){
     const folder=join(root,'examples'),names=[['budget','presupuesto-paruro.xls'],['schedule','programacion-paruro.mpp']],files=[];
     for(const [kind,name]of names)files.push(await readDocument({kind,name,base64:(await readFile(join(folder,name))).toString('base64')}));
     await store.change(s=>{if(input.revision!==s.revision)fail('Los datos cambiaron. Actualiza antes de adjuntar.');const p=s.projects.find(p=>p.id===input.projectId);if(!p)fail('Obra no encontrada.');s.documents||=[];for(const file of files){file.projectId=p.id;s.documents.push(file);p[file.kind+'DocumentId']=file.id;}event(s,'Archivos proporcionados para el ejemplo',p.id,text(input.author,'Responsable',100),'Presupuesto y programa originales. No se cargaron avances ejecutados.');});return json(res,200,{files});
    }
    if(path==='/api/ai-report'){
     if(processing)return json(res,429,{error:'Hay un análisis en curso. Espera a que termine.'});if(input.consent!==true)fail('Autoriza el envío del resumen de obra a la API.');const state=store.read();if(input.revision!==state.revision)fail('Actualiza antes de analizar.');const p=state.projects.find(p=>p.id===input.projectId);if(!p)fail('Obra no encontrada.');const cutoff=date(input.cutoff),scope=input.scope||'trace',reportId=input.reportId||null;reportModel(p,state,cutoff,{scope,reportId});const source=aiSnapshot(p,state,cutoff,scope,reportId),provider=resolveProvider(env);const previous=(state.aiReports||[]).find(a=>a.projectId===p.id&&a.hash===source.hash&&a.provider===provider?.name&&a.model===provider?.model);if(previous&&!input.force)return json(res,200,previous);const day=today(),limit=Math.min(100,Math.max(1,Number(env.AI_DAILY_LIMIT)||20));if((state.aiRequests||[]).filter(r=>r.day===day).length>=limit)fail('Se alcanzó el límite diario de solicitudes IA.');if(!provider)fail('Configura una clave de API antes de generar el análisis.');await store.change(next=>{next.aiRequests||=[];next.aiRequests.push({day,at:new Date().toISOString(),projectId:p.id});});processing=true;
     try{const result=await analysisAI(source.snapshot,env),a={...result,id:randomUUID(),projectId:p.id,cutoff,scope,reportId,hash:source.hash,sourceIds:source.snapshot.sourceIds,at:new Date().toISOString(),status:'draft'};await store.change(next=>{if(aiSnapshot(next.projects.find(v=>v.id===p.id),next,cutoff,scope,reportId).hash!==source.hash)fail('Los datos cambiaron durante el análisis. Vuelve a generarlo.');next.aiReports||=[];next.aiReports.push(a);event(next,'Análisis IA generado para revisión',p.id,input.author||'Usuario local',a.id);});return json(res,200,a);}finally{processing=false;}
    }
    if(path==='/api/analyze'){
     if(processing)return json(res,429,{error:'Ya hay una lectura en curso. Espera a que termine.'});
     const state=store.read(),project=state.projects.find(p=>p.id===input.projectId);if(!project)fail('Obra no encontrada.');
     const checked=validateReport({date:input.date,author:input.author||'Revisión pendiente',note:input.note||'',items:[],personnel:[],machinery:[],movements:[],photos:input.photos||[]},project);
     processing=true;try{
      const result=await ai({project,note:checked.note,photos:checked.photos},env);
      const sourceId=randomUUID();await store.change(s=>{s.sources||=[];s.sources.push({id:sourceId,projectId:project.id,note:checked.note,photos:checked.photos,proposal:result.proposal,model:result.model,responseId:result.responseId,at:new Date().toISOString()});event(s,'Lectura de IA propuesta',sourceId,input.author||'Responsable por confirmar','Datos pendientes de revisión humana');});
      return json(res,200,{...result,sourceId});
     }finally{processing=false;}
    }
    const result=await store.change(s=>{
     if(input.revision!==s.revision)fail('Los datos cambiaron en otra ventana. Actualiza la página antes de guardar.');
     const v14=handleV14(s,path,input,event);if(v14.handled)return v14.result;
     const v12=handleV12(s,path,input,event);if(v12.handled)return v12.result;const v11=handleV11(s,path,input,event);if(v11.handled)return v11.result;const operation=handleV10(s,path,input,event);if(operation.handled)return operation.result;
     if(path==='/api/document-action'){
      const result=documentAction(s,input);event(s,{remove:'Archivo quitado de la selección',restore:'Archivo recuperado',select:'Archivo seleccionado'}[result.action],result.project.id,result.author,`${result.file.name}. Las líneas base y los reportes anteriores se conservan.`);return result.file;
     }
     if(path==='/api/projects'){
      const project={...validateProject(input),id:randomUUID(),createdAt:new Date().toISOString(),synthetic:false};s.projects.push(project);event(s,'Obra creada',project.id,text(input.author,'Responsable',100),project.name);return project;
     }
     if(path==='/api/setup'){
      const p={...basics(input),id:randomUUID(),createdAt:new Date().toISOString(),configStatus:'setup',items:[],schedule:[],mappings:[],tasks:[],synthetic:false,owner:text(input.author,'Responsable',100)};s.projects.push(p);event(s,'Ficha inicial creada',p.id,p.owner,p.name);return p;
     }
     if(path==='/api/project-update'){
      const p=s.projects.find(p=>p.id===input.projectId);if(!p)fail('Obra no encontrada.');const update=basics(input),before={name:p.name,location:p.location,start:p.start,end:p.end,executionMode:p.executionMode||'',resident:p.resident||'',supervisor:p.supervisor||'',inspector:p.inspector||'',cui:p.cui||'',contractorCompany:p.contractorCompany||'',supervisorCompany:p.supervisorCompany||'',entity:p.entity||''};
      if(s.reports.some(r=>r.projectId===p.id&&r.status!=='void'&&(r.date<update.start||r.date>update.end)))fail('Las fechas dejarían reportes fuera del plazo. Revisa sus fechas antes de corregir la ficha.');
      const changed=p.start!==update.start||p.end!==update.end;if(changed&&ready(p))p.configStatus='setup';Object.assign(p,update);const reason=text(input.reason||(input.autosave?'Actualización automática de la ficha':''),'Motivo de corrección',1000);event(s,'Datos iniciales corregidos',p.id,text(input.author,'Responsable',100),`${reason}. Nombre: ${before.name} → ${update.name}. Ubicación: ${before.location} → ${update.location}. Plazo: ${before.start} a ${before.end} → ${update.start} a ${update.end}.`);s.events.at(-1).changes={before,after:structuredClone(update)};return p;
     }
     if(path==='/api/suggest-links'){
      const p=s.projects.find(p=>p.id===input.projectId);if(!p)fail('Obra no encontrada.');const b=s.documents?.find(d=>d.id===p.budgetDocumentId),t=s.documents?.find(d=>d.id===p.scheduleDocumentId);if(!b?.parsed||!t?.parsed||b.removedAt||t.removedAt)fail('Selecciona un presupuesto y una programación legibles en Ficha y archivos; después vuelve a proponer coincidencias.');return suggestLinks(b.parsed.items,applyCalendar(applyTaskDates(t.parsed.tasks,input.taskDateOverrides),checkedCalendar(input.calendarOverride)));
     }
     if(path==='/api/setup-draft'){
      const p=s.projects.find(p=>p.id===input.projectId);if(!p)fail('Obra no encontrada.');
      const b=s.documents?.find(d=>d.id===p.budgetDocumentId),t=s.documents?.find(d=>d.id===p.scheduleDocumentId);
      if(!b?.parsed||!t?.parsed||b.removedAt||t.removedAt)fail('Selecciona dos archivos legibles antes de guardar las relaciones.');
      if(!Array.isArray(input.mappings)||input.mappings.length!==b.parsed.items.length)fail('El borrador debe incluir todas las partidas del presupuesto.');
      const seen=new Set();for(const m of input.mappings){if(seen.has(m.code)||!b.parsed.items.some(i=>i.code===m.code))fail('Código de partida no válido en el borrador.');seen.add(m.code);if(m.taskId&&!t.parsed.tasks.some(task=>!task.summary&&task.id===m.taskId))fail(`La actividad seleccionada para ${m.code} no pertenece a este programa.`);}
      p.mappingDraft={budgetHash:b.sha256,scheduleHash:t.sha256,mappings:input.mappings.map(m=>({code:m.code,taskId:m.taskId||''})),calendarOverride:checkedCalendar(input.calendarOverride),taskDateOverrides:checkedTaskDates(t.parsed.tasks,input.taskDateOverrides),at:new Date().toISOString(),author:text(input.author,'Responsable',100)};
      event(s,'Borrador de relaciones guardado',p.id,p.mappingDraft.author,'No modifica las curvas ni la línea base.');return p.mappingDraft;
     }
     if(path==='/api/document-review'){
      const p=s.projects.find(p=>p.id===input.projectId);if(!p)fail('Obra no encontrada.');
      const b=s.documents?.find(d=>d.id===p.budgetDocumentId),t=s.documents?.find(d=>d.id===p.scheduleDocumentId);
      if(!b?.parsed||!t?.parsed||b.removedAt||t.removedAt)fail('Carga un presupuesto base y un cronograma legibles antes de confirmar.');
      if(input.budgetDocumentId!==b.id||input.scheduleDocumentId!==t.id)fail('Los archivos seleccionados cambiaron. Revisa los nombres y confirma de nuevo.');
      if(typeof input.accepted!=='boolean')fail('Selecciona Sí o No para comprobar los documentos.');
      p.documentReview={budgetDocumentId:b.id,scheduleDocumentId:t.id,budgetHash:b.sha256,scheduleHash:t.sha256,accepted:input.accepted,author:text(input.author,'Responsable',100),at:new Date().toISOString()};event(s,input.accepted?'Documentos confirmados por el responsable':'Documentos pendientes de reemplazo',p.id,p.documentReview.author,'La confirmación valida la selección del usuario; no sustituye la revisión de alcance.');return p;
     }
     if(path==='/api/configure'){
      const p=s.projects.find(p=>p.id===input.projectId);if(!p)fail('Obra no encontrada.');if(!input.reviewed)fail('Confirma la revisión de partidas, vínculos y diferencias de los archivos.');
      const b=s.documents?.find(d=>d.id===p.budgetDocumentId),t=s.documents?.find(d=>d.id===p.scheduleDocumentId);if(!b?.parsed||!t?.parsed||b.removedAt||t.removedAt)fail('Añade o recupera un presupuesto y una programación legibles antes de aplicar la línea base.');
      if(!filesAccepted(p,b,t))fail('Confirma primero si el presupuesto base y el cronograma seleccionados son correctos para esta obra.');
      if(b.parsed.invalidItems?.length)fail(`Corrige las partidas con unidad y datos incompletos en el Excel (${b.parsed.invalidItems.map(i=>i.code).join(', ')}). Luego adjunta la versión corregida y actualiza la lectura.`);
      const items=validItems(input.items);if(items.length!==b.parsed.items.length||items.some(i=>!b.parsed.items.some(x=>x.code===i.code&&x.unit===i.unit&&x.quantity===i.quantity&&x.price===i.price)))fail('Las partidas deben conservar códigos, unidades, metrados y precios del presupuesto importado. Para corregirlos, adjunta otra versión del archivo.');
      if(s.reports.some(r=>r.projectId===p.id&&r.status==='confirmed')&&JSON.stringify(p.items.map(i=>[i.code,i.quantity,i.price,i.weight]))!==JSON.stringify(items.map(i=>[i.code,i.quantity,i.price,i.weight])))fail('Hay avances confirmados: conserva códigos, metrados, precios y pesos de la línea base. Puedes corregir la programación con un motivo.');
      const calendarOverride=checkedCalendar(input.calendarOverride),taskDateOverrides=checkedTaskDates(t.parsed.tasks,input.taskDateOverrides),tasks=applyCalendar(applyTaskDates(t.parsed.tasks,taskDateOverrides),calendarOverride),plan=buildDaily(p,items,tasks,input.mappings||[]);
      const dependencyWarnings=tasks.flatMap(task=>dateWarnings(task,tasks).map(w=>`${task.wbs||task.id}: ${w}`));
      if(taskDateOverrides.some(v=>v.convertMilestone))plan.method+=` ${taskDateOverrides.filter(v=>v.convertMilestone).length} hitos usados expresamente como actividades de seguimiento; se conserva la clasificación original.`;
      if(taskDateOverrides.length)plan.method+=` ${taskDateOverrides.length} actividades con fechas ajustadas para seguimiento; verificar en MS Project/P6.`;
      if(calendarOverride)plan.method+=' Actividades sin horas: calendario declarado por el responsable ('+calendarOverride.week+', '+calendarOverride.hours+' h/día), sin feriados ni dependencias recalculadas.';
      p.planVersions||=[];const version=(p.planVersion||0)+1;if(version>1)text(input.reason,'Motivo de nueva línea base',1000);
      p.items=items;p.schedule=plan.schedule;p.mappings=plan.mappings;p.tasks=tasks;p.calendarOverride=calendarOverride;p.taskDateOverrides=taskDateOverrides;p.dependencyWarnings=dependencyWarnings;p.planVersion=version;p.configStatus='ready';p.scheduleMode='tasks';p.planMethod=plan.method;p.budgetWarnings=b.parsed.warnings;p.scheduleWarnings=t.parsed.warnings;
      p.planVersions.push({version,at:new Date().toISOString(),author:text(input.author,'Responsable',100),reason:input.reason||'Primera línea base',items:structuredClone(items),tasks:structuredClone(tasks),calendarOverride,taskDateOverrides,dependencyWarnings,schedule:structuredClone(p.schedule),mappings:structuredClone(p.mappings),budgetDocumentId:b.id,scheduleDocumentId:t.id,metadata:{name:p.name,start:p.start,end:p.end,executionMode:p.executionMode||'',resident:p.resident||'',supervisor:p.supervisor||'',inspector:p.inspector||'',cui:p.cui||'',contractorCompany:p.contractorCompany||'',supervisorCompany:p.supervisorCompany||'',entity:p.entity||''}});event(s,'Línea base diaria aplicada',p.id,input.author,`Versión ${version} · ${items.length} partidas · ${p.schedule.length-1} días · ${taskDateOverrides.length} ajustes de fechas · ${input.reason||'Primera configuración'}`);return p;
     }
     if(path==='/api/trace'){
      const p=s.projects.find(p=>p.id===input.projectId);if(!ready(p))fail('Completa primero la línea base.');const cutoff=date(input.cutoff);if(cutoff>today())fail('La fecha de corte no puede ser futura.');const result={id:randomUUID(),projectId:p.id,at:new Date().toISOString(),author:text(input.author,'Responsable',100),...trace(p,s.reports,cutoff),operations:operationsSnapshot(p,s,cutoff),network:(()=>{const n=criticalNetwork(p,s.reports,cutoff);return {criticalIds:n.critical.map(t=>t.id),edges:n.edges,stale:n.stale,warnings:n.warnings};})()};s.traces||=[];s.traces.push(result);event(s,'Dashboard de trazabilidad generado',p.id,result.author,`Corte ${cutoff} · Línea base ${result.planVersion} · ${result.reportIds.length} reportes confirmados`);return result;
     }
     if(path==='/api/reports'){
      const project=s.projects.find(p=>p.id===input.projectId);if(!project)fail('Obra no encontrada.');
      if(!ready(project))fail('Completa el presupuesto y la programación antes de registrar avances.');
      const inputItems=(input.items||[]).map(i=>{if(!i.mode||i.mode==='quantity')return i;const item=project.items.find(x=>x.code===i.code);if(!item)fail('Partida desconocida.');const current=metrics(project,s.reports,input.date).items.find(x=>x.code===i.code).executed,target=i.mode==='complete'?100:Number(i.target);if(!Number.isFinite(target)||target<=0||target>100)fail('El porcentaje acumulado debe estar entre 0 y 100.');const quantity=item.quantity*target/100-current;if(quantity<=1e-8)fail(`La partida ${i.code} ya alcanzó ese porcentaje. Registra solo avance nuevo.`);return {code:i.code,quantity,mode:i.mode,targetPercent:target,basisQuantity:current};});
      const previous=s.reports.find(r=>r.requestId===input.requestId);if(previous)return previous;
      const report={...validateReport({...input,items:inputItems},project),id:randomUUID(),requestId:text(input.requestId,'Identificador de envío',100),projectId:project.id,status:'draft',createdAt:new Date().toISOString(),sourceId:null,synthetic:project.synthetic||project.practice,planVersion:project.planVersion||1};
      if(input.entrySource==='calendar'){
       const planned=agendaRows(project,[],report.date);report.entrySource='calendar';report.plannedContext=report.items.map(i=>{const row=planned.find(r=>r.code===i.code);return {code:i.code,plannedQuantity:row.plannedQuantity,taskId:row.task?.id||null};});
       report.offScheduleReason=text(input.offScheduleReason||'','Motivo del avance fuera de programación',1000,report.plannedContext.some(i=>i.plannedQuantity<=0));
      }
      report.items=report.items.map(i=>({...i,...Object.fromEntries(Object.entries(inputItems.find(x=>x.code===i.code)).filter(([k])=>['mode','targetPercent','basisQuantity'].includes(k)))}));
      if(input.sourceId){if(!s.sources?.some(a=>a.id===input.sourceId&&a.projectId===project.id))fail('Fuente de IA inválida.');report.sourceId=input.sourceId;}
      report.photos=report.photos.map(p=>({...p,sha256:createHash('sha256').update(Buffer.from(p.data.split(',')[1],'base64')).digest('hex')}));
      s.reports.push(report);event(s,'Reporte guardado para revisión',report.id,report.author,`${report.date} · ${report.items.length} partidas`);return report;
     }
     if(path==='/api/confirm'){
      const report=s.reports.find(r=>r.id===input.id);if(!report || report.status!=='draft')fail('Este reporte ya no está pendiente.');
      const project=s.projects.find(p=>p.id===report.projectId);if(!ready(project))fail('Revisa y aplica la línea base antes de confirmar este reporte.');for(const i of report.items.filter(i=>i.targetPercent)){const current=metrics(project,s.reports,report.date).items.find(x=>x.code===i.code).executed;if(Math.abs(current-i.basisQuantity)>1e-8)fail('Cambió el avance base de un porcentaje acumulado. Descarta este borrador y vuelve a registrar el avance para evitar duplicarlo.');}validateTotals(project,[...approved(s.reports,project.id),report],externalMovementReports(s.warehouseMovements,project.id));report.status='confirmed';report.reviewedBy=text(input.author,'Revisor',100);report.confirmedAt=new Date().toISOString();event(s,'Reporte confirmado',report.id,report.reviewedBy,'Incluido en metrados, curva S y almacén');return report;
     }
     if(path==='/api/void'){
      const report=s.reports.find(r=>r.id===input.id);if(!report || report.status==='void')fail('Reporte no disponible.');
      const reason=text(input.reason,'Motivo de anulación',1000);const project=s.projects.find(p=>p.id===report.projectId);
      validateTotals(project,approved(s.reports,project.id).filter(r=>r.id!==report.id),externalMovementReports(s.warehouseMovements,project.id));report.status='void';report.voidReason=reason;report.voidedAt=new Date().toISOString();report.voidedBy=text(input.author,'Responsable',100);event(s,'Reporte anulado',report.id,report.voidedBy,reason);return report;
     }
     if(path==='/api/demo'){
      if(s.projects.some(p=>p.synthetic))fail('Ya existe una obra de ejemplo. Selecciónala en el menú.');
      const id=randomUUID(),stamp=new Date().toISOString();
      const p={...validateProject({name:'Residencial Los Olivos · Ejemplo',location:'Lima, Perú · Datos ficticios',start:'2026-10-01',end:'2026-12-31',items:[{code:'01.01',description:'Excavación de zanjas',unit:'m³',quantity:1000,price:40,weight:25},{code:'02.01',description:'Concreto en cimentaciones',unit:'m³',quantity:200,price:500,weight:45},{code:'03.01',description:'Acero de refuerzo',unit:'kg',quantity:10000,price:5,weight:30}],schedule:[{date:'2026-10-01',physical:0,financial:0},{date:'2026-10-31',physical:30,financial:25},{date:'2026-11-30',physical:75,financial:70},{date:'2026-12-31',physical:100,financial:100}]}),id,createdAt:stamp,synthetic:true};s.projects.push(p);
      for(const [n,d]of ['2026-10-05','2026-10-12','2026-10-16'].entries())s.reports.push({id:randomUUID(),projectId:id,status:'confirmed',synthetic:true,requestId:randomUUID(),date:d,author:'Ing. Ana Torres (ejemplo)',reviewedBy:'Ana Torres (nombre de ejemplo)',createdAt:stamp,confirmedAt:stamp,note:'Reporte sintético para explorar el funcionamiento. No corresponde a una obra real.',tomorrow:'Continuar excavaciones y preparar vaciado de cimentaciones.',paid:10000,items:[{code:'01.01',quantity:100},{code:'02.01',quantity:10},{code:'03.01',quantity:400}],personnel:[{role:'Operarios',count:12},{role:'Peones',count:8}],machinery:[{name:'Excavadora CAT 320',hours:8}],movements:n===0?[{material:'Cemento',unit:'bolsa',type:'entrada',quantity:200},{material:'Cemento',unit:'bolsa',type:'salida',quantity:40}]:[{material:'Cemento',unit:'bolsa',type:'salida',quantity:40}],photos:[],sourceId:null});
      event(s,'Ejemplo ficticio cargado',id,'Demostración','Los datos de esta obra son sintéticos');return p;
     }
     fail('Operación no encontrada.');
    });return json(res,200,result);
   }
   if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Método no permitido.'});
   const relative=decodeURIComponent(path==='/'?'/index.html':path);const full=resolve(root,'public','.'+relative),publicRoot=resolve(root,'public');
   if(!full.startsWith(publicRoot+ '\\')&&!full.startsWith(publicRoot+'/'))return json(res,404,{error:'No encontrado.'});
   const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.ttf':'font/ttf','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
   const body=await readFile(full);res.writeHead(200,{'Content-Type':types[extname(full)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:body);
  }catch(error){json(res,error.code==='ENOENT'?404:400,{error:error.name==='TimeoutError'?'La lectura tardó demasiado. Reintenta o registra manualmente.':error.message||'No se pudo completar la operación.'});}
 });
 return {server,store};
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {server}=await createApp();const port=Number(process.env.PORT||8890);
 server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`El puerto ${port} ya está ocupado. Cierra la otra copia o cambia PORT en .env.`:e.message);process.exitCode=1;});
 server.listen(port,'127.0.0.1',()=>console.log(`COSKILLA local: http://127.0.0.1:${port}\nDatos: ${join(root,'data')}\nModo local sin cuentas. Ctrl+C para detener.`));
}

