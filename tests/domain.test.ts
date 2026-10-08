import {describe,it,expect} from 'vitest';
import {calculatePrice,overlaps,reservationSchema,dateSchema} from '../shared/domain';
const input={arrival:'2027-01-04',departure:'2027-01-10',nightly:11000000,weekly:70000000,mode:'week' as const};
describe('Tarifas comerciales acordadas',()=>{
  it('semana de seis noches a precio fijo cualquier día',()=>{expect(calculatePrice(input)).toEqual({nights:6,total:70000000,description:'1 semana'});expect(calculatePrice({...input,arrival:'2027-01-06',departure:'2027-01-12'}).total).toBe(70000000);});
  it('quincena de 13 noches se cobra como dos semanas',()=>{expect(calculatePrice({...input,mode:'fortnight',departure:'2027-01-17'}).total).toBe(140000000);});
  it('combinada suma solo las noches posteriores al paquete',()=>{expect(calculatePrice({...input,mode:'combined',departure:'2027-01-13'}).total).toBe(103000000);expect(calculatePrice({...input,mode:'combined',base:'fortnight',departure:'2027-01-19'}).total).toBe(162000000);});
  it('por noche usa diferencia real, también al cruzar meses',()=>{expect(calculatePrice({...input,mode:'night',arrival:'2027-01-30',departure:'2027-02-02'}).total).toBe(33000000);});
  it('rechaza semanas incorrectas y estadías invertidas',()=>{expect(()=>calculatePrice({...input,departure:'2027-01-11'})).toThrow('6 noches');expect(()=>calculatePrice({...input,departure:input.arrival})).toThrow();});
  it('rechaza fechas que se normalizarían silenciosamente',()=>{expect(dateSchema.safeParse('2027-02-30').success).toBe(false);});
});
describe('Disponibilidad',()=>{
  it('acepta salida e ingreso el mismo día',()=>{expect(overlaps('2027-01-04','2027-01-10','2027-01-10','2027-01-16')).toBe(false);});
  it('detecta cruce parcial y contención completa',()=>{expect(overlaps('2027-01-04','2027-01-10','2027-01-09','2027-01-13')).toBe(true);expect(overlaps('2027-01-01','2027-01-20','2027-01-04','2027-01-10')).toBe(true);});
});
