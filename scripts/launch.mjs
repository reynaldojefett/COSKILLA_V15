import {spawn} from 'node:child_process';
import {createApp} from '../server.mjs';
const major=Number(process.versions.node.split('.')[0]);if(major<22){console.error('Necesitas Node.js 22 o posterior; recomendamos Node.js 24 LTS.');process.exit(1);}
if(process.argv.includes('--check')){console.log('Archivos de inicio completos. Node.js '+process.versions.node+'. COSKILLA puede iniciarse desde esta carpeta.');process.exit(0);}
const {server}=await createApp(),port=Number(process.env.PORT||8890),url=`http://127.0.0.1:${port}`;
function open(){if(process.platform==='win32'){const child=spawn('explorer.exe',[url],{windowsHide:true,stdio:'ignore'});child.on('error',()=>console.log('Abre '+url+' en tu navegador.'));}else console.log('Abre '+url+' en tu navegador.');}
server.on('error',e=>{if(e.code==='EADDRINUSE'){console.log('Ya hay un servidor en '+url+'. Si es COSKILLA, puedes usar esa ventana.');open();}else{console.error(e.message);process.exitCode=1;}});
server.listen(port,'127.0.0.1',()=>{console.log('COSKILLA: '+url+'\nAcceso local sin cuentas. Datos en la carpeta data de esta computadora.\nCtrl+C para detener.');open();});
