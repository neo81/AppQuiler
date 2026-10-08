import {beforeEach,afterEach,describe,it,expect} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
let db:DatabaseSync;
beforeEach(()=>{db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));db.exec("INSERT INTO guests(id,name,phone) VALUES('guest','Lucía','1155550100')");});
afterEach(()=>db.close());
function reserve(id:string,arrival='2027-01-04',departure='2027-01-10'){db.prepare("INSERT INTO reservations(id,guest_id,arrival,departure,arrival_time,departure_time,persons,mode,base,nightly,weekly,total,guarantee) VALUES(?,'guest',?,?,'15:00','10:00',2,'week','week',11000000,70000000,70000000,10000000)").run(id,arrival,departure);}
function pay(id:string,kind:string,amount:number,r='r'){db.prepare("INSERT INTO payments(id,reservation_id,kind,amount,date,method) VALUES(?,?,?,?,'2026-10-08','Transferencia')").run(id,r,kind,amount);}
describe('Protección atómica en base de datos',()=>{
  it('rechaza superposiciones y acepta un ingreso en fecha de salida',()=>{reserve('r');expect(()=>reserve('overlap','2027-01-09','2027-01-15')).toThrow('RESERVATION_OVERLAP');reserve('next','2027-01-10','2027-01-16');expect(db.prepare('SELECT COUNT(*) n FROM reservations').get()?.n).toBe(2);});
  it('cancelar libera fechas y conserva pagos y auditoría',()=>{reserve('r');pay('p','rent',20000000);db.exec("UPDATE reservations SET status='cancelled',cancellation_reason='Cambio de planes',version=2 WHERE id='r'");reserve('new');expect(db.prepare('SELECT COUNT(*) n FROM payments').get()?.n).toBe(1);expect(db.prepare('SELECT action FROM audit').get()?.action).toBe('cancel');});
  it('no permite bloqueo sobre reserva ni reserva sobre bloqueo',()=>{reserve('r');expect(()=>db.exec("INSERT INTO blocks VALUES('b','2027-01-06','2027-01-08','Uso propio',1)")).toThrow('RESERVATION_OVERLAP');db.exec("INSERT INTO blocks VALUES('b','2027-02-01','2027-02-07','Uso propio',1)");expect(()=>reserve('b','2027-02-02','2027-02-08')).toThrow('BLOCK_OVERLAP');});
  it('impide cobros superiores al total y duplicados',()=>{reserve('r');pay('p','rent',20000000);expect(()=>pay('p','rent',20000000)).toThrow();expect(()=>pay('p2','rent',60000000)).toThrow('PAYMENT_EXCEEDS_TOTAL');});
  it('permite garantía y devolución parcial, sin sobregiro',()=>{reserve('r');pay('p','deposit',10000000);pay('d','deposit_refund',4000000);expect(()=>pay('d2','deposit_refund',7000000)).toThrow('REFUND_EXCEEDS_COLLECTED');expect(()=>pay('p2','deposit',5000000)).toThrow('DEPOSIT_EXCEEDS_TOTAL');});
  it('impide reducir precio por debajo de lo ya cobrado',()=>{reserve('r');pay('p','rent',20000000);expect(()=>db.exec("UPDATE reservations SET total=10000000 WHERE id='r'")).toThrow('TOTAL_BELOW_COLLECTED');});
  it('permite devolver alquiler tras cancelar, sin nuevos cobros',()=>{reserve('r');pay('p','rent',20000000);db.exec("UPDATE reservations SET status='cancelled' WHERE id='r'");pay('d','rent_refund',10000000);expect(()=>pay('n','rent',1000000)).toThrow('RESERVATION_CANCELLED');});
  it('solo un dispositivo puede usar cada autorización de alta',()=>{db.exec("INSERT INTO credentials(id,public_key,counter,name,transports,enrollment_key) VALUES('a','key',0,'iPhone','[]','invite')");expect(()=>db.exec("INSERT INTO credentials(id,public_key,counter,name,transports,enrollment_key) VALUES('b','key',0,'PC','[]','invite')")).toThrow();});
  it('revocar llave elimina sus sesiones',()=>{db.exec("INSERT INTO credentials(id,public_key,counter,name,transports,enrollment_key) VALUES('a','key',0,'iPhone','[]','initial'); INSERT INTO sessions VALUES('hash','a',9999999999999); DELETE FROM credentials WHERE id='a'");expect(db.prepare('SELECT COUNT(*) n FROM sessions').get()?.n).toBe(0);});
});
