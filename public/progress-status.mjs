export function itemProgressState(project,item,executed,cutoff,baseline=true){
 if(!baseline)return {key:'unapplied',label:'Sin aplicar',show:false};
 const progress=executed/item.quantity*100;
 if(progress>=100-1e-8)return {key:'complete',label:'Completada',show:true};
 if(progress>0)return {key:'partial',label:'En ejecución',show:true};
 const mapping=project.mappings?.find(m=>m.code===item.code),task=project.tasks?.find(t=>t.id===mapping?.taskId),due=task?.days?.some(d=>d.date<=cutoff&&d.hours>0);
 return due?{key:'due',label:'Sin avance registrado al corte',show:true}:{key:'pending',label:task?'Aún no programada al corte':'Sin programación diaria',show:false};
}
