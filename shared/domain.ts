import { z } from 'zod';
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v + 'T00:00:00Z').toISOString().slice(0,10) === v, 'Fecha inválida');
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const amountSchema = z.number().int().min(0).max(100_000_000_00);
export const idSchema = z.string().uuid();
export const guestSchema = z.object({ name: z.string().trim().min(2).max(100), phone: z.string().trim().min(6).max(40), notes: z.string().trim().max(2000).default('') });
export const rateSchema = z.object({ effective_from: dateSchema, nightly: amountSchema.refine(v => v > 0), weekly: amountSchema.refine(v => v > 0), label: z.string().trim().min(1).max(100) });
export const reservationSchema = z.object({
  guest_id: idSchema, arrival: dateSchema, departure: dateSchema, arrival_time: timeSchema, departure_time: timeSchema,
  persons: z.number().int().min(1).max(20), mode: z.enum(['night','week','fortnight','combined']), base: z.enum(['week','fortnight']).default('week'),
  nightly: amountSchema, weekly: amountSchema, guarantee: amountSchema, notes: z.string().trim().max(3000).default(''), version: z.number().int().min(1).optional()
}).superRefine((v, ctx) => { try { calculatePrice(v); } catch (e) { ctx.addIssue({ code: 'custom', message: (e as Error).message }); } });
export const paymentSchema = z.object({ id: idSchema, kind: z.enum(['rent','deposit','deposit_refund','rent_refund']), amount: amountSchema.refine(v=>v>0), date: dateSchema, method: z.enum(['Transferencia','Efectivo','Otro']), notes: z.string().trim().max(1000).default('') });
export const blockSchema = z.object({ arrival: dateSchema, departure: dateSchema, reason: z.string().trim().min(2).max(200) }).refine(v=>v.departure>v.arrival, 'La fecha de fin debe ser posterior al inicio');
export type Mode = 'night'|'week'|'fortnight'|'combined';
export interface PriceInput { arrival:string; departure:string; mode:Mode; base?:'week'|'fortnight'; nightly:number; weekly:number }
export function nightsBetween(a:string,b:string) { return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000); }
export function calculatePrice(v:PriceInput) {
  const nights=nightsBetween(v.arrival,v.departure);
  if (!Number.isFinite(nights)||nights<1||nights>365) throw new Error('La estadía debe durar entre 1 y 365 noches.');
  if (![v.nightly,v.weekly].every(x=>Number.isSafeInteger(x)&&x>=0)) throw new Error('Tarifa inválida.');
  let total:number; let description:string;
  if(v.mode==='night') { if(!v.nightly) throw new Error('Ingresá una tarifa por noche.'); total=nights*v.nightly;description=`${nights} noche${nights===1?'':'s'}`; }
  else { if(!v.weekly) throw new Error('Ingresá una tarifa semanal.');
    const fortnight=v.mode==='fortnight'||(v.mode==='combined'&&v.base==='fortnight');
    const baseNights=fortnight?13:6; const weeks=fortnight?2:1;
    if(v.mode!=='combined'&&nights!==baseNights) throw new Error(`Este paquete requiere ${baseNights} noches.`);
    const extras=nights-baseNights;
    if(extras<0) throw new Error(`El paquete base requiere al menos ${baseNights} noches.`);
    if(extras>0&&!v.nightly) throw new Error('Ingresá una tarifa para las noches adicionales.');
    total=weeks*v.weekly+extras*v.nightly;
    description=`${fortnight?'1 quincena (2 tarifas semanales)':'1 semana'}${extras?` + ${extras} noche${extras===1?'':'s'}`:''}`;
  }
  if(!Number.isSafeInteger(total)||total>100_000_000_00) throw new Error('El importe es demasiado grande.');
  return { nights,total,description };
}
export function overlaps(a:string,b:string,c:string,d:string) { return a<d&&b>c; }
export interface Guest { id:string; name:string;phone:string;notes:string;created_at:string }
export interface Reservation extends z.infer<typeof reservationSchema> { id:string;total:number;status:'confirmed'|'cancelled'; cancellation_reason:string|null;created_at:string;version:number }
export interface Payment extends z.infer<typeof paymentSchema> {reservation_id:string;created_at:string}
export interface Rate extends z.infer<typeof rateSchema> {id:string;created_at:string}
export interface Block extends z.infer<typeof blockSchema> {id:string;active:number}
export interface Device {id:string;name:string;created_at:string;current:boolean}
export interface Data {guests:Guest[];reservations:Reservation[];payments:Payment[];rates:Rate[];blocks:Block[];devices:Device[]}
export function balance(r:Reservation,p:Payment[]) { const entries=p.filter(x=>x.reservation_id===r.id); const rent=entries.reduce((s,x)=>s+(x.kind==='rent'?x.amount:x.kind==='rent_refund'?-x.amount:0),0); const deposit=entries.reduce((s,x)=>s+(x.kind==='deposit'?x.amount:x.kind==='deposit_refund'?-x.amount:0),0);return {rent,pending:r.total-rent,deposit}; }
export const money=(cents:number)=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:cents%100?2:0}).format(cents/100);
export function todayAR(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
