import {enhanceDates} from './ui-dates.mjs';
export function replaceMatching(node,markup,focus=''){
 const input=focus?node.querySelector(focus):null,pos=input?.selectionStart,top=window.scrollY,left=window.scrollX,listTop=node.querySelector('.match-list')?.scrollTop||0,inspectTop=node.querySelector('.match-inspector')?.scrollTop||0,code=node.querySelector('[data-map-code]')?.dataset.mapCode,opened=[...node.querySelectorAll('details[open]')].map(v=>v.querySelector('[data-date-editor]')?.dataset.dateEditor).filter(Boolean);
 node.innerHTML=markup;enhanceDates(node);
 for(const id of opened)node.querySelector(`[data-date-editor="${CSS.escape(id)}"]`)?.closest('details')?.setAttribute('open','');
 const restore=()=>{const list=node.querySelector('.match-list'),inspector=node.querySelector('.match-inspector');if(list)list.scrollTop=listTop;if(inspector)inspector.scrollTop=code===node.querySelector('[data-map-code]')?.dataset.mapCode?inspectTop:0;window.scrollTo(left,top);};
 restore();requestAnimationFrame(restore);
 if(focus){const next=node.querySelector(focus);next?.focus({preventScroll:true});if(pos!==null&&pos!==undefined)next?.setSelectionRange(pos,pos);}
}
