import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,readFile,unlink,rmdir} from 'node:fs/promises';
import {join,delimiter} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {text,fail} from '../public/domain.mjs';
import {excelDate} from './schedule-excel.mjs';
const run=promisify(execFile),root=fileURLToPath(new URL('..',import.meta.url)),norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function materialNumber(v){if(v===null||v===undefined||String(v).trim()==='')return null;if(typeof v==='number')return Number.isFinite(v)?v:null;if(/\$|\bUSD\b|\bEUR\b|€/i.test(String(v)))return null;let s=String(v).trim().replace(/S\/|S\.|\$|\s/g,'');if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');else if(s.includes(','))s=s.replace(',','.');return /^-?\d+(\.\d+)?$/.test(s)?Number(s):null;}
export function parseMaterials(raw){
 const result=[],warnings=['Verifica que todas las filas correspondan a materiales. Se excluyen tipos y secciones reconocibles de mano de obra, maquinaria y herramientas.','Los precios se incorporan en soles. Verifica moneda y decimales; no se convierte moneda extranjera.'];let excluded=0;
 const nonMaterial=v=>/manodeobra|personal|labor|maquinaria|equipos?|herramientas?|subcontrat|servicio/.test(norm(v));
 for(const sheet of raw.sheets||[]){if(nonMaterial(sheet.name)){excluded+=sheet.rows.length;continue;}let columns=null,header=-1;
  for(const [n,row] of sheet.rows.entries()){const cells=row.map(norm),find=names=>cells.findIndex(c=>names.includes(c)),description=find(['material','materiales','descripcion','descripciondelrecurso','insumo','recurso','nombre','resource','resourcename']),unit=find(['unidad','unid','und','unit','uom']);if(description>=0&&unit>=0){columns={description,unit,code:find(['codigo','cod','codigorecurso','item','resourceid']),type:find(['tipo','tiporecurso','tipoderecurso','categoria','grupo','clase']),quantity:find(['cantidad','cant','metrado','cantidadprevista','quantity','qty']),price:find(['preciounitario','precio','pu','costounitario','unitprice']),expected:find(['fechadellegada','llegada','fecha','fecharequerida','deliverydate'])};header=n;break;}}
  if(!columns)continue;let excludedSection=false;
  for(let n=header+1;n<sheet.rows.length;n++){const row=sheet.rows[n],material=String(row[columns.description]||'').trim(),unit=String(row[columns.unit]||'').trim(),type=String(row[columns.type]||'');if(!material)continue;
   if(!unit&&/^materiales$|^insumosmateriales$/i.test(norm(material))){excludedSection=false;continue;}
   if(!unit&&/^(manodeobra|personal|maquinaria|equipos|herramientas|subcontratos|servicios)$/.test(norm(material))){excludedSection=true;continue;}
   if(excludedSection||nonMaterial(type)||['hh','hm','horahombre','horamaquina'].includes(norm(unit))){excluded++;continue;}if(/^(total|subtotal|sub total|costo directo)$/i.test(material))continue;
   const quantity=materialNumber(row[columns.quantity]),unitPrice=materialNumber(row[columns.price]);let expected='';try{if(row[columns.expected])expected=excelDate(row[columns.expected],raw.date1904);}catch{warnings.push(`Fila ${n+1}: revisa la fecha prevista.`);}
   result.push({code:String(row[columns.code]??'').trim(),material,unit,quantity,unitPrice,expected,sourceSheet:sheet.name,sourceRow:n+1});
  }
 }
 if(!result.length)fail('No se identificó una lista de materiales. Exporta únicamente insumos materiales con Descripción y Unidad a Excel. Puedes añadir Código, Cantidad, Precio unitario y Fecha de llegada. Un presupuesto de partidas no reemplaza la lista de insumos.');
 if(result.length>2000)fail('La lista supera los 2000 materiales. Divide el archivo.');if(excluded)warnings.push(`${excluded} filas o registros de secciones ajenas a materiales fueron excluidos. Revisa el resultado.`);
 if(result.some(r=>r.quantity===null||r.unitPrice===null))warnings.push('Las cantidades y precios faltantes quedan vacíos. No se deducen a partir de horas o duraciones.');
 return {rows:result,warnings};
}
export function csvRows(source){const delimiter=source.split(/\r?\n/)[0].includes(';')?';':source.includes('\t')?'\t':',',rows=[];let row=[],field='',quote=false;for(let i=0;i<source.length;i++){const c=source[i];if(c==='"'){if(quote&&source[i+1]==='"'){field+='"';i++;}else quote=!quote;}else if(c===delimiter&&!quote){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&source[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';}else field+=c;}if(field||row.length){row.push(field);rows.push(row);}return rows;}
export async function readMaterialImport(input){
 const name=text(input.name,'Nombre del archivo',200),ext=name.split('.').at(-1).toLowerCase();if(!/^[A-Za-z0-9+/=]+$/.test(input.base64||'')||input.base64.length>17000000)fail('Adjunta un archivo de hasta 12 MB.');
 const bytes=Buffer.from(input.base64,'base64'),file={id:randomUUID(),name,base64:input.base64,sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length,createdAt:new Date().toISOString(),parsed:null,error:null};
 if(!['xls','xlsx','csv','tsv','docx','mpp','xer','xml','pmxml'].includes(ext)){file.error='Original conservado. Para Delphin, S10 u otro formato propietario, exporta la lista de insumos a Excel. Para Word usa .docx con tabla. Primavera/Project deben contener recursos de tipo Material; si no los incluyen, exporta su listado de materiales a Excel.';return file;}
 if(['csv','tsv'].includes(ext)){try{file.parsed=parseMaterials({sheets:[{name,rows:csvRows(bytes.toString('utf8').replace(/^\uFEFF/,''))}]});}catch(e){file.error=e.message;}return file;}
 const folder=await mkdtemp(join(tmpdir(),'coskilla-materials-')),source=join(folder,'source.'+ext),output=join(folder,'parsed.json');
 try{await writeFile(source,bytes);const mode=ext==='docx'?'materials-word':['xls','xlsx'].includes(ext)?'budget':'materials-project';await run(process.env.JAVA_EXE||'java',['-Xmx512m','-Dfile.encoding=UTF-8','-cp',join(root,'tools/classes')+delimiter+join(root,'tools/mpxj/*'),'CoskillaReader',mode,source,output],{timeout:90000,maxBuffer:2000000,windowsHide:true});file.parsed=parseMaterials(JSON.parse(await readFile(output,'utf8')));}catch(e){file.error=e.code==='ENOENT'?'No se encontró Java. Puedes completar la lista manualmente.':'No se pudo identificar el contenido. '+(e.message?.startsWith('Command failed')?'Exporta una lista de materiales con unidad, cantidad y precio a Excel.':e.message);}finally{for(const path of [source,output])await unlink(path).catch(()=>{});await rmdir(folder);}
 return file;
}
