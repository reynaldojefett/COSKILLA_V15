import {fail} from '../../public/domain.mjs';
// Adaptador de proveedor de IA. El resto de la plataforma solo conoce generateJson().
// Las claves viven únicamente en .env del servidor; nunca se envían al navegador.
const defaults={anthropic:'claude-sonnet-5-5',openai:'gpt-4.1-mini'};
const clean=v=>String(v||'').trim();
export function resolveProvider(env=process.env){
 const keys={anthropic:clean(env.ANTHROPIC_API_KEY),openai:clean(env.OPENAI_API_KEY)},wanted=clean(env.AI_PROVIDER).toLowerCase();
 const name=wanted?(keys[wanted]?wanted:null):(keys.anthropic?'anthropic':keys.openai?'openai':null);
 if(!name)return null;
 return {name,key:keys[name],model:clean(env[name==='anthropic'?'ANTHROPIC_MODEL':'OPENAI_MODEL'])||defaults[name]};
}
export const providerInfo=env=>{const p=resolveProvider(env);return {configured:!!p,provider:p?.name||null,model:p?.model||null};};
async function rejected(response){
 const body=await response.text().catch(()=>'');
 if(response.status===401||response.status===403)fail('La clave de IA fue rechazada. Revisa la clave en el archivo .env y reinicia COSKILLA.');
 if(response.status===402||/credit|balance|billing|quota|insufficient/i.test(body))fail('La cuenta del proveedor de IA no tiene saldo o alcanzó su límite de gasto. Revisa el saldo en su panel.');
 if(response.status===429)fail('El proveedor de IA limitó las solicitudes. Espera un minuto y reintenta.');
 if(response.status===404)fail('El modelo configurado no está disponible en tu cuenta. Revisa ANTHROPIC_MODEL u OPENAI_MODEL en .env.');
 if(response.status>=500)fail('El proveedor de IA no está disponible por ahora. Reintenta en unos minutos.');
 fail(`La API de IA respondió ${response.status}. Revisa el modelo y la configuración. No se guardó ningún análisis.`);
}
async function send(fetcher,url,options){
 try{return await fetcher(url,{...options,signal:AbortSignal.timeout(90000)});}
 catch(error){if(error.name==='TimeoutError')fail('La IA tardó demasiado en responder. Reintenta.');fail('No se pudo conectar con el proveedor de IA. Revisa tu conexión a internet.');}
}
// Devuelve siempre {data, usage:{input,output}, model, requestId}. data es un objeto JSON que cumple "schema".
export async function generateJson({provider,system,user,schema,schemaName,maxTokens=4000,fetcher=fetch}){
 if(!provider)fail('IA no configurada. Agrega ANTHROPIC_API_KEY u OPENAI_API_KEY en .env y reinicia COSKILLA.');
 if(provider.name==='anthropic'){
  const response=await send(fetcher,'https://api.anthropic.com/v1/messages',{method:'POST',headers:{'x-api-key':provider.key,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify({model:provider.model,max_tokens:maxTokens,system,messages:[{role:'user',content:user}],output_config:{format:{type:'json_schema',schema}}})});
  if(!response.ok)await rejected(response);
  const body=await response.json();if(body.stop_reason==='max_tokens'||body.stop_reason==='refusal')fail('La IA no completó el análisis.');let data;try{data=JSON.parse((body.content||[]).filter(c=>c.type==='text').map(c=>c.text).join(''));}catch{fail('La IA no devolvió una propuesta estructurada. Reintenta.');}
  return {data,usage:{input:body.usage?.input_tokens||0,output:body.usage?.output_tokens||0},model:body.model||provider.model,requestId:body.id||null};
 }
 const response=await send(fetcher,'https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${provider.key}`,'Content-Type':'application/json'},body:JSON.stringify({model:provider.model,store:false,instructions:system,input:[{role:'user',content:[{type:'input_text',text:user}]}],text:{format:{type:'json_schema',name:schemaName,strict:true,schema}},max_output_tokens:maxTokens})});
 if(!response.ok)await rejected(response);
 const body=await response.json();if(body.status==='incomplete')fail('La IA no completó el análisis.');const output=(body.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('');
 let data;try{data=JSON.parse(output);}catch{fail('La IA no devolvió una propuesta completa. Reintenta.');}
 return {data,usage:{input:body.usage?.input_tokens||0,output:body.usage?.output_tokens||0},model:body.model||provider.model,requestId:body.id||null};
}
