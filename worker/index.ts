import { z } from 'zod';
import { authRoute, body, HttpError, json, requireSession, sameOrigin } from './auth';
import type { Env } from './auth';
import { reservationSchema,guestSchema,paymentSchema,rateSchema,blockSchema,idSchema,calculateAutomaticPrice } from '../shared/domain';
const secureHeaders={'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Strict-Transport-Security':'max-age=31536000'};
async function route(req:Request,env:Env){
  const path=new URL(req.url).pathname;
  if(!path.startsWith('/api/'))return env.ASSETS.fetch(req);
  sameOrigin(req,env);
  const edgeKey=req.headers.get('CF-Connecting-IP')||'local';
  if(!(await env.API_LIMIT.limit({key:'edge:'+edgeKey})).success)throw new HttpError(429,'Demasiadas solicitudes. Esperá un minuto.');
  const auth=path.startsWith('/api/auth/');
  if(auth){const key=req.headers.get('CF-Connecting-IP')||'local';if(!(await env.AUTH_LIMIT.limit({key})).success)throw new HttpError(429,'Demasiados intentos. Esperá un minuto.');return authRoute(req,env,path);}
  const s=await requireSession(req,env);
  if(!(await env.API_LIMIT.limit({key:s.credential_id})).success)throw new HttpError(429,'Demasiadas operaciones. Esperá un minuto.');
  if(path==='/api/data'&&req.method==='GET'){
    const [guests,reservations,payments,rates,blocks,devices]=await Promise.all([
      env.DB.prepare('SELECT * FROM guests ORDER BY name COLLATE NOCASE').all(),
      env.DB.prepare('SELECT * FROM reservations ORDER BY arrival DESC').all(),
      env.DB.prepare('SELECT * FROM payments ORDER BY date,created_at').all(),
      env.DB.prepare('SELECT * FROM rates ORDER BY effective_from DESC').all(),
      env.DB.prepare('SELECT * FROM blocks WHERE active=1 ORDER BY arrival').all(),
      env.DB.prepare('SELECT id,name,created_at FROM credentials ORDER BY created_at').all<{id:string;name:string;created_at:string}>()
    ]);
    return json({guests:guests.results,reservations:reservations.results,payments:payments.results,rates:rates.results,blocks:blocks.results,devices:devices.results.map(c=>({...c,current:c.id===s.credential_id}))});
  }
  if(path==='/api/export'&&req.method==='GET'){
    const tables=['guests','reservations','payments','rates','blocks','audit'];
    const snapshot=await env.DB.batch(tables.map(t=>env.DB.prepare(`SELECT * FROM ${t}`)));
    const result=Object.fromEntries(tables.map((t,i)=>[t,snapshot[i].results]));
    return json({format:'gesell-backup',version:1,exported_at:new Date().toISOString(),...result},200,{'Content-Disposition':'attachment; filename="gesell-respaldo.json"'});
  }
  if(path==='/api/history'&&req.method==='GET'){
    const id=idSchema.parse(new URL(req.url).searchParams.get('id'));return json((await env.DB.prepare('SELECT action,previous,created_at FROM audit WHERE entity_id=? ORDER BY id DESC').bind(id).all()).results);
  }
  if(req.method!=='POST')throw new HttpError(405,'Método no permitido.');
  const b=await body(req);const id=crypto.randomUUID();
  if(path==='/api/guests'){
    const v=guestSchema.parse(b);
    if(b.id){const existing=idSchema.parse(b.id);const r=await env.DB.prepare('UPDATE guests SET name=?,phone=?,notes=? WHERE id=?').bind(v.name,v.phone,v.notes,existing).run();if(!r.meta.changes)throw new HttpError(404,'Huésped no encontrado.');return json({id:existing});}
    await env.DB.prepare('INSERT INTO guests(id,name,phone,notes) VALUES(?,?,?,?)').bind(id,v.name,v.phone,v.notes).run();return json({id},201);
  }
  if(path==='/api/reservations'){
    const parsed=reservationSchema.parse(b);const price=calculateAutomaticPrice(parsed);const v={...parsed,mode:price.mode,base:price.base};
    if(b.id){
      const existing=idSchema.parse(b.id);if(!v.version)throw new HttpError(400,'Falta la versión de la reserva.');
      const r=await env.DB.prepare("UPDATE reservations SET guest_id=?,arrival=?,departure=?,arrival_time=?,departure_time=?,persons=?,mode=?,base=?,nightly=?,weekly=?,total=?,guarantee=?,notes=?,version=version+1 WHERE id=? AND version=? AND status='confirmed'").bind(v.guest_id,v.arrival,v.departure,v.arrival_time,v.departure_time,v.persons,v.mode,v.base,v.nightly,v.weekly,price.total,v.guarantee,v.notes,existing,v.version).run();
      if(!r.meta.changes)throw new HttpError(409,'La reserva cambió en otro dispositivo o está cancelada. Actualizá antes de editar.');return json({id:existing});
    }
    await env.DB.prepare('INSERT INTO reservations(id,guest_id,arrival,departure,arrival_time,departure_time,persons,mode,base,nightly,weekly,total,guarantee,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,v.guest_id,v.arrival,v.departure,v.arrival_time,v.departure_time,v.persons,v.mode,v.base,v.nightly,v.weekly,price.total,v.guarantee,v.notes).run();return json({id},201);
  }
  if(path==='/api/reservations/cancel'){
    const v=z.object({id:idSchema,version:z.number().int().positive(),reason:z.string().trim().min(3).max(1000)}).parse(b);
    const r=await env.DB.prepare("UPDATE reservations SET status='cancelled',cancellation_reason=?,version=version+1 WHERE id=? AND version=? AND status='confirmed'").bind(v.reason,v.id,v.version).run();if(!r.meta.changes)throw new HttpError(409,'La reserva cambió. Actualizá y volvé a intentar.');return json({ok:true});
  }
  if(path==='/api/payments'){
    const v=paymentSchema.parse(b);const reservation=idSchema.parse(b.reservation_id);
    const existing=await env.DB.prepare('SELECT * FROM payments WHERE id=?').bind(v.id).first<Record<string,unknown>>();
    if(existing){if(existing.reservation_id!==reservation||Object.entries(v).some(([k,val])=>existing[k]!==val))throw new HttpError(409,'Este identificador de pago ya se utilizó.');return json({id:v.id});}
    try{await env.DB.prepare('INSERT INTO payments(id,reservation_id,kind,amount,date,method,notes) VALUES(?,?,?,?,?,?,?)').bind(v.id,reservation,v.kind,v.amount,v.date,v.method,v.notes).run();}
    catch(e){if(String(e).includes('UNIQUE constraint failed: payments.id')){const row=await env.DB.prepare('SELECT * FROM payments WHERE id=?').bind(v.id).first<Record<string,unknown>>();if(row&&row.reservation_id===reservation&&Object.entries(v).every(([k,val])=>row[k]===val))return json({id:v.id});}throw e;}
    return json({id:v.id},201);
  }
  if(path==='/api/rates'){
    const v=rateSchema.parse(b);await env.DB.prepare('INSERT INTO rates(id,effective_from,nightly,weekly,label) VALUES(?,?,?,?,?)').bind(id,v.effective_from,v.nightly,v.weekly,v.label).run();return json({id},201);
  }
  if(path==='/api/blocks'){
    const v=blockSchema.parse(b);await env.DB.prepare('INSERT INTO blocks(id,arrival,departure,reason) VALUES(?,?,?,?)').bind(id,v.arrival,v.departure,v.reason).run();return json({id},201);
  }
  if(path==='/api/blocks/release'){
    const existing=idSchema.parse(b.id);await env.DB.prepare('UPDATE blocks SET active=0 WHERE id=?').bind(existing).run();return json({ok:true});
  }
  throw new HttpError(404,'Acción no encontrada.');
}
function errorResponse(e:unknown){
  if(e instanceof HttpError)return json({error:e.message},e.status);
  if(e instanceof z.ZodError)return json({error:e.issues[0]?.message||'Revisá los datos ingresados.'},400);
  const message=String(e);
  const errors:Record<string,string>={RESERVATION_OVERLAP:'Estas fechas se superponen con otra reserva.',BLOCK_OVERLAP:'Estas fechas están bloqueadas.',PAYMENT_EXCEEDS_TOTAL:'El pago supera el saldo pendiente.',REFUND_EXCEEDS_COLLECTED:'La devolución supera el importe recibido.',DEPOSIT_EXCEEDS_TOTAL:'El ingreso supera la garantía acordada.',RESERVATION_CANCELLED:'La reserva está cancelada. Solo podés registrar devoluciones.',TOTAL_BELOW_COLLECTED:'El nuevo total es menor al importe ya cobrado.',DEPOSIT_BELOW_COLLECTED:'La garantía es menor al importe que tenés recibido.'};
  for(const [key,value] of Object.entries(errors))if(message.includes(key))return json({error:value},409);
  if(message.includes('UNIQUE constraint failed: rates.effective_from'))return json({error:'Ya existe una tarifa para esa fecha de vigencia. Usá otra fecha.'},409);
  if(message.includes('FOREIGN KEY'))return json({error:'El huésped o la reserva ya no están disponibles. Actualizá los datos.'},409);
  console.error('Request failed',e instanceof Error?e.name:'UnknownError');return json({error:'No se pudo completar la operación. Volvé a intentarlo.'},500);
}
export default {async fetch(req:Request,env:Env):Promise<Response>{
  let response:Response;try{response=await route(req,env);}catch(e){response=errorResponse(e);}
  if(new URL(req.url).pathname.startsWith('/api/')){const r=new Response(response.body,response);for(const [k,v]of Object.entries(secureHeaders))r.headers.set(k,v);if(r.status===429)r.headers.set('Retry-After','60');return r;}return response;
}} satisfies ExportedHandler<Env>;
