import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON, AuthenticatorTransport } from '@simplewebauthn/server';
import { z } from 'zod';
export interface Env { DB:D1Database; ASSETS:Fetcher; SITE_ORIGIN?:string; SETUP_TOKEN?:string; AUTH_LIMIT:RateLimit; API_LIMIT:RateLimit }
export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export const json=(value:unknown,status=200,headers:HeadersInit={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
export const token=()=>{const b=crypto.getRandomValues(new Uint8Array(32));return Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join('');};
export function originFor(req:Request,env:Env){
  if(env.SITE_ORIGIN) {const u=new URL(env.SITE_ORIGIN); if(u.protocol!=='https:'&&u.hostname!=='127.0.0.1'&&u.hostname!=='localhost')throw new HttpError(503,'Configuración de acceso inválida.');return u.origin;}
  const u=new URL(req.url); if(u.hostname==='127.0.0.1'||u.hostname==='localhost')return u.origin;
  throw new HttpError(503,'Falta configurar la dirección privada de la aplicación.');
}
export function sameOrigin(req:Request,env:Env){
  const origin=originFor(req,env);
  if(new URL(req.url).origin!==origin)throw new HttpError(403,'Dirección de acceso no autorizada.');
  if(req.headers.get('Sec-Fetch-Site')==='cross-site')throw new HttpError(403,'Solicitud no autorizada.');
  if(req.method!=='GET'&&req.headers.get('Origin')!==origin)throw new HttpError(403,'Origen de solicitud no autorizado.');
}
export async function body(req:Request):Promise<Record<string,unknown>>{
  if(!req.headers.get('Content-Type')?.startsWith('application/json'))throw new HttpError(415,'Formato de solicitud inválido.');
  if(Number(req.headers.get('Content-Length')||0)>16384)throw new HttpError(413,'Solicitud demasiado grande.');
  const reader=req.body?.getReader(); if(!reader)throw new HttpError(400,'Faltan datos.');
  let size=0; const chunks:Uint8Array[]=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();throw new HttpError(413,'Solicitud demasiado grande.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  try {const v:unknown=JSON.parse(new TextDecoder().decode(bytes));if(!v||typeof v!=='object'||Array.isArray(v))throw new Error();return v as Record<string,unknown>;}catch{throw new HttpError(400,'Datos inválidos.');}
}
interface Session {credential_id:string;token_hash:string;expires:number}
interface Credential {id:string;public_key:string;counter:number;transports:string;name:string}
export async function session(req:Request,env:Env):Promise<Session|null>{
  const value=req.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('vg_session='))?.slice(11);
  if(!value||!/^[a-f0-9]{64}$/.test(value))return null;
  return env.DB.prepare('SELECT token_hash,credential_id,expires FROM sessions WHERE token_hash=? AND expires>?').bind(await digest(value),Date.now()).first<Session>();
}
export async function requireSession(req:Request,env:Env){const s=await session(req,env);if(!s)throw new HttpError(401,'Habilitá este dispositivo para continuar.');return s;}
function cookie(req:Request,value:string,maxAge=30*86400){return `vg_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(req.url).protocol==='https:'?'; Secure':''}`;}
async function newSession(req:Request,env:Env,credential:string){const value=token();await env.DB.prepare('INSERT INTO sessions(token_hash,credential_id,expires) VALUES(?,?,?)').bind(await digest(value),credential,Date.now()+30*86400000).run();return json({ok:true},200,{'Set-Cookie':cookie(req,value)});}
async function saveChallenge(env:Env,challenge:string,kind:string,invite:string|null=null){
  const id=token();await env.DB.batch([
    env.DB.prepare('DELETE FROM challenges WHERE expires<?').bind(Date.now()),
    env.DB.prepare('DELETE FROM sessions WHERE expires<?').bind(Date.now()),
    env.DB.prepare('DELETE FROM invitations WHERE expires<?').bind(Date.now()),
    env.DB.prepare('INSERT INTO challenges(id,challenge,kind,expires,invite_hash) VALUES(?,?,?,?,?)').bind(id,challenge,kind,Date.now()+300000,invite)
  ]);return id;
}
async function consume(env:Env,id:unknown,kind:string){
  const valid=z.string().regex(/^[a-f0-9]{64}$/).parse(id);
  const row=await env.DB.prepare('DELETE FROM challenges WHERE id=? AND kind=? AND expires>? RETURNING challenge,invite_hash').bind(valid,kind,Date.now()).first<{challenge:string;invite_hash:string|null}>();
  if(!row)throw new HttpError(400,'La habilitación venció. Volvé a intentarlo.');return row;
}
const keyBytes=(v:string)=>Uint8Array.from(atob(v),c=>c.charCodeAt(0));
const keyString=(v:Uint8Array)=>btoa(String.fromCharCode(...v));
export async function authRoute(req:Request,env:Env,path:string){
  const origin=originFor(req,env);const rpID=new URL(origin).hostname;
  if(path==='/api/auth/status'&&req.method==='GET'){
    const s=await session(req,env); const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM credentials').first<{n:number}>();
    return json({authenticated:!!s,initialized:!!count?.n});
  }
  if(req.method!=='POST')throw new HttpError(405,'Método no permitido.');
  const b=await body(req);
  if(path==='/api/auth/register/options'){
    const code=z.string().min(16).max(128).parse(b.code);const hash=await digest(code);
    const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM credentials').first<{n:number}>();
    let invite:string|null=null;
    if(!count?.n){if(!env.SETUP_TOKEN||await digest(env.SETUP_TOKEN)!==hash)throw new HttpError(403,'Código de habilitación inválido.');}
    else {const i=await env.DB.prepare('SELECT token_hash FROM invitations WHERE token_hash=? AND expires>?').bind(hash,Date.now()).first();if(!i)throw new HttpError(403,'Código inválido o vencido.');invite=hash;}
    const options=await generateRegistrationOptions({rpName:'Gesell · Control de alquiler',rpID,userName:'Administración del departamento',userID:new TextEncoder().encode('gesell-private-administration'),attestationType:'none',authenticatorSelection:{residentKey:'required',userVerification:'required'},supportedAlgorithmIDs:[-7,-257]});
    return json({options,challengeId:await saveChallenge(env,options.challenge,'register',invite)});
  }
  if(path==='/api/auth/register/verify'){
    const challenge=await consume(env,b.challengeId,'register');
    const name=z.string().trim().min(2).max(60).parse(b.name);
    let verification;
    try{verification=await verifyRegistrationResponse({response:b.response as RegistrationResponseJSON,expectedChallenge:challenge.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true});}catch{throw new HttpError(400,'No se pudo verificar la llave de acceso.');}
    if(!verification.verified||!verification.registrationInfo)throw new HttpError(400,'No se pudo verificar la llave de acceso.');
    const c=verification.registrationInfo.credential;
    // La autorización de alta se consume dentro del INSERT: evita reutilizar invitaciones y carreras de primera habilitación.
    const result=challenge.invite_hash
      ? await env.DB.prepare('INSERT INTO credentials(id,public_key,counter,name,transports,enrollment_key) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM invitations WHERE token_hash=? AND expires>?)').bind(c.id,keyString(c.publicKey),c.counter,name,JSON.stringify(c.transports||[]),challenge.invite_hash,challenge.invite_hash,Date.now()).run()
      : await env.DB.prepare("INSERT INTO credentials(id,public_key,counter,name,transports,enrollment_key) SELECT ?,?,?,?,?,'initial' WHERE NOT EXISTS(SELECT 1 FROM credentials)").bind(c.id,keyString(c.publicKey),c.counter,name,JSON.stringify(c.transports||[])).run();
    if(!result.meta.changes)throw new HttpError(403,'Esta habilitación ya fue utilizada.');
    if(challenge.invite_hash)await env.DB.prepare('DELETE FROM invitations WHERE token_hash=?').bind(challenge.invite_hash).run();
    return newSession(req,env,c.id);
  }
  if(path==='/api/auth/login/options'){
    const options=await generateAuthenticationOptions({rpID,userVerification:'required'});
    return json({options,challengeId:await saveChallenge(env,options.challenge,'login')});
  }
  if(path==='/api/auth/login/verify'){
    const challenge=await consume(env,b.challengeId,'login');
    const response=b.response as AuthenticationResponseJSON;
    if(!response||typeof response.id!=='string')throw new HttpError(400,'Llave inválida.');
    const c=await env.DB.prepare('SELECT * FROM credentials WHERE id=?').bind(response.id).first<Credential>();
    if(!c)throw new HttpError(403,'Este acceso fue revocado o no está habilitado.');
    let verification;
    try{verification=await verifyAuthenticationResponse({response,expectedChallenge:challenge.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true,credential:{id:c.id,publicKey:keyBytes(c.public_key),counter:c.counter,transports:JSON.parse(c.transports) as AuthenticatorTransport[]}});}catch{throw new HttpError(403,'No se pudo verificar el acceso.');}
    if(!verification.verified)throw new HttpError(403,'Acceso inválido.');
    const updated=await env.DB.prepare('UPDATE credentials SET counter=? WHERE id=? AND counter=?').bind(verification.authenticationInfo.newCounter,c.id,c.counter).run();
    if(!updated.meta.changes)throw new HttpError(409,'El acceso cambió. Volvé a intentarlo.');
    return newSession(req,env,c.id);
  }
  if(path==='/api/auth/invite'){
    await requireSession(req,env);const value=token();await env.DB.prepare('INSERT INTO invitations(token_hash,expires) VALUES(?,?)').bind(await digest(value),Date.now()+600000).run();return json({code:value,expires:Date.now()+600000});
  }
  if(path==='/api/auth/logout'){
    const s=await requireSession(req,env);await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(s.token_hash).run();return json({ok:true},200,{'Set-Cookie':cookie(req,'',0)});
  }
  if(path==='/api/auth/revoke'){
    const s=await requireSession(req,env);const id=z.string().min(1).max(1500).parse(b.id);
    if(id===s.credential_id)throw new HttpError(400,'No podés revocar el acceso que estás utilizando.');
    await env.DB.prepare('DELETE FROM credentials WHERE id=?').bind(id).run();return json({ok:true});
  }
  throw new HttpError(404,'Acción no encontrada.');
}
