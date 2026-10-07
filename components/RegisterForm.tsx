'use client';
import { FormEvent, useState } from 'react';
import { Heart, CheckCircle2, Download, Copy } from 'lucide-react';
type Registration = { code: string; reference: string; childName: string };
export default function RegisterForm({ ready }: { ready: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [registered, setRegistered] = useState<Registration | null>(null);
  const [copied, setCopied] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true);
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ childName: values.get('childName'), age: Number(values.get('age')), parentName: values.get('parentName'), phone: values.get('phone'), email: values.get('email'), locality: values.get('locality'), school: values.get('school'), consent: values.get('consent') === 'on', website: values.get('website') }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration could not be saved.');
      setRegistered(data);
    } catch (err) { setError(err instanceof Error ? err.message : 'Please check your connection and try again.'); } finally { setBusy(false); }
  }
  function downloadCode() {
    if (!registered) return;
    const content = `Karthika Damodara Vratham 2026\nChild: ${registered.childName}\nReference: ${registered.reference}\nPrivate participant code: ${registered.code}\n\nKeep this code private. Use it for daily and special offerings.\nDates: October 26–November 25, 2026. All times IST.\nOffer and submit your ghee lamp photo before 7:30 PM daily.\n7:30 PM: Gita Values. 7:50 PM: Japa. 8 PM: Live Damodara arati.\n`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
    const link = document.createElement('a'); link.href = url; link.download = `${registered.reference}-participant-code.txt`; link.click(); URL.revokeObjectURL(url);
  }
  if (registered) return <section className="form-shell success-panel" aria-live="polite"><CheckCircle2 size={44} color="#214e46" style={{margin:'0 auto 18px'}}/><span className="eyebrow">YOU’RE PART OF THE JOURNEY</span><h2>Welcome, {registered.childName}!</h2><p>Your free registration is saved. Your reference is <strong>{registered.reference}</strong>.</p><p><strong>Save this private participant code now.</strong><br/>You’ll need it every time you submit an offering. It won’t be shown again after you leave this page.</p><code className="code-box">{registered.code}</code><div className="success-actions"><button className="button" onClick={downloadCode}><Download size={17}/> Save code</button><button className="button secondary" onClick={async () => { try { await navigator.clipboard.writeText(registered.code); setCopied(true); } catch { setError('Please select and copy the code above, or download it.'); } }}><Copy size={17}/>{copied ? 'Copied!' : 'Copy code'}</button></div>{error && <p role="alert">{error}</p>}<p className="form-note">Keep your code with your parent or guardian. Do not share it in groups.</p><a className="text-link" href="/participate" style={{display:'inline-block', marginTop:25}}>Go to the offering forms</a></section>;
  return <form className="form-shell" onSubmit={submit}>
    {!ready && <div className="notice" role="status"><strong>Registration opens soon.</strong> The organizers are completing setup. You can explore the form below; registration is free.</div>}
    <h2 className="form-subhead">A little about your child</h2><div className="form-grid">
      <label className="field">Child’s full name *<input name="childName" autoComplete="off" required minLength={2} maxLength={80} placeholder="Name of the participant"/></label>
      <label className="field">Age on October 26, 2026 *<select name="age" defaultValue="" required><option value="" disabled>Select age</option>{Array.from({length:10},(_,i)=>i+6).map(age=><option key={age} value={age}>{age} years</option>)}</select></label>
      <label className="field full">Area in or around Vizag *<input name="locality" required minLength={2} maxLength={100} placeholder="e.g. MVP Colony, Gajuwaka, Madhurawada"/><small>Your area is enough. We don’t need your home address.</small></label>
      <label className="field full">School <small>(optional)</small><input name="school" maxLength={120} placeholder="School name"/></label>
    </div><h2 className="form-subhead" style={{marginTop:32}}>Parent or guardian details</h2><div className="form-grid">
      <label className="field">Parent / guardian name *<input name="parentName" autoComplete="name" required minLength={2} maxLength={80} placeholder="Your full name"/></label>
      <label className="field">WhatsApp number *<input name="phone" type="tel" autoComplete="tel-national" inputMode="tel" required pattern="(?:\+91[ -]?)?[6-9][0-9]{9}" maxLength={14} placeholder="10-digit Indian mobile number"/><small>For challenge-related communication.</small></label>
      <label className="field full">Parent / guardian email <small>(optional)</small><input name="email" type="email" autoComplete="email" maxLength={160} placeholder="you@example.com"/></label>
      <label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>
      <label className="check-label field full"><input type="checkbox" name="consent" required/><span>I am the child’s parent or guardian. I consent to registration, private photo/video submissions, and challenge-related communication. I’ll supervise lamp offerings and have read the <a href="/privacy" target="_blank" rel="noopener noreferrer">parent and privacy information</a>. *</span></label>
    </div>{error && <div className="notice error" role="alert" style={{marginTop:22}}>{error}</div>}<button className="button form-submit" type="submit" disabled={busy || !ready}>{busy ? 'Saving your registration…' : 'Register for free'}<Heart size={17}/></button><p className="form-note">No registration fee. No payment details. Just a loving promise.</p>
  </form>;
}
