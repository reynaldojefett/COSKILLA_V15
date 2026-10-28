import {fail,text} from '../public/domain.mjs';
export function documentFor(state,projectId,id){const project=state.projects.find(p=>p.id===projectId),file=state.documents?.find(d=>d.id===id&&d.projectId===projectId);if(!project||!file)fail('No se encontró el archivo en esta obra. Actualiza la ficha y vuelve a seleccionarlo.');return {project,file};}
export function documentAction(state,input){
 const {project,file}=documentFor(state,input.projectId,input.id),author=text(input.author,'Responsable',100),at=new Date().toISOString();
 if(input.action==='remove'){if(file.removedAt)fail('El archivo ya está quitado. Puedes recuperarlo desde los documentos conservados.');file.removedAt=at;file.removedBy=author;if(project[file.kind+'DocumentId']===file.id)project[file.kind+'DocumentId']=null;}
 else if(input.action==='restore'){if(!file.removedAt)fail('El archivo ya está disponible.');delete file.removedAt;delete file.removedBy;project[file.kind+'DocumentId']=file.id;}
 else if(input.action==='select'){if(file.removedAt)fail('Recupera el archivo antes de seleccionarlo.');project[file.kind+'DocumentId']=file.id;}
 else fail('Acción de archivo no válida. Usa añadir, quitar, recuperar o actualizar lectura.');
 return {project,file,author,action:input.action};
}
