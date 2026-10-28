import {createApp as localApplication} from './server.mjs';
export const createPlatform=options=>localApplication(options);
import http from 'node:http';
import {randomBytes,randomUUID,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {join,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStore} from './lib/store.mjs';
import {createApp} from './server.mjs';
const root=fileURLToPath(new URL('.',import.meta.url)),scrypt=promisify(scryptCallback),cost={N:131072,r:8,p:1,maxmem:192*1024*1024},hour=3600000;
const hashToken=value=>createHash('sha256').update(value).digest('hex');
const cleanUser=u=>({id:u.id,name:u.name,username:u.username,role:u.role,active:u.active,mustChange:!!u.mustChange,createdAt:u.createdAt});
function username(v){const s=String(v||'').trim().toLowerCase();if(!/^[a-z0-9][a-z0-9._@+-]{2,99}$/.test(s))throw new Error('Usa un usuario de 3 a 100 caracteres, sin espacios.');return s;}
function name(v){const s=String(v||'').trim();if(!s||s.length>100)throw new Error('Completa el nombre, hasta 100 caracteres.');return s;}
function password(v){if(typeof v!=='string'||v.length<12||v.length>128)throw new Error('La contraseña debe tener de 12 a 128 caracteres.');return v;}
async function passwordRecord(v){password(v);const salt=randomBytes(32).toString('hex'),key=await scrypt(v,salt,64,cost);return {salt,hash:key.toString('hex')};}
async function matches(v,record){const key=await scrypt(String(v||'').slice(0,129),record?.salt||'invalid-account-fixed-salt',64,cost),stored=Buffer.from(record?.hash||'00'.repeat(64),'hex');return stored.length===key.length&&timingSafeEqual(stored,key);}
async function dormantAccountPlatform({dataDir=join(root,'data'),env=process.env}={}){
 const access=await createStore(join(dataDir,'access')),sessions=new Map(),cores=new Map(),failures=new Map();let hashing=0;
 if(!access.read().users)await access.change(s=>{s.users=[];s.settings={publicAccess:false};s.audit=[];});
 let publicURL=null;if(env.COSKILLA_PUBLIC_URL||access.read().settings.publicURL){publicURL=new URL(env.COSKILLA_PUBLIC_URL||access.read().settings.publicURL);if(publicURL.protocol!=='https:'||publicURL.pathname!=='/'||publicURL.search||publicURL.hash||publicURL.username||publicURL.password)throw new Error('COSKILLA_PUBLIC_URL debe ser un origen HTTPS, sin ruta ni credenciales.');}
 const audit=(s,action,actor,detail='')=>s.audit.push({id:randomUUID(),at:new Date().toISOString(),action,actor,detail});
 const json=(res,code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 const redirect=(res,path)=>{res.writeHead(302,{Location:path,'Cache-Control':'no-store'});res.end();};
 async function body(req){if(!req.headers['content-type']?.startsWith('application/json'))throw new Error('Formato no permitido.');let size=0,parts=[];for await(const p of req){size+=p.length;if(size>12000)throw new Error('La solicitud es demasiado grande.');parts.push(p);}return JSON.parse(Buffer.concat(parts).toString('utf8'));}
 function revoke(userId){for(const [key,s]of sessions)if(!userId||s.userId===userId)sessions.delete(key);}
 async function core(userId){if(!cores.has(userId)){const owner=access.read().users.find(u=>u.id===userId)?.role==='owner';cores.set(userId,createApp({dataDir:owner?dataDir:join(dataDir,'clients',userId),env,accountMode:true}));}return cores.get(userId);}
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  try{
   const local=/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||''),remote=publicURL&&req.headers.host===publicURL.host;if(!local&&!remote)return json(res,403,{error:'Este dominio no está autorizado en la computadora propietaria.'});
   const origin=local?'http://'+req.headers.host:publicURL.origin,url=new URL(req.url,origin),path=url.pathname;if(remote){if(req.headers['x-forwarded-proto']!=='https')return redirect(res,publicURL.origin+url.pathname+url.search);res.setHeader('Strict-Transport-Security','max-age=31536000');}
   const cookies=String(req.headers.cookie||'').split(';').map(v=>v.trim()),token=cookies.find(v=>v.startsWith('coskilla_session='))?.slice(17),session=token?sessions.get(hashToken(token)):null,now=Date.now();let current=session&&session.expires>now&&session.last+hour>now?session:null;if(session&&!current)sessions.delete(hashToken(token));
   const s=access.read(),user=current?s.users.find(u=>u.id===current.userId&&u.active):null;if(!user)current=null;if(current)current.last=now;
   if(user?.role==='client'&&!s.settings.publicAccess){revoke(user.id);if(path==='/auth/me')return json(res,401,{error:'El propietario suspendió el acceso.'});if(!path.startsWith('/auth/'))return json(res,503,{error:'El propietario suspendió temporalmente la plataforma. Los datos se conservan.'});}
   if(req.method==='POST'){
    if(req.headers.origin!==origin)return json(res,403,{error:'Origen no permitido.'});
    if(!['/auth/login','/auth/setup'].includes(path)&&(!current||req.headers['x-coskilla-csrf']!==current.csrf))return json(res,403,{error:'La sesión cambió. Vuelve a ingresar.'});
   }
   const assets=new Map([['/auth/login.css','access/login.css'],['/auth/login.mjs','access/login.mjs'],['/auth/admin.mjs','access/admin.mjs'],['/auth/logo.jpg','assets/coskilla-logo.jpg'],['/auth/font.ttf','assets/fonts/PublicSans.ttf']]);
   if(req.method==='GET'&&assets.has(path)){const file=assets.get(path),bytes=await readFile(join(root,'public',file)),mime={'.css':'text/css','.mjs':'text/javascript','.jpg':'image/jpeg','.ttf':'font/ttf'};res.writeHead(200,{'Content-Type':mime[extname(file)]});return res.end(bytes);}
   if(req.method==='GET'&&(path==='/auth/ingreso'||path==='/auth/administracion')){
    if(path==='/auth/administracion'&&user?.role!=='owner')return redirect(res,'/auth/ingreso');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(await readFile(join(root,'public/access',path.endsWith('administracion')?'admin.html':'login.html')));
   }
   if(req.method==='GET'&&path==='/auth/status')return json(res,200,{configured:!!s.users.length,canSetup:local&&!s.users.length,publicConfigured:!!publicURL,publicAccess:s.settings.publicAccess,local});
   if(req.method==='GET'&&path==='/auth/me'){if(!user||!current)return json(res,401,{error:'Ingresa con tu cuenta.'});return json(res,200,{user:cleanUser(user),csrf:current.csrf,workspace:current.workspace||user.id,workspaceName:s.users.find(u=>u.id===(current.workspace||user.id))?.name||user.name,publicAccess:s.settings.publicAccess,publicURL:publicURL?.origin||null});}
   if(req.method==='POST'&&(path==='/auth/setup'||path==='/auth/login')){
    if(path==='/auth/setup'&&(!local||s.users.length))return json(res,403,{error:'La cuenta propietaria solo puede configurarse una vez desde esta computadora.'});
    const input=await body(req),key=(remote?req.headers['cf-connecting-ip']||'public':'local')+'|'+String(input.username).toLowerCase(),limit=failures.get(key);if(limit&&limit.until>now&&limit.count>=5)return json(res,429,{error:'Demasiados intentos. Espera 15 minutos antes de volver a intentar.'});
    if(hashing>=2)return json(res,429,{error:'Hay otros ingresos en curso. Reintenta en unos segundos.'});hashing++;
    try{
     let found;if(path==='/auth/setup'){const uname=username(input.username),record=await passwordRecord(input.password);found={id:randomUUID(),username:uname,name:name(input.name),password:record,role:'owner',active:true,createdAt:new Date().toISOString()};await access.change(a=>{if(a.users.length)throw new Error('La cuenta propietaria ya está configurada.');a.users.push(found);audit(a,'Cuenta propietaria creada',found.id);});}
     else{found=s.users.find(u=>u.username===String(input.username||'').trim().toLowerCase());const valid=await matches(input.password,found?.password);if(!valid||!found?.active||(found.role==='client'&&!s.settings.publicAccess)){const old=limit&&limit.until>now?limit:{count:0,until:now+15*60000};failures.set(key,{...old,count:old.count+1});if(failures.size>3000)failures.delete(failures.keys().next().value);return json(res,401,{error:'No se pudo ingresar. Revisa tus datos o consulta al administrador.'});}}
     failures.delete(key);const value=randomBytes(32).toString('hex'),entry={userId:found.id,workspace:found.id,csrf:randomBytes(32).toString('hex'),last:now,expires:now+8*hour};for(const [key,v]of sessions)if(v.expires<now||v.last+hour<now)sessions.delete(key);sessions.set(hashToken(value),entry);res.setHeader('Set-Cookie',`coskilla_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${remote?'; Secure':''}`);return json(res,200,{user:cleanUser(found),next:found.role==='owner'?'/auth/administracion':found.mustChange?'/auth/ingreso':'/'});
    }finally{hashing--;}
   }
   if(!user||!current){if(path.startsWith('/api/')||path.startsWith('/auth/'))return json(res,401,{error:'Ingresa con tu cuenta.'});return redirect(res,'/auth/ingreso');}
   if(req.method==='POST'&&path==='/auth/logout'){sessions.delete(hashToken(token));res.setHeader('Set-Cookie','coskilla_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'+(remote?'; Secure':''));return json(res,200,{ok:true});}
   if(req.method==='POST'&&path==='/auth/password'){const input=await body(req);if(!await matches(input.currentPassword,user.password))return json(res,400,{error:'La contraseña actual no coincide.'});const record=await passwordRecord(input.password);await access.change(a=>{const u=a.users.find(u=>u.id===user.id);u.password=record;u.mustChange=false;audit(a,'Contraseña actualizada',u.id);});revoke(user.id);res.setHeader('Set-Cookie','coskilla_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'+(remote?'; Secure':''));return json(res,200,{ok:true});}
   if(path.startsWith('/auth/admin')){
    if(user.role!=='owner')return json(res,403,{error:'Esta función pertenece al propietario.'});
    if(req.method==='GET'&&path==='/auth/admin/state')return json(res,200,{users:s.users.map(cleanUser),publicAccess:s.settings.publicAccess,publicURL:publicURL?.origin||null,audit:s.audit.slice(-30).reverse()});
    const input=await body(req);
    if(path==='/auth/admin/users'&&req.method==='POST'){const uname=username(input.username),record=await passwordRecord(input.password),created={id:randomUUID(),name:name(input.name),username:uname,password:record,role:'client',active:true,mustChange:true,createdAt:new Date().toISOString()};await access.change(a=>{if(a.users.some(u=>u.username===uname))throw new Error('Ese usuario ya existe.');a.users.push(created);audit(a,'Cliente creado',user.id,created.username);});return json(res,200,{user:cleanUser(created)});}
    if(path==='/auth/admin/user-status'&&req.method==='POST'){if(typeof input.active!=='boolean')throw new Error('Selecciona el estado de la cuenta.');await access.change(a=>{const u=a.users.find(u=>u.id===input.id&&u.role==='client');if(!u)throw new Error('Cliente no encontrado.');u.active=input.active;audit(a,u.active?'Cliente habilitado':'Cliente bloqueado',user.id,u.username);});revoke(input.id);return json(res,200,{ok:true});}
    if(path==='/auth/admin/reset-password'&&req.method==='POST'){const record=await passwordRecord(input.password);await access.change(a=>{const u=a.users.find(u=>u.id===input.id&&u.role==='client');if(!u)throw new Error('Cliente no encontrado.');u.password=record;u.mustChange=true;audit(a,'Contraseña temporal renovada',user.id,u.username);});revoke(input.id);return json(res,200,{ok:true});}
    if(path==='/auth/admin/domain'&&req.method==='POST'){if(!local)return json(res,403,{error:'Configura el dominio desde la computadora propietaria.'});const value=String(input.url||'').trim(),next=value?new URL(value):null;if(next&&(next.protocol!=='https:'||next.pathname!=='/'||next.search||next.hash||next.username||next.password||/^(localhost|127\.|10\.|192\.168\.)/i.test(next.hostname)))throw new Error('Escribe solo el dominio HTTPS público, sin rutas.');await access.change(a=>{a.settings.publicURL=next?.origin||null;audit(a,'Dominio público actualizado',user.id,next?.origin||'Sin dominio');});publicURL=next;for(const [key,v]of sessions)if(v.userId!==user.id)sessions.delete(key);return json(res,200,{ok:true});}
    if(path==='/auth/admin/platform'&&req.method==='POST'){if(typeof input.enabled!=='boolean')throw new Error('Selecciona el estado de la plataforma.');await access.change(a=>{a.settings.publicAccess=input.enabled;audit(a,input.enabled?'Plataforma habilitada':'Plataforma suspendida',user.id);});for(const [key,v]of sessions)if(v.userId!==user.id)sessions.delete(key);return json(res,200,{ok:true});}
    if(path==='/auth/admin/workspace'&&req.method==='POST'){if(!s.users.some(u=>u.id===input.id))throw new Error('Espacio no encontrado.');current.workspace=input.id;return json(res,200,{ok:true,next:'/'});}
    return json(res,404,{error:'Función no encontrada.'});
   }
   if(user.mustChange)return path.startsWith('/api/')?json(res,403,{error:'Cambia tu contraseña temporal antes de abrir las obras.'}):redirect(res,'/auth/ingreso');
   if(path.startsWith('/auth/'))return json(res,404,{error:'No encontrado.'});
   const selected=user.role==='owner'?current.workspace:user.id,app=await core(selected);req.headers.host='127.0.0.1';if(req.headers.origin)req.headers.origin='http://127.0.0.1';app.server.emit('request',req,res);
  }catch(error){json(res,400,{error:error.message||'No se pudo completar la solicitud.'});}
 });
 return {server,access,cores};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const {server}=await createPlatform();server.listen(Number(process.env.PORT||8890),'127.0.0.1',()=>console.log('COSKILLA con cuentas: http://127.0.0.1:'+Number(process.env.PORT||8890)));}
