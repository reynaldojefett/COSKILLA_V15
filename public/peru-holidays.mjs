// Recurring national holidays verified 2026-10-21. Compensable and regional days are excluded.
export const holidaySource={checked:'2026-10-21',url:'https://www.gob.pe/feriados',legal:'https://diariooficial.elperuano.pe/Normas/obtenerDocumento?idNorma=110007'};
const cache=new Map(),iso=(year,month,day)=>`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
function easter(year){const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;return iso(year,Math.floor(n/31),n%31+1);}
const shift=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
export function nationalHolidays(year){
 year=Number(year);if(!Number.isInteger(year)||year<1992||year>2199)return [];
 if(!cache.has(year)){const dates=[['01-01','Año Nuevo'],['05-01','Día del Trabajo'],['06-29','San Pedro y San Pablo'],['07-28','Fiestas Patrias'],['07-29','Fiestas Patrias'],['08-30','Santa Rosa de Lima'],['10-08','Combate de Angamos'],['11-01','Todos los Santos'],['12-08','Inmaculada Concepción'],['12-25','Navidad']].map(([d,name])=>({date:`${year}-${d}`,name}));
  if(year>=2022)dates.push({date:`${year}-08-06`,name:'Batalla de Junín'},{date:`${year}-12-09`,name:'Batalla de Ayacucho'});
  if(year>=2023)dates.push({date:`${year}-07-23`,name:'Día de la Fuerza Aérea del Perú'});
  if(year>=2024)dates.push({date:`${year}-06-07`,name:'Batalla de Arica y Día de la Bandera'});
  dates.push({date:shift(easter(year),-3),name:'Jueves Santo'},{date:shift(easter(year),-2),name:'Viernes Santo'});cache.set(year,dates.sort((a,b)=>a.date.localeCompare(b.date)).map(d=>Object.freeze({...d,type:'Feriado nacional',country:'PE'})));
 }return cache.get(year).map(d=>({...d}));
}
export const holidayOn=date=>nationalHolidays(Number(String(date).slice(0,4))).find(h=>h.date===date)||null;
