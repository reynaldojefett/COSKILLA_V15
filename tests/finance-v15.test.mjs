import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
import {buildDaily,dailyCurve,trace} from '../public/planning.mjs';
import {validateReport,metrics} from '../public/domain.mjs';
import {financeValue,financeDaily,financePlan,directBudget,checkedFinance,financeItems} from '../public/finance.mjs';
import {reportModel} from '../public/report-model.mjs';
import {traceDashboard} from '../public/trace-dashboard.mjs';
import {financeSummary,financePanel} from '../public/v14-ui.mjs';
const CUT='2025-06-05';
const close=(a,b,msg)=>assert.ok(Math.abs(a-b)<=0.011,`${msg||''} ${a} ≈ ${b}`);
function project(mode='contrata',config){
 const p={id:'v15',name:'Obra de prueba',owner:'Responsable',resident:'Residente',start:'2025-06-02',end:'2025-06-15',configStatus:'ready',planVersion:1,executionMode:mode,items:[{code:'A',description:'Partida A',unit:'m³',quantity:100,price:10,weight:50},{code:'B',description:'Partida B',unit:'m²',quantity:50,price:20,weight:50}],tasks:[{id:'a',wbs:'1',name:'Actividad A',start:'2025-06-02',finish:'2025-06-04',critical:true,totalSlackHours:0,predecessors:[],days:['02','03','04'].map(v=>({date:'2025-06-'+v,hours:8}))},{id:'b',wbs:'2',name:'Actividad B',start:'2025-06-05',finish:'2025-06-08',critical:true,totalSlackHours:0,predecessors:[{id:'a',type:'FINISH_START',lagValue:0}],days:['05','06','07','08'].map(v=>({date:'2025-06-'+v,hours:8}))}],mappings:[{code:'A',taskId:'a'},{code:'B',taskId:'b'}]};
 return {...p,...buildDaily(p,p.items,p.tasks,p.mappings),...(config?{financeConfig:config}:{})};
}
const contrata={mode:'contrata',reviewed:true,reference:'Contrato',ggFixedRate:6,ggVariableRate:4,utilityRate:10,taxRate:18,taxIncluded:false};
const direct={mode:'administracion-directa',reviewed:true,reference:'Expediente técnico',costs:{ggFixed:100,ggVariable:60,supervision:40,liquidation:20,technicalFile:0,other:0,tax:0}};
const report=(id,date,qty,code='A')=>({...validateReport({projectId:'v15',date,author:'R',entrySource:'calendar',items:[{code,quantity:qty}],personnel:[],machinery:[],movements:[],photos:[],paid:0,note:'Parte',requestId:id,confirmSave:true},project()),id,projectId:'v15',status:'confirmed',reviewedBy:'R',createdAt:'2025-06-05T10:00:00.000Z',confirmedAt:'2025-06-05T10:00:00.000Z'});
const reports=()=>[report('r1','2025-06-02',20),report('r2','2025-06-03',30),report('r3','2025-06-04',10,'B')];

test('por contrata: GG fijos, GG variables y utilidad son % del costo directo valorizado; IGV sobre el subtotal',()=>{
 const p=project('contrata',contrata),cd=directBudget(p);assert.equal(cd,2000);
 const f=financeValue(p,500);const by=Object.fromEntries(f.rows.map(r=>[r.key,r]));
 assert.deepEqual(f.rows.map(r=>r.key),['direct','ggFixedRate','ggVariableRate','utilityRate','subtotal','tax']);
 close(by.ggFixedRate.value,30);close(by.ggVariableRate.value,20);close(by.utilityRate.value,50);close(by.subtotal.value,600);close(by.tax.value,108);
 close(f.value,708);close(f.budget,2832);close(f.percent,25);assert.equal(by.subtotal.subtotal,true);
 assert.match(by.ggFixedRate.rateText,/6\.00 % del costo directo/);assert.match(by.tax.rateText,/del subtotal/);
});

test('administración directa: cada concepto del presupuesto aprobado es % del costo directo; sin utilidad ni IGV propio',()=>{
 const p=project('administracion-directa',direct),f=financeValue(p,500);const keys=f.rows.map(r=>r.key);
 assert.deepEqual(keys,['direct','ggFixed','ggVariable','supervision','liquidation']);assert.ok(!keys.includes('utilityRate')&&!keys.includes('tax'));
 close(f.rows[1].percentOfDirect,5);close(f.rows[2].percentOfDirect,3);close(f.rows[3].percentOfDirect,2);close(f.rows[4].percentOfDirect,1);
 close(f.rows[1].value,25);close(f.rows[2].value,15);close(f.budget,2220);close(f.value,555);close(f.percent,25);
 const withTax=financeValue({...p,financeConfig:{...direct,costs:{...direct.costs,tax:400}}},500);assert.ok(withTax.rows.some(r=>r.key==='tax'));
});

test('administración directa: los devengados se muestran aparte y no mueven la curva',()=>{
 const p={...project('administracion-directa',direct),financeEntries:[{id:'e1',date:'2025-06-03',category:'ggFixed',amount:77,reference:'SIAF 1'},{id:'e2',date:'2025-06-04',category:'direct',amount:900,reference:'SIAF 2'},{id:'e3',date:'2025-06-04',category:'ggFixed',amount:5,reference:'X',voidedAt:'2025-06-05'}]};
 const f=financeValue(p,500,CUT);assert.equal(f.rows.find(r=>r.key==='ggFixed').accrued,77);assert.equal(f.rows[0].accrued,900);close(f.accruedTotal,977);
 close(f.percent,financeValue({...p,financeEntries:[]},500,CUT).percent);
 assert.equal(financeValue(p,500,'2025-06-02').accruedTotal,0);
});

test('sin conceptos configurados se muestra el costo directo (también en administración directa) y avisa qué falta',()=>{
 for(const mode of ['contrata','administracion-directa']){const f=financeValue(project(mode),500);assert.equal(f.configured,false);assert.equal(f.rows.length,1);close(f.value,500);close(f.percent,25);assert.match(f.notice,/Pendiente/);}
});

test('curva S: el avance financiero ya no depende de devengados y trae importes con GG',()=>{
 const p=project('administracion-directa',direct),r=reports(),t=trace(p,r,CUT);
 assert.equal(t.financial.status!=='Sin reportes confirmados',true);
 const curve=dailyCurve(p,r,CUT),last=curve.filter(v=>v.actualTotalValue!==null).at(-1),m=metrics(p,r,CUT);
 close(last.actualDirectValue,m.valued);close(last.actualTotalValue,m.finance.value);assert.ok(last.actualTotalValue>last.actualDirectValue);
 close(last.actualFinancial,m.financial);close(financePlan(p,40,'2025-06-05'),40);
});

test('valorización diaria: cada concepto del día es su % del costo directo del día y los días suman el acumulado',()=>{
 const p=project('contrata',contrata),r=reports(),days=financeDaily(p,dailyCurve(p,r,CUT),CUT);
 assert.equal(days.length,3);const f=financeValue(p,metrics(p,r,CUT).valued,CUT);
 for(const d of days){const fixed=d.rows.find(x=>x.key==='ggFixedRate');close(fixed.day,d.directDay*0.06,'GG fijos del día');close(d.rows.find(x=>x.key==='utilityRate').day,d.directDay*0.10,'utilidad del día');}
 close(days.reduce((n,d)=>n+d.totalDay,0),f.value,'suma diaria');close(days.at(-1).totalAcc,f.value);
});

test('Excel/PDF/Word: Valorizado diario trae los conceptos en adelante, Control financiero el % y la Curva S los importes',()=>{
 const p=project('contrata',contrata),r=reports(),state={projects:[p],reports:r,events:[]},model=reportModel(p,state,CUT,{scope:'items'}),m=metrics(p,r,CUT);
 const valued=model.sections.find(s=>s.title.startsWith('Valorizado diario')),labels=valued.rows.map(x=>x[1]);
 assert.ok(labels.includes('COSTO DIRECTO'));assert.ok(labels.some(l=>l.startsWith('GASTOS GENERALES FIJOS · 6.00 %')));assert.ok(labels.some(l=>l.startsWith('UTILIDAD')));assert.ok(labels.includes('TOTAL VALORIZADO'));assert.ok(labels.some(l=>l.startsWith('IGV')));
 const total=valued.rows.find(x=>x[1]==='TOTAL VALORIZADO'),cdRow=valued.rows.find(x=>x[1]==='COSTO DIRECTO');
 assert.equal(total.length,cdRow.length);close(total.at(-1),m.finance.value,'acumulado total');close(total[4],m.finance.budget,'presupuesto total');
 const ctrl=model.sections.find(s=>s.title==='Control financiero');assert.deepEqual(ctrl.headers.slice(0,2),['Concepto','% sobre costo directo']);
 const curve=model.sections.find(s=>s.title==='Curva S');assert.equal(curve.headers.length,8);assert.ok(curve.rows.some(x=>typeof x[6]==='number'&&x[6]>0));
 const ad=project('administracion-directa',direct),adModel=reportModel(ad,{projects:[ad],reports:r,events:[]},CUT,{scope:'items'});
 assert.ok(adModel.sections.find(s=>s.title==='Control financiero').headers.includes('Devengado documentado S/'));
 assert.ok(adModel.sections.find(s=>s.title.startsWith('Valorizado diario')).rows.some(x=>/INSPECCIÓN \/ SUPERVISIÓN/.test(x[1])));
});

test('interfaz: tabla de conceptos, valorización diaria y guía de conceptos por modalidad',()=>{
 const p=project('contrata',contrata),state={projects:[p],reports:reports(),events:[]};
 const html=financeSummary(p,state,CUT);assert.match(html,/% sobre costo directo/);assert.match(html,/Valorización diaria con gastos generales, utilidad e IGV/);assert.match(html,/Gastos generales fijos/);
 const adHtml=financeSummary(project('administracion-directa',direct),{projects:[],reports:reports(),events:[]},CUT);assert.match(adHtml,/Devengado documentado/);assert.match(adHtml,/costos del expediente/);
 assert.match(financePanel(p,CUT),/Qué conceptos se consideran: Por contrata/);assert.match(financePanel(project('administracion-directa',direct),CUT),/Qué conceptos se consideran: Administración directa/);assert.doesNotMatch(financePanel(project('administracion-directa',direct),CUT),/planStart|Inicio de costos indirectos/);
 assert.ok(financeItems.contrata.included.length>=5&&financeItems['administracion-directa'].included.length>=6);
 assert.throws(()=>checkedFinance({reviewed:true,reference:'x',costs:{ggFixed:-1}},{executionMode:'administracion-directa',start:'2025-06-02',end:'2025-06-15'}),/importe válido/);
});

test('se eliminó el panel de IA y la barra inferior; los botones quedan arriba solo en Partidas, Almacén y Dashboard',()=>{
 const app=readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8'),ui=readFileSync(new URL('../public/v14-ui.mjs',import.meta.url),'utf8');
 for(const text of ['aiPanel','exportToolbar','Exportar esta sección','Analizar y preparar el informe'])assert.ok(!app.includes(text)&&!ui.includes(text),text);
 const p=project('contrata',contrata),state={projects:[p],reports:reports(),events:[]},dash=traceDashboard(p,state,CUT);
 assert.match(dash,/↓ Excel de trazabilidad/);assert.match(dash,/↓ PDF/);assert.doesNotMatch(dash,/data-export="word"/);
 const wh=readFileSync(new URL('../public/warehouse-v11-view.mjs',import.meta.url),'utf8'),cat=readFileSync(new URL('../public/catalog-view.mjs',import.meta.url),'utf8');
 assert.match(wh,/↓ Excel de almacén/);assert.match(wh,/data-export="pdf"/);assert.match(cat,/↓ Excel de avance/);assert.ok(!wh.includes('data-material-export>'));
});

test('servidor: exporta Excel y PDF de las tres secciones con los nuevos conceptos y versión 15',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'coskilla-v15-')),app=await createApp({dataDir:dir,env:{}}),p=project('contrata',contrata);
 await app.store.change(s=>{s.projects.push(p);for(const r of reports())s.reports.push(r);});
 await new Promise(ok=>app.server.listen(0,'127.0.0.1',ok));const origin=`http://127.0.0.1:${app.server.address().port}`;
 try{
  assert.equal((await (await fetch(origin+'/api/state')).json()).appVersion,'15.0.0');
  for(const [scope,format,type] of [['items','excel','spreadsheetml'],['warehouse','excel','spreadsheetml'],['trace','excel','spreadsheetml'],['trace','pdf','pdf'],['warehouse','pdf','pdf']]){
   const r=await fetch(`${origin}/api/export?`+new URLSearchParams({projectId:'v15',cutoff:CUT,scope,format}));assert.equal(r.status,200,`${scope} ${format}`);assert.match(r.headers.get('content-type'),new RegExp(type));const bytes=Buffer.from(await r.arrayBuffer());assert.ok(bytes.length>1000);assert.equal(bytes.subarray(0,2).toString()==='PK'||bytes.subarray(0,4).toString()==='%PDF',true);
  }
 }finally{await new Promise(ok=>app.server.close(ok));}
});
