import {mkdir,readFile,writeFile,rename,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function createStore(directory) {
  await mkdir(directory,{recursive:true}); const file=join(directory,'coskilla.json');
  let state;try{state=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw new Error('No se pudo leer la base. Conserva el archivo y recupera su copia de seguridad.');state={schema:1,revision:0,projects:[],reports:[],events:[]};}
  let queue=Promise.resolve();
  return {read:()=>structuredClone(state),change(fn){const task=queue.then(async()=>{const next=structuredClone(state);const value=await fn(next);next.revision++;await writeFile(file+'.tmp',JSON.stringify(next));try{await copyFile(file,file+'.bak');}catch(e){if(e.code!=='ENOENT')throw e;}await rename(file+'.tmp',file);state=next;return value;});queue=task.catch(()=>{});return task;}};
}
