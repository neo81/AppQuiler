import {describe,it,expect} from 'vitest';
import {body,sameOrigin,originFor,digest} from '../worker/auth';
import type {Env} from '../worker/auth';
const env={SITE_ORIGIN:'https://gesell.example.workers.dev'} as Env;
describe('Fronteras de la API',()=>{
  it('rechaza escrituras de otro sitio y de un origen alternativo',()=>{
    expect(()=>sameOrigin(new Request(env.SITE_ORIGIN+'/api/guests',{method:'POST',headers:{Origin:'https://otro.example'}}),env)).toThrow('Origen');
    expect(()=>sameOrigin(new Request('https://preview.example/api/data'),env)).toThrow('Dirección');
  });
  it('rechaza solicitudes cross-site aunque sean GET',()=>{expect(()=>sameOrigin(new Request(env.SITE_ORIGIN+'/api/data',{headers:{'Sec-Fetch-Site':'cross-site'}}),env)).toThrow();});
  it('falla cerrado si falta configurar el origen de producción',()=>{expect(()=>originFor(new Request('https://gesell.example.workers.dev'),{} as Env)).toThrow();});
  it('mide el cuerpo real aunque no haya Content-Length',async()=>{const req=new Request('https://example.com',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({notes:'x'.repeat(17000)})});await expect(body(req)).rejects.toMatchObject({status:413});});
  it('rechaza arrays, JSON mal formado y tipos de contenido alternativos',async()=>{
    await expect(body(new Request('https://example.com',{method:'POST',headers:{'Content-Type':'application/json'},body:'[]'}))).rejects.toMatchObject({status:400});
    await expect(body(new Request('https://example.com',{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'}))).rejects.toMatchObject({status:415});
  });
  it('almacena hashes de sesión, no sus valores originales',async()=>{expect(await digest('token')).toHaveLength(64);expect(await digest('token')).not.toBe('token');});
});
