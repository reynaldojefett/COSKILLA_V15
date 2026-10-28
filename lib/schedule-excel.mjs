import {fail,date} from '../public/domain.mjs';
import {addDays,dayCount} from '../public/planning.mjs';
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function excelDate(value,date1904=false){
 if(typeof value==='number'&&Number.isFinite(value))return date(addDays(date1904?'1904-01-01':'1899-12-30',Math.floor(value)));
 const s=String(value??'').trim();if(/^\d{4}-\d{2}-\d{2}/.test(s))return date(s.slice(0,10));
 const m=s.match(/(?:^|\s)(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})(?:$|\s)/);
 if(m){const y=m[3].length===2?'20'+m[3]:m[3];return date(`${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);}
 fail('Usa fechas reales de Excel, AAAA-MM-DD o DD/MM/AAAA.');
}
export function parseScheduleExcel(data){
 const tasks=[],warnings=[],errors=[];let found=false,assumed=false;
 for(const sheet of data.sheets||[]){let columns=null;
  for(const [n,row]of sheet.rows.entries()){
   const cells=row.map(norm),col=names=>cells.findIndex(v=>names.includes(v));
   const name=col(['actividad','tarea','nombredetarea','nombre','descripcion']),start=col(['inicio','comienzo','fechainicio','fechadeinicio','start']),finish=col(['fin','termino','finalizacion','fechafin','fechadefin','finish']);
   if(name>=0&&start>=0&&finish>=0){columns={name,start,finish,code:col(['codigopartida','codigodepartida','codigo','item','partida']),id:col(['idtarea','idactividad','activityid','id']),wbs:col(['edt','wbs']),calendar:col(['calendario','diaslaborables']),hours:col(['horasdia','horaspordia']),summary:col(['resumen','summary']),parent:col(['capitulo','grupo','padre']),predecessors:col(['predecesoras','predecesores','predecessors']),critical:col(['critica','critico','critical']),slack:col(['holgurah','holgurahoras','totalslackhours'])};found=true;continue;}
   if(!columns)continue;const c=columns,taskName=String(row[c.name]??'').trim();if(!taskName)continue;
   const a=row[c.start],b=row[c.finish];if((a===null||a===undefined||a==='')&&(b===null||b===undefined||b==='')){if(row[c.code])errors.push(`${sheet.name}, fila ${n+1}: completa inicio y fin de ${taskName}.`);continue;}
   try{
    const from=excelDate(a,data.date1904),to=excelDate(b,data.date1904);if(to<from||dayCount(from,to)>3660)fail('El fin debe ser posterior o igual al inicio y el plazo no debe superar diez años.');
    const calendar=norm(row[c.calendar]);let weekdays;
    if(!calendar){weekdays=[1,2,3,4,5];assumed=true;}
    else if(['lunvie','lunesaviernes','12345'].includes(calendar))weekdays=[1,2,3,4,5];
    else if(['lunsab','lunesasabado','123456'].includes(calendar))weekdays=[1,2,3,4,5,6];
    else if(['todos','diario','lundom','lunesadomingo','1234567'].includes(calendar))weekdays=[0,1,2,3,4,5,6];
    else fail('Calendario no reconocido. Escribe Lun-Vie, Lun-Sab o Todos.');
    const missingHours=row[c.hours]===''||row[c.hours]===undefined||row[c.hours]===null,hours=missingHours?null:Number(row[c.hours]);if(!missingHours&&(!Number.isFinite(hours)||hours<=0||hours>24))fail('Horas/día debe ser un número entre 0 y 24, mayor que cero.');
    const summary=['si','true','1','yes'].includes(norm(row[c.summary])),days=[];
    if(missingHours||!calendar)assumed=true;
    if(!summary&&!missingHours&&calendar)for(let d=from;d<=to;d=addDays(d,1))if(weekdays.includes(new Date(d+'T12:00:00Z').getUTCDay()))days.push({date:d,hours,calendarHours:hours});
    const criticalText=norm(row[c.critical]),critical=['si','true','1','yes'].includes(criticalText)?true:['no','false','0'].includes(criticalText)?false:null,slackText=row[c.slack],slack=slackText===''||slackText===undefined||slackText===null?null:Number(slackText);
    tasks.push({critical:critical!==null?critical:Number.isFinite(slack)?slack<=0:null,criticalBasis:critical!==null?'Marca declarada en Excel':Number.isFinite(slack)?'Holgura en horas declarada en Excel':null,totalSlackHours:Number.isFinite(slack)?slack:null,sourcePredecessors:String(row[c.predecessors]??''),id:`excel:${sheet.name}:${n+1}`,sourceId:String(row[c.id]??''),budgetCode:String(row[c.code]??'').trim(),wbs:String(row[c.wbs]??row[c.code]??''),name:taskName,parent:String(row[c.parent]??sheet.name),start:from,finish:to,summary,cost:0,days,calendarName:calendar?'Excel: '+String(row[c.calendar]):'',calendarSource:'Declarado en Excel',hoursMissing:missingHours,calendarMissing:!calendar,sourceSheet:sheet.name,sourceRow:n+1,calendar:calendar||'Lun-Vie'});
   }catch(e){errors.push(`${sheet.name}, fila ${n+1}: ${e.message}`);}
  }
 }
 for(const task of tasks){if(!task.sourcePredecessors.trim())continue;task.predecessors=[];for(const raw of task.sourcePredecessors.split(/[;,]/).map(v=>v.trim()).filter(Boolean)){const parsed=raw.match(/^(.*?)(FS|SS|FF|SF|FC|CC|CF)([+-]\d+(?:[.,]\d+)?[dh]?)?$/i),ref=(parsed?parsed[1]:raw).trim(),kind=(parsed?.[2]||'FS').toUpperCase(),types={FS:'FINISH_START',FC:'FINISH_START',SS:'START_START',CC:'START_START',FF:'FINISH_FINISH',SF:'START_FINISH',CF:'START_FINISH'},matches=tasks.filter(v=>v.sourceId===ref||v.budgetCode===ref||v.wbs===ref||v.id===ref),lag=parsed?.[3]||'';task.predecessors.push({id:matches.length===1?matches[0].id:'unresolved:'+ref,type:types[kind],lag,lagValue:lag?Number(lag.replace(/[dh]/gi,'').replace(',','.')):0});if(matches.length!==1)warnings.push(`Predecesora ${ref} no identificada de forma única para ${task.name}.`);}}
 if(!found)fail('No se encontraron columnas Actividad, Inicio y Fin. Un dibujo de Gantt sin esas columnas no basta. Descarga «Excel desde mi presupuesto», completa las fechas y vuelve a subirlo como programación.');
 if(errors.length)fail(errors.slice(0,6).join(' ') + (errors.length>6?` Hay ${errors.length} filas por corregir.`:''));
 if(!tasks.some(t=>!t.summary))fail('No hay actividades de ejecución con fechas. Completa la plantilla y vuelve a adjuntarla.');
 if(assumed)warnings.push('Hay actividades sin Calendario u Horas/día. No se asignaron jornadas automáticamente. Completa Lun-Vie, Lun-Sab o Todos y las horas reales en el Excel, o declara un calendario de seguimiento antes de aplicar la línea base.');
 warnings.push('Excel utiliza las fechas, el calendario y las predecesoras declarados. La criticidad se muestra solo si se declara Crítica o Holgura (h); no se calcula una nueva ruta crítica.');
 return {tasks,warnings,method:'Distribución por horas/día y días laborables indicados en el Excel.'};
}
