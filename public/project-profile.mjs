export const executionModes = Object.freeze({contrata:'Por contrata','administracion-directa':'Administración directa'});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name=(value,label)=>{if(typeof value!=='string'||!value.trim()||value.length>100)throw new Error(`${label}: completa el nombre (máximo 100 caracteres).`);return value.trim();};

export function projectProfile(input){
 if(!Object.hasOwn(executionModes,input.executionMode||''))throw new Error('Selecciona la modalidad de ejecución: Por contrata o Administración directa.');
 const executionMode=input.executionMode;
 const company=(field,label)=>{const v=input[field]??'';if(typeof v!=='string'||v.length>200)throw new Error(`${label}: utiliza hasta 200 caracteres.`);if(input.profileSchema==='11'&&!v.trim())throw new Error(`Completa ${label}.`);return v.trim();};
 return {executionMode,resident:name(input.resident,'Residente'),supervisor:executionMode==='contrata'?name(input.supervisor,'Supervisor'):'',inspector:executionMode==='administracion-directa'?name(input.inspector,'Inspector'):'',contractorCompany:executionMode==='contrata'?company('contractorCompany','Empresa contratista'):'',supervisorCompany:executionMode==='contrata'?company('supervisorCompany','Empresa supervisora'):'',entity:executionMode==='administracion-directa'?company('entity','Entidad'):''};
}

export function profileFields(project={}){
 const mode=Object.hasOwn(executionModes,project.executionMode||'')?project.executionMode:'',contract=mode==='contrata',direct=mode==='administracion-directa';
 return `<input type="hidden" name="profileSchema" value="11"><label class="wide">Modalidad de ejecución<select name="executionMode" required data-execution-mode><option value="" ${mode?'':'selected'} disabled>Selecciona una modalidad</option>${Object.entries(executionModes).map(([value,label])=>`<option value="${value}" ${mode===value?'selected':''}>${label}</option>`).join('')}</select></label><div class="form-grid wide execution-roles" data-project-roles ${mode?'':'hidden'}><label data-role-field="contractorCompany" ${contract?'':'hidden'}>Empresa contratista<input name="contractorCompany" maxlength="200" value="${esc(project.contractorCompany||'')}" ${contract?'required':'disabled'}></label><label data-role-field="supervisorCompany" ${contract?'':'hidden'}>Empresa supervisora<input name="supervisorCompany" maxlength="200" value="${esc(project.supervisorCompany||'')}" ${contract?'required':'disabled'}></label><label class="wide" data-role-field="entity" ${direct?'':'hidden'}>Entidad<input name="entity" maxlength="200" value="${esc(project.entity||'')}" ${direct?'required':'disabled'}></label><label>Residente<input name="resident" maxlength="100" placeholder="Nombre completo del residente" value="${esc(project.resident||'')}" ${mode?'required':'disabled'} autocomplete="off"></label><label data-role-field="supervisor" ${contract?'':'hidden'}>Supervisor<input name="supervisor" maxlength="100" placeholder="Nombre completo del supervisor" value="${esc(project.supervisor||'')}" ${contract?'required':'disabled'} autocomplete="off"></label><label data-role-field="inspector" ${direct?'':'hidden'}>Inspector<input name="inspector" maxlength="100" placeholder="Nombre completo del inspector" value="${esc(project.inspector||'')}" ${direct?'required':'disabled'} autocomplete="off"></label></div>`;
}

export function syncProfileFields(form){
 if(!form)return;const mode=form.elements.executionMode?.value,valid=Object.hasOwn(executionModes,mode||''),group=form.querySelector('[data-project-roles]');if(group)group.hidden=!valid;
 for(const field of ['resident','supervisor','inspector','contractorCompany','supervisorCompany','entity']){const input=form.elements[field];if(!input)continue;const active=valid&&(field==='resident'||['supervisor','contractorCompany','supervisorCompany'].includes(field)&&mode==='contrata'||['inspector','entity'].includes(field)&&mode==='administracion-directa');input.disabled=!active;input.required=active;const label=form.querySelector(`[data-role-field="${field}"]`);if(label)label.hidden=!active;}
}

export function profileRows(project){
 const mode=project.executionMode;
 return [['CUI',project.cui||'Sin CUI registrado'],...(mode==='contrata'?[['Empresa contratista',project.contractorCompany||'Pendiente de completar'],['Empresa supervisora',project.supervisorCompany||'Pendiente de completar']]:[['Entidad',project.entity||'Pendiente de completar']]),['Modalidad de ejecución',executionModes[mode]||'Pendiente de completar'],['Residente',project.resident||'Pendiente de completar'],[mode==='administracion-directa'?'Inspector':'Supervisor',mode==='administracion-directa'?(project.inspector||'Pendiente de completar'):(project.supervisor||'Pendiente de completar')]];
}

export function profileSummary(project){return `<div class="project-team" aria-label="Modalidad y responsables de la obra">${profileRows(project).map(([label,value])=>`<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>`;}
