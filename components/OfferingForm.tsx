'use client';
import { FormEvent, useRef, useState } from 'react';
import { Flame, Sparkles, CheckCircle2 } from 'lucide-react';
import { beforeDeadline, END_DATE, fileAllowed, inChallenge, istDate, START_DATE } from '@/lib/challenge';
export default function OfferingForm({ ready, initialTab }: { ready: boolean; initialTab: 'daily' | 'special' }) {
  const [tab, setTab] = useState(initialTab);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState<{ late: boolean } | null>(null);
  const [today] = useState(()=>istDate());
  const prepared = useRef<{ file: File; code: string; kind: string; id: string } | null>(null);
  const open = inChallenge(today);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true); setMessage('');
    const values = new FormData(event.currentTarget);
    const code = String(values.get('code') || '').trim();
    const file = values.get('file') as File;
    try {
      if (!file || !fileAllowed(tab, file.type, file.size)) throw new Error('Choose a JPG, PNG or WebP photo up to 10 MB, or a special offering video (MP4, MOV, WebM) up to 50 MB.');
      if (tab === 'daily' && !beforeDeadline(String(values.get('time')))) throw new Error('Offer your ghee lamp before 7:30 PM IST.');
      let uploadId = prepared.current?.file === file && prepared.current.code === code && prepared.current.kind === tab ? prepared.current.id : undefined;
      // File objects from FormData can differ between attempts. Match immutable selected-file attributes too.
      const existing = prepared.current;
      if (!uploadId && existing && existing.code === code && existing.kind === tab && existing.file.name === file.name && existing.file.size === file.size && existing.file.lastModified === file.lastModified) uploadId = existing.id;
      if (!uploadId) {
        setMessage('Preparing your private upload…');
        const signed = await fetch('/api/upload', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ code, kind:tab, type:file.type, size:file.size }) });
        const signing = await signed.json();
        if (!signed.ok) throw new Error(signing.error || 'Could not prepare the upload.');
        setMessage('Uploading your offering. Please keep this page open…');
        const body = new FormData(); body.append('cacheControl','3600'); body.append('',file);
        const uploaded = await fetch(signing.signedUrl, { method:'PUT', body });
        if (!uploaded.ok) throw new Error('Your file did not upload. Please check your connection and try again.');
        uploadId = signing.uploadId;
        prepared.current = { file, code, kind:tab, id:signing.uploadId };
      }
      setMessage('Saving your offering…');
      const response = await fetch('/api/submit', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ code, kind:tab, uploadId, date:values.get('date'), time:values.get('time'), timestampConfirmed:values.get('timestamp')==='on', category:values.get('category'), title:values.get('title'), description:values.get('description'), original:values.get('original')==='on' }) });
      const saved = await response.json();
      if (!response.ok) throw new Error(saved.error || 'Your offering could not be saved.');
      prepared.current = null; setSuccess({ late: Boolean(saved.late) });
    } catch (err) { setError(err instanceof Error ? err.message : 'Please check your connection and try again.'); } finally { setBusy(false); setMessage(''); }
  }
  if (success) return <section className="form-shell success-panel" aria-live="polite"><CheckCircle2 size={44} color="#214e46" style={{margin:'0 auto 18px'}}/><h2>Your offering is received.</h2><p>{tab==='daily' ? 'Your lamp photo has been saved for the organizers to review. Session attendance is recorded separately.' : 'Your special offering has been saved for the organizers to review. Thank you for sharing your creativity with Krishna.'}</p>{success.late && <div className="notice">This photo arrived after 7:30 PM IST and is marked late for review. The organizers will check the time shown in your photo.</div>}<div className="success-actions"><a className="button" href="/">Back to the journey</a>{tab==='special' && <button className="button secondary" onClick={()=>setSuccess(null)}>Share another offering</button>}</div></section>;
  return <section className="form-shell"><div className="tabs" role="tablist" aria-label="Offering forms"><button type="button" role="tab" id="daily-tab" aria-controls="offering-panel" aria-selected={tab==='daily'} disabled={busy} onClick={()=>{setTab('daily');setError('');}}><Flame size={16} style={{verticalAlign:'middle',marginRight:7}}/> Daily lamp offering</button><button type="button" role="tab" id="special-tab" aria-controls="offering-panel" aria-selected={tab==='special'} disabled={busy} onClick={()=>{setTab('special');setError('');}}><Sparkles size={16} style={{verticalAlign:'middle',marginRight:7}}/> Special offerings</button></div>
    <div id="offering-panel" role="tabpanel" aria-labelledby={tab==='daily'?'daily-tab':'special-tab'}>
    {!ready ? <div className="notice" role="status">The organizers are completing submission setup. The forms below show what you’ll need.</div> : !open && <div className="notice" role="status">{today < START_DATE ? 'Submissions open on October 26, 2026.' : `Submissions closed on November 25, 2026.`} Please return during the vratham.</div>}
    <h2 className="form-subhead">{tab==='daily' ? 'One little lamp. Every day.' : 'An offering from your heart.'}</h2><p style={{fontSize:'.85rem'}}>{tab==='daily' ? 'Offer and upload your ghee lamp photo before 7:30 PM IST. The date and time must be visible in the photo.' : 'Share a drawing, a retelling of the pastime, the Damodara Ashtakam, or another creative offering. Special offerings are optional.'}</p>
    <form onSubmit={submit} key={tab}><div className="form-grid"><label className="field full">Private participant code *<input name="code" autoComplete="off" spellCheck={false} required minLength={20} maxLength={100} placeholder="KDV-…"/><small>Use the private code saved by your parent after registration. <a href="/register" className="text-link">Not registered yet?</a></small></label>
    {tab==='daily' ? <><label className="field">Offering date (IST)<input name="date" type="date" value={today} readOnly min={START_DATE} max={END_DATE}/><small>Daily submissions are for today’s offering.</small></label><label className="field">Time you offered the lamp (IST) *<input name="time" type="time" max="19:29" required/><small>Must match the time shown in your photo.</small></label></> : <><label className="field full">Offering category *<select name="category" defaultValue="" required><option value="" disabled>Choose your offering</option>{['Painting or drawing','Pastime narration','Damodara Ashtakam','Other creative offering'].map(value=><option key={value}>{value}</option>)}</select></label><label className="field full">Title of your offering *<input name="title" minLength={2} maxLength={100} required placeholder="Give your offering a little name"/></label><label className="field full">Tell us about it *<textarea name="description" minLength={2} maxLength={1000} required placeholder="A few words about what you made or shared"/></label></>}
    <label className="field full">{tab==='daily' ? 'Timestamped lamp photo *' : 'Photo or video *'}<input name="file" type="file" accept={tab==='daily'?'.jpg,.jpeg,.png,.webp':'.jpg,.jpeg,.png,.webp,.mp4,.mov,.webm'} required onChange={()=>{prepared.current=null;}}/><small>{tab==='daily'?'JPG, PNG or WebP · up to 10 MB. Show Krishna, the lamp, and a visible date/time stamp.':'Photos: JPG, PNG or WebP up to 10 MB. Videos: MP4, MOV or WebM up to 50 MB.'}</small></label>
    {tab==='daily' ? <label className="check-label field full"><input type="checkbox" name="timestamp" required/><span>The photo shows today’s lamp offering with a visible date and time stamp. A parent or guardian supervised the lamp offering. *</span></label> : <label className="check-label field full"><input type="checkbox" name="original" required/><span>This is the registered child’s own creative offering, and a parent or guardian has approved this private submission. *</span></label>}
    </div>{error && <div className="notice error" role="alert" style={{marginTop:20}}>{error}</div>}{message && <p className="progress-message" role="status">{message}</p>}<button className="button form-submit" disabled={busy || !ready || !open} type="submit">{busy?'Sharing your offering…':tab==='daily'?'Submit daily lamp offering':'Share special offering'}{tab==='daily'?<Flame size={17}/>:<Sparkles size={17}/>}</button><p className="form-note">Offerings are private and reviewed by the organizers.</p></form></div>
  </section>;
}
