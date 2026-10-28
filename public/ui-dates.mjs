export function displayDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value||'')?`${value.slice(8,10)}/${value.slice(5,7)}/${value.slice(0,4)}`:String(value??'');}
export function inputDate(value){const m=String(value||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!m)return '';const iso=`${m[3]}-${m[2]}-${m[1]}`;try{return new Date(iso+'T00:00:00Z').toISOString().slice(0,10)===iso?iso:'';}catch{return '';}}
export const displayDates=text=>String(text??'').replace(/\b\d{4}-\d{2}-\d{2}\b/g,displayDate);
export const displayMarkup=html=>String(html).split(/(<textarea\b[^>]*>[\s\S]*?<\/textarea>|<strong\b[^>]*>[\s\S]*?<\/strong>|<p\b[^>]*data-verbatim[^>]*>[\s\S]*?<\/p>)/gi).map(part=>/^<(textarea|strong)\b/i.test(part)||/^<p\b[^>]*data-verbatim/i.test(part)?part:part.replace(/>([^<]+)</g,(all,value)=>'>'+displayDates(value)+'<')).join('');
export function enhanceDates(root=document){
 for(const native of root.querySelectorAll('input[type=date]')){
  let text=native._dateDisplay;
  if(!text){const wrap=document.createElement('span');wrap.className='date-control-field';native.parentNode.insertBefore(wrap,native);text=document.createElement('input');text.type='text';text.inputMode='numeric';text.placeholder='dd/mm/aaaa';text.maxLength=10;text.pattern='[0-9]{2}/[0-9]{2}/[0-9]{4}';text.autocomplete='off';text.className='date-display';text.setAttribute('aria-label',(native.getAttribute('aria-label')||native.labels?.[0]?.textContent?.trim()||'Fecha')+' (día/mes/año)');const icon=document.createElement('span');icon.className='date-calendar-icon';icon.textContent='▦';icon.setAttribute('aria-hidden','true');native.classList.add('native-date-input');native.setAttribute('aria-label','Abrir calendario');wrap.append(text,icon,native);native._dateDisplay=text;
   const write=()=>{native.value=inputDate(text.value);native.setCustomValidity(text.value&&!native.value?'Escribe una fecha válida con formato dd/mm/aaaa.':'');native.dispatchEvent(new Event('input',{bubbles:true}));};text.addEventListener('input',write);text.addEventListener('change',()=>{write();native.dispatchEvent(new Event('change',{bubbles:true}));});native.addEventListener('change',()=>{text.value=displayDate(native.value);native.setCustomValidity('');});
  }
  text.required=native.required;text.disabled=native.disabled;if(!(native.validationMessage&&text.value&&!native.value))text.value=displayDate(native.value);
 }
}
