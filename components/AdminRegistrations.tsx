'use client';
import { FormEvent, useEffect, useState } from 'react';
import { LockKeyhole } from 'lucide-react';

type Registration = { id:string; reference:string; child_name:string; phone:string; email:string|null; locality:string; consent_at:string; created_at:string };

export default function AdminRegistrations() {
  const [rows,setRows]=useState<Registration[]|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState('');
  async function load(){const response=await fetch('/api/organizer',{cache:'no-store'});const data=await response.json();if(response.status===401){setRows(null);return;}if(!response.ok)throw new Error(data.error||'Could not load registrations.');setRows(data.participants);}
  useEffect(()=>{load().catch(err=>setError(err.message)).finally(()=>setBusy(false));},[]);
  async function login(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');const values=new FormData(event.currentTarget);try{const response=await fetch('/api/organizer/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:values.get('username'),password:values.get('password')})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not sign in.');await load();}catch(err){setError(err instanceof Error?err.message:'Could not sign in.');}finally{setBusy(false);}}
  async function signOut(){await fetch('/api/organizer/session',{method:'DELETE'});setRows(null);}
  if(busy&&rows===null&&!error)return <div className="form-shell" role="status">Checking admin access…</div>;
  if(!rows)return <form className="form-shell" style={{maxWidth:480}} onSubmit={login}><LockKeyhole size={30} color="#c05727" style={{marginBottom:20}}/><h2 className="form-subhead">Admin sign-in</h2><p style={{fontSize:'.85rem'}}>View registration records.</p><label className="field">Username<input name="username" autoComplete="username" required/></label><label className="field" style={{marginTop:15}}>Password<input name="password" type="password" autoComplete="current-password" required/></label>{error&&<div className="notice error" role="alert" style={{marginTop:20}}>{error}</div>}<button className="button form-submit" disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form>;
  return <section className="admin-registrations"><div className="admin-registration-toolbar"><strong>{rows.length} registration{rows.length===1?'':'s'}</strong><button className="button small secondary" onClick={signOut}>Sign out</button></div>{error&&<div className="notice error" role="alert">{error}</div>}<div className="table-scroll"><table><thead><tr><th>Name</th><th>WhatsApp number</th><th>Email</th><th>Area / locality</th><th>Reference</th><th>Registered on</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.child_name}</td><td>{row.phone}</td><td>{row.email||'—'}</td><td>{row.locality}</td><td>{row.reference}</td><td>{new Date(row.created_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</td></tr>)}</tbody></table>{rows.length===0&&<div className="empty">No registrations yet.</div>}</div></section>;
}
