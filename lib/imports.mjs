import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,readFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,delimiter} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {fail,text,round} from '../public/domain.mjs';
import {proposeLinks,hydrateChapters} from '../public/relations.mjs';
import {parseScheduleExcel} from './schedule-excel.mjs';
const exec=promisify(execFile),root=fileURLToPath(new URL('..',import.meta.url));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function repair(value){if(typeof value!=='string'||!/[ÃÂ]/.test(value))return value;const cp={8364:128,8218:130,402:131,8222:132,8230:133,8224:134,8225:135,710:136,8240:137,352:138,8249:139,338:140,381:142,8216:145,8217:146,8220:147,8221:148,8226:149,8211:150,8212:151,732:152,8482:153,353:154,8250:155,339:156,382:158,376:159};const fixed=Buffer.from([...value].map(c=>cp[c.codePointAt(0)]??c.codePointAt(0))).toString('utf8');return fixed.includes('�')?value:fixed;}
export function parseBudget(data){
 const warnings=[],items=[],projectNames=[],rows=[],invalidItems=[];let direct=null,total=null;
 for(const sheet of data.sheets||[]){let header=-1,columns;
  sheet.rows.forEach((r,n)=>{const cells=r.map(norm),desc=cells.findIndex(v=>['descripcion','partida','description'].includes(v)),quantity=cells.findIndex(v=>['cant','cantidad','metrado','quantity'].includes(v)),price=cells.findIndex(v=>['precio','preciounitario','pu','price'].includes(v)),unit=cells.findIndex(v=>['unid','unidad','und','unit'].includes(v)),code=cells.findIndex(v=>['item','codigo','cod','code'].includes(v));if(desc>=0&&quantity>=0&&price>=0&&unit>=0&&code>=0){header=n;columns={desc,quantity,price,unit,code,partial:cells.findIndex(v=>['parcial','importe','subtotal'].includes(v)),subtotal:cells.findIndex(v=>v==='subtotal')};}});
  if(header<0)continue;
  for(const [n,r]of sheet.rows.entries()){
   const joined=r.map(String).join(' '),clean=norm(joined);
   if(clean.includes('costodirecto'))direct=[...r].reverse().find(v=>typeof v==='number')??direct;
   if(clean.includes('totaldepresupuesto'))total=[...r].reverse().find(v=>typeof v==='number')??total;
   if(n<header&&r.some(v=>norm(v)==='proyecto'))projectNames.push(r.filter(v=>typeof v==='string'&&v.length>50).join(' '));
   if(n<=header)continue;const c=columns,unit=String(r[c.unit]||'').trim(),quantity=Number(r[c.quantity]),price=Number(r[c.price]);
   const rawCode=String(sheet.displayRows?.[n]?.[c.code]??r[c.code]??'').trim(),code=rawCode.length<=40?rawCode:'',description=String(r[c.desc]||'').trim()||r.filter(v=>typeof v==='string'&&v.trim()&&v!==rawCode).join(' ').trim()||(rawCode.length>40?rawCode:'');
   if(!description&&!unit&&!code)continue;
   const display={rowId:`${sheet.name}:${n+1}`,code,description,unit,quantity:r[c.quantity]===''||r[c.quantity]===undefined?null:quantity,price:r[c.price]===''||r[c.price]===undefined?null:price,partial:typeof r[c.partial]==='number'?r[c.partial]:null,subtotal:typeof r[c.subtotal]==='number'?r[c.subtotal]:null,sourceSheet:sheet.name,sourceRow:n+1,type:unit?'item':code?'heading':clean.includes('costodirecto')||clean.includes('total')||clean.includes('gastosgenerales')||clean.includes('utilidad')||clean.includes('igv')||clean.includes('supervision')?'total':'note',eligible:false};
   // Totals can sit outside the description/subtotal columns in exported budgets.
   if(display.type==='total'&&display.subtotal===null)display.subtotal=[...r].reverse().find(v=>typeof v==='number')??null;
   rows.push(display);
   if(!unit){if(description.length>130)projectNames.push(description);continue;}
   if(!code||!String(r[c.desc]||'').trim()||!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(price)||price<=0){const problem={code:code||`fila ${n+1}`,sourceRow:n+1,reason:'Completa código, descripción, cantidad y precio positivos en el Excel y actualiza la lectura.'};invalidItems.push(problem);display.problem=problem.reason;warnings.push(`Fila ${n+1}: partida con unidad sin datos válidos. ${problem.reason}`);continue;}
   const sourceAmount=typeof r[c.partial]==='number'?r[c.partial]:null;
   const item={code,description:String(r[c.desc]).trim(),unit,quantity,price,sourceAmount,sourceSheet:sheet.name,sourceRow:n+1};
   if(items.some(i=>i.code===item.code))fail(`El código ${item.code} aparece más de una vez. Revisa el presupuesto o exporta una sola obra.`);
   if(sourceAmount!==null&&Math.abs(round(quantity*price)-sourceAmount)>.011)warnings.push(`Fila ${n+1}: cantidad × precio no coincide con el parcial de ${item.code}.`);
   items.push(item);
   display.eligible=true;
  }
 }
 if(!items.length)fail('No se encontraron partidas con código, descripción, unidad, cantidad y precio. Exporta una tabla Excel con esos encabezados.');
 const budget=round(items.reduce((s,i)=>s+round(i.quantity*i.price),0));items.forEach(i=>i.weight=round(i.quantity*i.price)/budget*100);
 if(direct!==null&&Math.abs(budget-direct)>.02)warnings.push(`La suma de partidas (${budget}) no coincide con el costo directo declarado (${direct}).`);
 if(projectNames.length>1&&norm(projectNames[0])!==norm(projectNames[1]))warnings.push('El Excel contiene encabezados de obra distintos. Confirma el nombre y el alcance antes de aplicar la línea base.');
 warnings.push('El avance de partidas utiliza el costo directo. Gastos generales, utilidad, IGV y supervisión se conservan como información del presupuesto.');
 return {items:hydrateChapters(items,rows),rows,invalidItems,budget,direct,total,projectNames,warnings};
}
export function suggestLinks(items,tasks){
 return proposeLinks(items,tasks);
}
export async function readImport(input){
 const name=text(input.name,'Nombre del archivo',200),ext=name.split('.').at(-1).toLowerCase();
 if(!['budget','schedule'].includes(input.kind))fail('Tipo de documento inválido.');
 if(!/^[A-Za-z0-9+/=]+$/.test(input.base64||'')||input.base64.length>17000000)fail('El archivo debe pesar hasta 12 MB.');
 const bytes=Buffer.from(input.base64,'base64'),file={id:randomUUID(),name,kind:input.kind,base64:input.base64,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),createdAt:new Date().toISOString(),parsed:null,error:null};
 const allowed=input.kind==='budget'?['xls','xlsx']:['mpp','xml','xer','pmxml','mpx','xls','xlsx'];
 if(!allowed.includes(ext)){file.error='Original conservado. Exporta el presupuesto a .xls/.xlsx o la programación a .mpp/.xml/.xer/.xls/.xlsx. Para Excel, incluye Actividad, Inicio y Fin; agrega Código partida para relacionar directamente.';return file;}
 const folder=await mkdtemp(join(tmpdir(),'coskilla-reader-')),source=join(folder,'source.'+ext),output=join(folder,'parsed.json');
 try{
  await writeFile(source,bytes);
  const classpath=join(root,'tools','classes')+delimiter+join(root,'tools','mpxj','*');
  await exec(process.env.JAVA_EXE||'java',['-Xmx512m','-Dfile.encoding=UTF-8','-cp',classpath,'CoskillaReader',input.kind,source,output],{timeout:90000,maxBuffer:2000000,windowsHide:true});
  const raw=JSON.parse(await readFile(output,'utf8')),parsed=input.kind==='schedule'&&['xls','xlsx'].includes(ext)?parseScheduleExcel(raw):raw;
  if(input.kind==='budget')file.parsed=parseBudget(parsed);else{
   const tasks=parsed.tasks.map(t=>({...t,rawName:t.name,name:repair(t.name).trim(),parent:repair(t.parent).trim()}));if(!tasks.some(t=>!t.summary))fail('El archivo no contiene tareas de ejecución.');
   file.parsed={...parsed,tasks,start:tasks.reduce((s,t)=>t.start<s?t.start:s,tasks[0].start),end:tasks.reduce((s,t)=>t.finish>s?t.finish:s,tasks[0].finish),warnings:[...(parsed.warnings||[]),'Se utilizarán fechas y calendarios de las tareas actuales del archivo. Los costos se tomarán del presupuesto Excel, no de los costos de Project/P6.']};
  }
 }catch(e){file.error=e.code==='ENOENT'?'No se encontró Java. Instala Java 11 o superior o configura JAVA_EXE y reinicia. El archivo original quedó adjunto.':'No se pudo leer el archivo: '+(e.message?.startsWith('Command failed')?'revisa su formato, contraseña o versión. El original quedó conservado.':e.message);}
 finally{for(const path of [source,output])try{await unlink(path);}catch(e){if(e.code!=='ENOENT')throw e;}await rmdir(folder);}
 return file;
}
