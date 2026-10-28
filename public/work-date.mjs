import {date,today} from './domain.mjs';
const dates=new Map();
const constrain=(p,d)=>d<p.start?p.start:d>p.end?p.end:d;
export function workDate(p){let v=dates.get(p.id);if(!v){let saved;try{saved=JSON.parse(localStorage.getItem('coskilla-work-date:'+p.id)||'null');}catch{}v={date:constrain(p,saved?.date||today()),month:''};v.month=v.date.slice(0,7);dates.set(p.id,v);}if(v.date<p.start||v.date>p.end){v.date=constrain(p,v.date);v.month=v.date.slice(0,7);}return v;}
export function selectWorkDate(p,on){date(on);if(on<p.start||on>p.end)throw new Error('Elige una fecha dentro del plazo de la obra.');const v=workDate(p);v.date=on;v.month=on.slice(0,7);try{localStorage.setItem('coskilla-work-date:'+p.id,JSON.stringify(v));}catch{}return v;}
export function browseWorkMonth(p,month){if(!/^\d{4}-\d{2}$/.test(month)||month<p.start.slice(0,7)||month>p.end.slice(0,7))return;workDate(p).month=month;}
