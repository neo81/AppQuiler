import { useEffect,useRef,useState } from 'react';
import type {ReactNode,FormEvent} from 'react';
import { X,LoaderCircle,ArrowUpRight } from 'lucide-react';
export function Modal({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const d=ref.current;d?.showModal();return()=>d?.close();},[]);
  return <dialog ref={ref} className={'modal '+(wide?'wide':'')} onCancel={onClose} onClick={e=>{if(e.target===ref.current){const r=ref.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}><div className="modal-heading"><div><span className="eyebrow">DEPARTAMENTO · VILLA GESELL</span><h2>{title}</h2></div><button className="icon-button" aria-label="Cerrar" onClick={onClose}><X size={22}/></button></div>{children}</dialog>;
}
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){return <label className="field"><span>{label}</span>{children}{hint?<small>{hint}</small>:null}</label>;}
export function ErrorNotice({message}:{message:string}){return message?<div role="alert" className="error-notice">{message}</div>:null;}
export function Empty({title,text,action}:{title:string;text:string;action?:ReactNode}){return <div className="empty"><div className="empty-symbol">✧</div><h3>{title}</h3><p>{text}</p>{action}</div>;}
export function Form({children,onSave,label='Guardar',onClose}:{children:ReactNode;onSave:()=>Promise<void>;label?:string;onClose?:()=>void}){
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const inFlight=useRef(false);
  async function submit(e:FormEvent){e.preventDefault();if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');try{await onSave();}catch(e){setError((e as Error).message);}finally{inFlight.current=false;setBusy(false);}}
  return <form onSubmit={submit}><fieldset disabled={busy} className="form-body">{children}</fieldset><ErrorNotice message={error}/><div className="form-actions">{onClose?<button type="button" className="button secondary" onClick={onClose} disabled={busy}>Volver</button>:null}<button type="submit" className="button" disabled={busy}>{busy?<LoaderCircle className="spin" size={17}/>:null}{busy?'Guardando…':label}</button></div></form>;
}
export function PageHeading({eyebrow,title,text,actions}:{eyebrow:string;title:string;text:string;actions?:ReactNode}){return <header className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{text}</p></div><div className="heading-actions">{actions}</div></header>;}
export function Status({cancelled=false}:{cancelled?:boolean}){return <span className={'badge '+(cancelled?'muted':'')}><span className="dot"/>{cancelled?'Cancelada':'Confirmada'}</span>;}
export function ViewButton({onClick}:{onClick:()=>void}){return <button className="icon-button" onClick={onClick} aria-label="Ver ficha de reserva"><ArrowUpRight size={20}/></button>;}
export const shortDate=(v:string)=>new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(v+'T12:00:00'));
export const localTimestamp=(v:string)=>new Intl.DateTimeFormat('es-AR',{timeZone:'America/Argentina/Buenos_Aires',dateStyle:'short',timeStyle:'short'}).format(new Date(v.includes('T')?v:v.replace(' ','T')+'Z'));
export function addDays(v:string,n:number){const d=new Date(v+'T12:00:00Z');if(Number.isNaN(d.getTime()))return '';d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function pesos(v:string){const n=Number(v);return Number.isFinite(n)?Math.round(n*100):0;}
