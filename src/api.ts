import type {Data} from '../shared/domain';
export class ApiError extends Error {constructor(message:string,public status:number){super(message);}}
export async function api<T>(path:string,body?:unknown):Promise<T>{
  let res:Response;
  try{res=await fetch('/api'+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});}catch{throw new ApiError('No se pudo confirmar la operación. Revisá los datos al recuperar la conexión antes de volver a guardar.',0);}
  const result=await res.json() as {error?:string};if(!res.ok){if(res.status===401)window.dispatchEvent(new Event('gesell:unauthorized'));throw new ApiError(result.error||'No se pudo completar la operación.',res.status);}return result as T;
}
export const loadData=()=>api<Data>('/data');
