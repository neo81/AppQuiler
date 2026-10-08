// Genera SQL para una NUEVA base vacía. Nunca borra ni modifica la base original.
import {readFileSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {guestSchema,reservationSchema,paymentSchema,rateSchema,blockSchema,idSchema,calculatePrice,calculateAutomaticPrice,overlaps} from '../shared/domain.ts';
const [source,destination]=process.argv.slice(2);
if(!source||!destination)throw new Error('Uso: node scripts/restore-backup.mjs respaldo.json nueva-base.sql');
const raw=readFileSync(source,'utf8');if(Buffer.byteLength(raw)>30_000_000)throw new Error('Archivo demasiado grande.');
const backup=JSON.parse(raw);
if(backup.format!=='gesell-backup'||backup.version!==1)throw new Error('Formato de respaldo no compatible.');
const created=z.string().max(40);const guests=z.array(guestSchema.extend({id:idSchema,created_at:created})).max(100000).parse(backup.guests);
const reservations=z.array(reservationSchema.safeExtend({id:idSchema,total:z.number().int().positive(),status:z.enum(['confirmed','cancelled']),cancellation_reason:z.string().nullable(),version:z.number().int().positive(),created_at:created})).max(100000).parse(backup.reservations);
const payments=z.array(paymentSchema.extend({reservation_id:idSchema,created_at:created})).max(100000).parse(backup.payments);
const rates=z.array(rateSchema.extend({id:idSchema,created_at:created})).max(10000).parse(backup.rates);
const blocks=z.array(blockSchema.extend({id:idSchema,active:z.number().int().min(0).max(1)})).max(100000).parse(backup.blocks);
const audit=z.array(z.object({id:z.number().int().positive(),entity:z.enum(['reservation','guest','block']),entity_id:idSchema,action:z.enum(['edit','cancel','release']),previous:z.string().nullable(),created_at:created})).max(100000).parse(backup.audit);
const schema=readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8');const triggerIndex=schema.indexOf('CREATE TRIGGER');const base=schema.slice(0,triggerIndex),triggers=schema.slice(triggerIndex);
const db=new DatabaseSync(':memory:');db.exec(base);
const tables={guests,reservations,payments,rates,blocks,audit};const inserts=[];
const quote=v=>v===null?'NULL':typeof v==='number'?String(v):"'"+v.replaceAll("'","''")+"'";
db.exec('BEGIN');
for(const [table,rows] of Object.entries(tables))for(const row of rows){const columns=Object.keys(row);const values=Object.values(row);db.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`).run(...values);inserts.push(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${values.map(quote).join(',')});`);}
for(const r of reservations){let legacy;try{legacy=calculatePrice(r).total;}catch{}if(legacy!==r.total&&calculateAutomaticPrice(r).total!==r.total)throw new Error('Precio inconsistente en reserva '+r.id);}
const overlap=db.prepare("SELECT a.id FROM reservations a JOIN reservations b ON a.id<b.id AND a.status='confirmed' AND b.status='confirmed' AND a.arrival<b.departure AND a.departure>b.arrival LIMIT 1").get();
const blocked=db.prepare("SELECT r.id FROM reservations r JOIN blocks b ON r.status='confirmed' AND b.active=1 AND r.arrival<b.departure AND r.departure>b.arrival LIMIT 1").get();
const blockOverlap=db.prepare('SELECT a.id FROM blocks a JOIN blocks b ON a.id<b.id AND a.active=1 AND b.active=1 AND a.arrival<b.departure AND a.departure>b.arrival LIMIT 1').get();
if(overlap||blocked||blockOverlap)throw new Error('El respaldo contiene ocupaciones superpuestas.');
for(const r of reservations){const entries=payments.filter(p=>p.reservation_id===r.id);let rent=0,deposit=0;for(const p of entries){if(p.kind==='rent')rent+=p.amount;if(p.kind==='rent_refund')rent-=p.amount;if(p.kind==='deposit')deposit+=p.amount;if(p.kind==='deposit_refund')deposit-=p.amount;}if(rent<0||rent>r.total||deposit<0||deposit>r.guarantee)throw new Error('Movimientos inconsistentes en reserva '+r.id);}
db.exec(triggers);db.exec('COMMIT');db.close();
const migrationHistory="CREATE TABLE IF NOT EXISTS d1_migrations(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL);\nINSERT INTO d1_migrations(name) VALUES('0001_initial.sql');\n";
writeFileSync(destination,'-- Restaurar exclusivamente en una NUEVA base D1 vacía. No incluye llaves ni sesiones.\n'+base+'\n'+inserts.join('\n')+'\n'+triggers+'\n'+migrationHistory);
console.log('Respaldo validado. SQL generado para una base nueva y vacía. Rehabilitá los dispositivos después de restaurar.');
